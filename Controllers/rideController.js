import rideService from '../services/rideService.js';
import driverLocationService from '../services/driverLocationService.js';
import Ride from '../Models/Ride.js';
import AppError from '../Utils/AppError.js';

/**
 * @desc   Estimate fare based on distance and vehicle type
 * @route  GET /api/rides/estimate-fare
 */
export const estimateFare = async (req, res, next) => {
  try {
    const { distance, vehicleType } = req.query;
    if (!distance) throw new AppError('Distance required', 400);

    const fare = rideService.calculateSuggestedFare(parseFloat(distance), vehicleType);

    res.status(200).json({
      success: true,
      data: { suggestedFare: fare, vehicleType: vehicleType || 'sedan', distanceKm: parseFloat(distance) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Create a new ride request
 * @route  POST /api/rides/request
 */
export const requestRide = async (req, res, next) => {
  try {
    const ride = await rideService.createRideRequest(req.user._id, req.body);
    res.status(201).json({ success: true, message: 'Ride requested', data: { ride } });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Accept a ride request
 * @route  POST /api/rides/:rideId/accept
 */
export const acceptRide = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const result = await rideService.acceptRide(req.user._id, rideId);
    res.status(200).json({ success: true, message: 'Ride accepted', data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Verify OTP and start ride
 * @route  POST /api/rides/:rideId/verify-otp
 */
export const verifyOTP = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { otp } = req.body;
    await rideService.verifyOTP(rideId, otp);
    res.status(200).json({ success: true, message: 'OTP verified, ride started' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get details of a specific ride
 * @route  GET /api/rides/:rideId
 */
export const getRideDetails = async (req, res, next) => {
  try {
    const ride = await rideService.getRideById(req.params.rideId, req.user._id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get current active ride for user
 * @route  GET /api/rides/active
 */
export const getActiveRide = async (req, res, next) => {
  try {
    const query = req.user.role === 'passenger'
      ? { passengerId: req.user._id, status: { $nin: ['completed', 'cancelled'] } }
      : { driverId: req.user._id, status: { $nin: ['completed', 'cancelled'] } };

    const ride = await Ride.findOne(query)
      .populate('passengerId', 'name phone profileImage')
      .populate('driverId', 'name phone profileImage');

    res.status(200).json({ success: true, data: { ride } });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get ride history for user
 * @route  GET /api/rides/history
 */
export const getRideHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = req.user.role === 'passenger'
      ? { passengerId: req.user._id }
      : { driverId: req.user._id };

    const [rides, total] = await Promise.all([
      Ride.find({ ...query, status: { $in: ['completed', 'cancelled'] } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('passengerId', 'name')
        .populate('driverId', 'name'),
      Ride.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        rides,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Cancel a ride
 * @route  PUT /api/rides/:rideId/cancel
 */
export const cancelRide = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    const ride = await rideService.updateRideStatus(rideId, 'cancelled', {
      cancelledBy: req.user.role,
      reason: reason || 'User cancelled',
    });

    res.status(200).json({ success: true, message: 'Ride cancelled', data: { ride } });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Rate a completed ride
 * @route  POST /api/rides/:rideId/rate
 */
export const rateRide = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { rating } = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride || ride.status !== 'completed') {
      throw new AppError('Can only rate completed rides', 400);
    }

    const updateField = req.user.role === 'passenger'
      ? 'ratings.byPassenger'
      : 'ratings.byDriver';

    await Ride.findByIdAndUpdate(rideId, { [updateField]: rating });

    res.status(200).json({ success: true, message: 'Rating submitted' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get nearby online drivers
 * @route  GET /api/rides/nearby-drivers
 */
export const getNearbyDrivers = async (req, res, next) => {
  try {
    const { lat, lng, vehicleType } = req.query;
    if (!lat || !lng) throw new AppError('lat and lng required', 400);

    const drivers = await driverLocationService.findNearbyOnlineDrivers(
      parseFloat(lat), parseFloat(lng), 5, vehicleType
    );

    res.status(200).json({
      success: true,
      data: { count: drivers.length, drivers },
    });
  } catch (err) {
    next(err);
  }
};
