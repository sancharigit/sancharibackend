import DriverLocation from '../Models/DriverLocation.js';
import Driver from '../Models/Driver.js';
import { redisClient, keys, TTL } from '../redis.js';
import logger from '../logger.js';

class DriverLocationService {
  /**
   * Update driver's live location.
   * Writes to both Redis (for fast geo queries) and MongoDB (for persistence).
   */
  async updateLocation(driverId, { latitude, longitude, heading = 0, speed = 0 }) {
    const coords = [parseFloat(longitude), parseFloat(latitude)]; // MongoDB: [lng, lat]

    // 1. Update Redis sorted set for geospatial queries (GEOADD uses lng, lat order)
    if (redisClient.status === 'ready') {
        await redisClient.geoadd(keys.onlineDriversGeo(), longitude, latitude, driverId.toString());

        // 2. Cache driver's full location data with short TTL
        const locationData = { latitude, longitude, heading, speed, updatedAt: Date.now() };
        await redisClient.setex(
            keys.driverLocation(driverId.toString()),
            TTL.DRIVER_LOCATION,
            JSON.stringify(locationData)
        );
    }

    // 3. Persist to MongoDB (upsert for efficiency)
    await DriverLocation.findOneAndUpdate(
      { driverId },
      {
        location: { type: 'Point', coordinates: coords },
        heading,
        speed,
        isOnline: true,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    return { latitude, longitude, heading, speed, updatedAt: Date.now() };
  }

  /**
   * Find all online drivers within radiusKm of a coordinate.
   * Uses MongoDB 2dsphere $near query for precise results.
   * Falls back to Redis GEORADIUS for performance under high load.
   */
  async findNearbyOnlineDrivers(latitude, longitude, radiusKm = 5, vehicleType = null) {
    const radiusMeters = radiusKm * 1000;

    const query = {
      isOnline: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude], // [lng, lat]
          },
          $maxDistance: radiusMeters,
        },
      },
    };

    const driverLocations = await DriverLocation.find(query)
      .populate({
        path: 'driverId',
        populate: [
          { path: 'userId', select: 'name phone profileImage' },
          { path: 'vehicleId', select: 'make model color licensePlate vehicleType' },
        ],
      })
      .limit(50); // Cap to 50 nearby drivers

    // Filter available drivers and optionally by vehicle type
    const availableDrivers = driverLocations.filter((dl) => {
      const driver = dl.driverId;
      if (!driver?.isAvailable) return false;
      if (vehicleType && driver.vehicleId?.vehicleType !== vehicleType) return false;
      return true;
    });

    logger.debug(`Found ${availableDrivers.length} nearby drivers within ${radiusKm}km`);

    return availableDrivers.map((dl) => ({
      driverId: dl.driverId._id,
      userId: dl.driverId.userId?._id,
      name: dl.driverId.userId?.name,
      phone: dl.driverId.userId?.phone,
      photo: dl.driverId.userId?.profileImage,
      rating: dl.driverId.rating,
      vehicle: dl.driverId.vehicleId,
      location: {
        latitude: dl.location.coordinates[1],
        longitude: dl.location.coordinates[0],
      },
      heading: dl.heading,
    }));
  }

  /**
   * Fast Redis-based nearby driver lookup.
   * Trades precision for speed (~10ms vs ~100ms for MongoDB).
   */
  async findNearbyDriversFast(latitude, longitude, radiusKm = 5) {
    if (redisClient.status !== 'ready') return this.findNearbyOnlineDrivers(latitude, longitude, radiusKm);

    // GEORADIUS: returns [member, distance] pairs
    const results = await redisClient.georadius(
      keys.onlineDriversGeo(),
      longitude,
      latitude,
      radiusKm,
      'km',
      'ASC',
      'COUNT',
      50,
      'WITHCOORD',
      'WITHDIST'
    );

    return results.map(([driverId, distance, [lng, lat]]) => ({
      driverId,
      distance: parseFloat(distance),
      location: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
    }));
  }

  /**
   * Get cached driver location from Redis (real-time, ~1ms)
   */
  async getDriverLocation(driverId) {
    if (redisClient.status === 'ready') {
        const cached = await redisClient.get(keys.driverLocation(driverId.toString()));
        if (cached) return JSON.parse(cached);
    }

    // Fallback to MongoDB
    const dl = await DriverLocation.findOne({ driverId });
    if (!dl) return null;

    return {
      latitude: dl.location.coordinates[1],
      longitude: dl.location.coordinates[0],
      heading: dl.heading,
      speed: dl.speed,
      updatedAt: dl.lastUpdated,
    };
  }

  /**
   * Mark driver offline - remove from Redis geo set
   */
  async setDriverOffline(driverId) {
    if (redisClient.status === 'ready') {
        await redisClient.zrem(keys.onlineDriversGeo(), driverId.toString());
        await redisClient.del(keys.driverLocation(driverId.toString()));
    }

    await DriverLocation.findOneAndUpdate(
      { driverId },
      { isOnline: false, lastUpdated: new Date() }
    );

    logger.info(`Driver ${driverId} went offline`);
  }
}

export default new DriverLocationService();
