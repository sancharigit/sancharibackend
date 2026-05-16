import Redis from 'ioredis';
import logger from './logger.js';

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: null,
    lazyConnect: true,
};

// Main Redis client for caching
export const redisClient = new Redis(redisConfig);

// Separate client for pub/sub (cannot be used for regular commands when subscribed)
export const redisPub = new Redis(redisConfig);
export const redisSub = new Redis(redisConfig);

redisClient.on('connect', () => logger.info('Redis: Main client connected'));
redisClient.on('error', (err) => logger.error('Redis main client error:', err));
redisPub.on('connect', () => logger.info('Redis: Pub client connected'));
redisSub.on('connect', () => logger.info('Redis: Sub client connected'));

export const connectRedis = async () => {
    await redisClient.connect();
    await redisPub.connect();
    await redisSub.connect();
};

// TTL constants (in seconds)
export const TTL = {
    DRIVER_ONLINE: 3600,       // 1 hour - driver online status
    DRIVER_LOCATION: 30,       // 30 sec - driver live location
    RIDE_LOCK: 10,             // 10 sec - race condition lock
    OTP: 300,                  // 5 min - OTP expiry
    SOCKET_MAP: 86400,         // 24 hrs - socket-to-user mapping
    RATE_LIMIT: 60,            // 1 min - rate limit window
};

// Key generators for consistent Redis key naming
export const keys = {
    driverOnline: (driverId) => `driver:online:${driverId}`,
    driverLocation: (driverId) => `driver:location:${driverId}`,
    driverSocket: (driverId) => `driver:socket:${driverId}`,
    userSocket: (userId) => `user:socket:${userId}`,
    rideLock: (rideId) => `ride:lock:${rideId}`,
    rideOTP: (rideId) => `ride:otp:${rideId}`,
    onlineDriversGeo: () => `drivers:geo`,
    rideAccepted: (rideId) => `ride:accepted:${rideId}`,
};

// Channel names for pub/sub
export const channels = {
    rideRequest: (region) => `ride:request:${region}`,
    rideAccepted: (rideId) => `ride:accepted:${rideId}`,
    driverLocation: (driverId) => `driver:location:${driverId}`,
    rideStatus: (rideId) => `ride:status:${rideId}`,
};