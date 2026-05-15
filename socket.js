import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { authenticateSocket } from './Middleware/authMiddleware.js';
import { redisClient, redisPub, redisSub, keys, channels } from './redis.js';
import driverLocationService from './Services/DriverLocationService.js';
import rideService from './Services/RideService.js';
import Driver from './Models/Driver.js';
import Booking from './Models/Booking.js';
import logger from './logger.js';

class SocketServer {
  constructor() {
    this.io = null;
  }

  async initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // Adjust for production
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 10000,
      pingTimeout: 5000,
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true,
      },
    });

    // Redis adapter for horizontal scaling
    if (redisClient.status === 'ready') {
        this.io.adapter(createAdapter(redisPub, redisSub));
    }

    // Authentication middleware
    this.io.use(authenticateSocket);

    // Connection handler
    this.io.on('connection', (socket) => this.handleConnection(socket));

    // Redis pub/sub for cross-server ride events
    this.setupRedisPubSub();

    logger.info('Socket.IO server initialized');
    return this.io;
  }

  handleConnection(socket) {
    const { userId, role, user } = socket.data;
    logger.info(`Socket connected: ${user.name} (${role}) - ${socket.id}`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    if (role === 'driver') {
      socket.join('drivers');
      this.setupDriverHandlers(socket);
    } else if (role === 'passenger') {
      socket.join('passengers');
      this.setupPassengerHandlers(socket);
    }

    socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason));
    socket.on('error', (err) => logger.error(`Socket error [${socket.id}]:`, err));
  }

  // ─── DRIVER EVENT HANDLERS ────────────────────────────────────────────────────

  setupDriverHandlers(socket) {
    const { userId } = socket.data;

    socket.on('driver:go_online', async ({ latitude, longitude }) => {
      try {
        await driverLocationService.updateLocation(userId, { latitude, longitude });

        await Driver.findOneAndUpdate(
          { userId },
          { isOnline: true, isAvailable: true }
        );

        await redisClient.setex(keys.driverSocket(userId), 86400, socket.id);

        socket.emit('driver:status', { isOnline: true, message: 'You are now online' });
      } catch (err) {
        socket.emit('error', { code: 'GO_ONLINE_FAILED', message: err.message });
      }
    });

    socket.on('driver:go_offline', async () => {
      try {
        await driverLocationService.setDriverOffline(userId);
        await Driver.findOneAndUpdate({ userId }, { isOnline: false, isAvailable: false });
        await redisClient.del(keys.driverSocket(userId));

        socket.emit('driver:status', { isOnline: false, message: 'You are now offline' });
      } catch (err) {
        socket.emit('error', { code: 'GO_OFFLINE_FAILED', message: err.message });
      }
    });

    socket.on('driver:update_location', async ({ latitude, longitude, heading, speed }) => {
      try {
        await driverLocationService.updateLocation(userId, { latitude, longitude, heading, speed });

        const driver = await Driver.findOne({ userId }).select('currentRideId');
        if (driver?.currentRideId) {
          const locationUpdate = { latitude, longitude, heading, speed };

          // Cross-server delivery via Redis
          await redisPub.publish(
            channels.driverLocation(userId),
            JSON.stringify({ rideId: driver.currentRideId, ...locationUpdate })
          );

          // Direct emit to passenger
          const booking = await Booking.findById(driver.currentRideId).select('passenger');
          if (booking) {
            this.io.to(`user:${booking.passenger.toString()}`).emit(
              'ride:driver_location',
              { ...locationUpdate, rideId: driver.currentRideId }
            );
          }
        }
      } catch (err) {
        logger.debug(`Location update error for driver ${userId}:`, err.message);
      }
    });

    socket.on('driver:accept_ride', async ({ rideId }) => {
      try {
        const result = await rideService.acceptRide(userId, rideId);
        const { ride, driver, otp } = result;

        socket.emit('ride:acceptance_confirmed', { ride });

        this.io.to(`user:${ride.passengerId.toString()}`).emit('ride:accepted', {
          rideId: ride._id,
          otp,
          driver,
          driverLocation: await driverLocationService.getDriverLocation(userId),
        });

        await redisPub.publish(channels.rideAccepted(rideId), JSON.stringify({ winnerId: userId }));
      } catch (err) {
        if (err.message === 'RIDE_UNAVAILABLE') {
          socket.emit('ride:unavailable', { rideId, message: 'Ride was accepted by another driver' });
        } else {
          socket.emit('error', { code: 'ACCEPT_FAILED', message: err.message });
        }
      }
    });

    socket.on('driver:arrived', async ({ rideId }) => {
      try {
        const ride = await rideService.updateRideStatus(rideId, 'arrived');
        this.io.to(`user:${ride.passengerId.toString()}`).emit('ride:arrived', { rideId });
        socket.emit('ride:arrived_confirmed', { rideId });
      } catch (err) {
        socket.emit('error', { code: 'ARRIVED_FAILED', message: err.message });
      }
    });

    socket.on('driver:start_ride', async ({ rideId, otp }) => {
      try {
        await rideService.verifyOTP(rideId, otp);
        const ride = await rideService.updateRideStatus(rideId, 'started');
        this.io.to(`user:${ride.passengerId.toString()}`).emit('ride:started', { rideId });
        socket.emit('ride:started', { rideId });
      } catch (err) {
        socket.emit('error', { code: 'START_FAILED', message: err.message });
      }
    });

    socket.on('driver:complete_ride', async ({ rideId }) => {
      try {
        const ride = await rideService.updateRideStatus(rideId, 'completed');
        this.io.to(`user:${ride.passengerId.toString()}`).emit('ride:completed', { rideId });
        socket.emit('ride:completed', { rideId });
      } catch (err) {
        socket.emit('error', { code: 'COMPLETE_FAILED', message: err.message });
      }
    });
  }

  // ─── PASSENGER EVENT HANDLERS ─────────────────────────────────────────────────

  setupPassengerHandlers(socket) {
    const { userId } = socket.data;

    socket.on('passenger:request_ride', async (rideData) => {
      try {
        const ride = await rideService.createRideRequest(userId, rideData);

        socket.emit('ride:created', { rideId: ride._id });

        const nearbyDrivers = await driverLocationService.findNearbyOnlineDrivers(
          rideData.pickupLat,
          rideData.pickupLng,
          5,
          rideData.vehicleType
        );

        if (nearbyDrivers.length === 0) {
          socket.emit('ride:no_drivers', { rideId: ride._id });
          return;
        }

        const rideRequestPayload = {
          rideId: ride._id,
          pickup: { address: rideData.pickupAddress, latitude: rideData.pickupLat, longitude: rideData.pickupLng },
          dropoff: { address: rideData.dropoffAddress, latitude: rideData.dropoffLat, longitude: rideData.dropoffLng },
          fare: rideData.offeredFare,
          distance: rideData.distance,
          passenger: { id: userId, name: socket.data.user.name, rating: 4.8 },
        };

        for (const driver of nearbyDrivers) {
          const driverSocketId = await redisClient.get(keys.driverSocket(driver.userId.toString()));
          if (driverSocketId) {
            this.io.to(driverSocketId).emit('ride:new_request', rideRequestPayload);
          }
        }
      } catch (err) {
        socket.emit('error', { code: 'REQUEST_FAILED', message: err.message });
      }
    });
  }

  async handleDisconnect(socket, reason) {
    const { userId, role } = socket.data;
    if (role === 'driver') {
      setTimeout(async () => {
        const currentSocketId = await redisClient.get(keys.driverSocket(userId));
        if (currentSocketId === socket.id) {
          await driverLocationService.setDriverOffline(userId);
          await Driver.findOneAndUpdate({ userId }, { isOnline: false });
        }
      }, 30000);
    }
    await redisClient.del(keys.userSocket(userId));
  }

  setupRedisPubSub() {
    if (redisSub.status !== 'ready') {
      logger.warn('Redis: Sub client not ready. Skipping Pub/Sub configuration.');
      return;
    }

    // Subscribe to ride accepted events from other server instances
    redisSub.psubscribe('ride:accepted:*', (err) => {
      if (err) logger.error('Redis psubscribe error:', err);
    });

    redisSub.on('pmessage', async (pattern, channel, message) => {
      try {
        const data = JSON.parse(message);

        if (channel.startsWith('ride:accepted:')) {
          const rideId = channel.replace('ride:accepted:', '');
          const { winnerId } = data;

          // Get the booking to find notified drivers
          const booking = await Booking.findById(rideId).select('notifiedDrivers');
          if (!booking) return;

          // Notify all other drivers that ride is unavailable
          for (const driverId of booking.notifiedDrivers) {
            if (driverId.toString() === winnerId) continue;

            const driverSocketId = await redisClient.get(
              keys.driverSocket(driverId.toString())
            );
            if (driverSocketId) {
              this.io.to(driverSocketId).emit('ride:unavailable', {
                rideId,
                message: 'This ride was accepted by another driver',
              });
            }
          }
        }
      } catch (err) {
        logger.error('Redis pmessage handler error:', err);
      }
    });

    logger.info('Redis pub/sub listeners configured');
  }
}

const socketServer = new SocketServer();

export const initSocket = (httpServer) => socketServer.initialize(httpServer);

// Convenience exports for controllers
export const emitToDrivers = (targetIds, event, data) => {
    if (!socketServer.io) return;

    if (Array.isArray(targetIds)) {
        // Notify specific drivers
        targetIds.forEach(id => {
            socketServer.io.to(`user:${id.toString()}`).emit(event, data);
        });
    } else {
        // Broadcast to all online drivers
        socketServer.io.to('drivers').emit(targetIds, event); // In this case targetIds is the event
    }
};

export const emitToPassenger = (passengerId, event, data) => {
    if (socketServer.io) {
        socketServer.io.to(`user:${passengerId}`).emit(event, data);
    }
};

export default socketServer;
