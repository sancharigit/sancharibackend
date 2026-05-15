import bcrypt from 'bcryptjs';
import Ride from '../Models/Ride.js';
import RideOTP from '../Models/RideOTP.js';
import RideHistory from '../Models/RideHistory.js';
import Driver from '../Models/Driver.js';
import { redisClient, keys, TTL } from '../redis.js';
import AppError from '../Utils/AppError.js';
import logger from '../logger.js';

class RideService {
  /**
   * Create a new ride request
   */
  async createRideRequest(passengerId, rideData) {
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      offeredFare,
      distance,
      vehicleType = 'sedan',
      isCustomBid = false,
    } = rideData;

    const ride = await Ride.create({
      passengerId,
      pickup: {
        address: pickupAddress,
        location: { type: 'Point', coordinates: [pickupLng, pickupLat] },
      },
      dropoff: {
        address: dropoffAddress,
        location: { type: 'Point', coordinates: [dropoffLng, dropoffLat] },
      },
      fare: { offered: offeredFare, isCustomBid },
      distance,
      vehicleType,
      status: 'searching',
      'timestamps.requested': new Date(),
    });

    logger.info(`Ride created: ${ride._id} by passenger ${passengerId}`);
    return ride;
  }

  /**
   * Accept a ride - atomic lock to prevent race conditions.
   */
  async acceptRide(driverId, rideId) {
    const lockKey = keys.rideLock(rideId);
    const acceptedKey = keys.rideAccepted(rideId);

    // STEP 1: Atomic Redis lock
    if (redisClient.status === 'ready') {
        const lockAcquired = await redisClient.set(
            lockKey,
            driverId.toString(),
            'NX',
            'EX',
            TTL.RIDE_LOCK
        );

        if (!lockAcquired) {
            logger.info(`Ride ${rideId}: lock contention, driver ${driverId} lost race`);
            throw new AppError('RIDE_UNAVAILABLE', 409);
        }
    }

    try {
      // STEP 2: Double-check ride status in MongoDB
      const ride = await Ride.findById(rideId);
      if (!ride) throw new AppError('Ride not found.', 404);
      if (ride.status !== 'searching' && ride.status !== 'requested') {
        throw new AppError('RIDE_UNAVAILABLE', 409);
      }
      if (ride.driverId) {
        throw new AppError('RIDE_UNAVAILABLE', 409);
      }

      // STEP 3: Verify driver is available
      const driver = await Driver.findOne({ userId: driverId })
        .populate('userId', 'name phone profileImage')
        .populate('vehicleId');

      if (!driver || !driver.isOnline || !driver.isAvailable) {
        throw new AppError('Driver not available.', 400);
      }

      // STEP 4: Atomically update ride in MongoDB
      const updatedRide = await Ride.findOneAndUpdate(
        { _id: rideId, status: { $in: ['searching', 'requested'] }, driverId: null },
        {
          driverId,
          status: 'accepted',
          'timestamps.accepted': new Date(),
        },
        { new: true }
      );

      if (!updatedRide) {
        throw new AppError('RIDE_UNAVAILABLE', 409);
      }

      // STEP 5: Mark driver as on-ride
      await Driver.findOneAndUpdate(
        { userId: driverId },
        { isAvailable: false, currentRideId: rideId }
      );

      // STEP 6: Generate and store OTP
      const otp = await this.generateOTP(rideId);

      // STEP 7: Cache accepted state in Redis
      if (redisClient.status === 'ready') {
          await redisClient.setex(acceptedKey, 3600, driverId.toString());
      }

      logger.info(`Ride ${rideId} accepted by driver ${driverId}`);

      return {
        ride: updatedRide,
        driver: {
          id: driver._id,
          userId: driverId,
          name: driver.userId.name,
          phone: driver.userId.phone,
          photo: driver.userId.profileImage,
          rating: driver.rating,
          vehicle: driver.vehicleId,
        },
        otp,
      };
    } catch (error) {
      if (redisClient.status === 'ready') {
          await redisClient.del(lockKey);
      }
      throw error;
    }
  }

  /**
   * Generate a secure 4-digit OTP for ride verification
   */
  async generateOTP(rideId) {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + TTL.OTP * 1000);
    const hashedOTP = await bcrypt.hash(otp, 10);

    // Store in DB
    await RideOTP.findOneAndUpdate(
      { bookingId: rideId }, // Note: renamed to match model
      { otp: hashedOTP, expiresAt, attempts: 0, isUsed: false },
      { upsert: true, new: true }
    );

    // Cache in Redis
    if (redisClient.status === 'ready') {
        await redisClient.setex(keys.rideOTP(rideId.toString()), TTL.OTP, otp);
    }

    return otp;
  }

  /**
   * Verify OTP submitted by driver
   */
  async verifyOTP(rideId, submittedOTP) {
    // Fast path: Redis
    if (redisClient.status === 'ready') {
        const cachedOTP = await redisClient.get(keys.rideOTP(rideId.toString()));
        if (cachedOTP && cachedOTP === submittedOTP) {
            await this.updateRideStatus(rideId, 'otp_verified');
            await redisClient.del(keys.rideOTP(rideId.toString()));
            return true;
        }
    }

    // Slow path: MongoDB
    const rideOTP = await RideOTP.findOne({ bookingId: rideId });
    if (!rideOTP) throw new AppError('OTP not found. Request a new one.', 404);
    if (rideOTP.isUsed) throw new AppError('OTP already used.', 400);
    if (new Date() > rideOTP.expiresAt) throw new AppError('OTP expired.', 400);
    if (rideOTP.attempts >= rideOTP.maxAttempts) {
      throw new AppError('Maximum OTP attempts exceeded.', 400);
    }

    const isValid = await bcrypt.compare(submittedOTP, rideOTP.otp);

    if (!isValid) {
      rideOTP.attempts += 1;
      await rideOTP.save();
      const remaining = rideOTP.maxAttempts - rideOTP.attempts;
      throw new AppError(`Invalid OTP. ${remaining} attempt(s) remaining.`, 400);
    }

    rideOTP.isUsed = true;
    await rideOTP.save();

    await this.updateRideStatus(rideId, 'otp_verified');
    return true;
  }

  /**
   * Update ride status with timestamp tracking
   */
  async updateRideStatus(rideId, newStatus, additionalData = {}) {
    const validTransitions = {
      requested: ['accepted', 'cancelled'],
      searching: ['accepted', 'cancelled'],
      accepted: ['arrived', 'cancelled'],
      arrived: ['otp_verified', 'cancelled'],
      otp_verified: ['started'],
      started: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const ride = await Ride.findById(rideId);
    if (!ride) throw new AppError('Ride not found.', 404);

    const allowed = validTransitions[ride.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(`Cannot transition from '${ride.status}' to '${newStatus}'.`, 400);
    }

    const update = {
      status: newStatus,
      [`timestamps.${newStatus}`]: new Date(),
      ...additionalData,
    };

    const updatedRide = await Ride.findByIdAndUpdate(rideId, update, { new: true })
      .populate('passengerId', 'name phone')
      .populate('driverId', 'name phone');

    if (newStatus === 'completed') {
      await this.completeRide(updatedRide);
    }

    if (newStatus === 'cancelled') {
      await this.handleCancellation(updatedRide, additionalData);
    }

    return updatedRide;
  }

  async completeRide(ride) {
    await Promise.all([
      Driver.findOneAndUpdate(
        { userId: ride.driverId },
        { isAvailable: true, currentRideId: null, $inc: { totalRides: 1 } }
      ),
      RideHistory.create({
        rideId: ride._id,
        passengerId: ride.passengerId,
        driverId: ride.driverId,
        pickup: ride.pickup.address,
        dropoff: ride.dropoff.address,
        fare: ride.fare.offered,
        distance: ride.distance,
        status: 'completed',
        completedAt: new Date(),
      }),
    ]);

    if (redisClient.status === 'ready') {
        await redisClient.del(keys.rideLock(ride._id.toString()));
        await redisClient.del(keys.rideAccepted(ride._id.toString()));
    }
  }

  async handleCancellation(ride, { cancelledBy, reason }) {
    if (ride.driverId) {
      await Driver.findOneAndUpdate(
        { userId: ride.driverId },
        { isAvailable: true, currentRideId: null }
      );
    }

    await Ride.findByIdAndUpdate(ride._id, {
      'cancellation.cancelledBy': cancelledBy,
      'cancellation.reason': reason,
    });

    if (redisClient.status === 'ready') {
        await Promise.all([
            redisClient.del(keys.rideLock(ride._id.toString())),
            redisClient.del(keys.rideAccepted(ride._id.toString())),
            redisClient.del(keys.rideOTP(ride._id.toString())),
        ]);
    }
  }

  async getRideById(rideId, userId) {
    const ride = await Ride.findById(rideId)
      .populate('passengerId', 'name phone profileImage')
      .populate('driverId', 'name phone profileImage');

    if (!ride) throw new AppError('Ride not found.', 404);

    const isParticipant =
      ride.passengerId._id.toString() === userId.toString() ||
      ride.driverId?._id?.toString() === userId.toString();

    if (!isParticipant) throw new AppError('Access denied.', 403);

    return ride;
  }

  calculateSuggestedFare(distanceKm, vehicleType = 'sedan') {
    const baseFares = {
      bike: { base: 15, perKm: 5, minimum: 25 },
      auto: { base: 20, perKm: 8, minimum: 30 },
      mini: { base: 30, perKm: 10, minimum: 50 },
      sedan: { base: 40, perKm: 13, minimum: 80 },
      suv: { base: 60, perKm: 18, minimum: 120 },
    };

    const fareConfig = baseFares[vehicleType] || baseFares.sedan;
    const calculated = fareConfig.base + distanceKm * fareConfig.perKm;
    return Math.max(calculated, fareConfig.minimum);
  }
}

export default new RideService();
