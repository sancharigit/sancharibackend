import jwt from 'jsonwebtoken';
import User from '../Models/User.js';
import { redisClient, keys } from '../redis.js';
import logger from '../logger.js';

/**
 * Verify JWT and attach user to request.
 * Checks Redis token blacklist for logged-out tokens.
 */
export const authenticate = async (req, res, next) => {
    try {
        // 1. Extract token from Authorization header or cookie
        let token;
        if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
        }

        // 2. Check if token is blacklisted (logged out)
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return res.status(401).json({ success: false, message: 'Token has been invalidated. Please log in again.' });
        }

        // 3. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Get fresh user from DB
        const user = await User.findById(decoded.userId || decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'User no longer exists.' });
        }

        if (user.isActive === false) {
            return res.status(401).json({ success: false, message: 'Account has been deactivated. Contact support.' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token. Please log in.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
        }
        console.error('Auth Error:', error.message);
        next(error);
    }
};

/**
 * Role-based authorization middleware factory.
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. This route requires role: ${roles.join(' or ')}.`
            });
        }
        next();
    };
};

/**
 * Aliases for existing code compatibility
 */
export const protect = authenticate;
export const driverOnly = authorize('driver');
export const adminOnly = authorize('admin');

/**
 * Socket.IO authentication middleware.
 * Attaches user to socket.data on handshake.
 */
export const authenticateSocket = async (socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId || decoded.id).select('-password');

        if (!user || user.isActive === false) {
            return next(new Error('User not found or inactive'));
        }

        socket.data.user = user;
        socket.data.userId = user._id.toString();
        socket.data.role = user.role;

        // Store socket-to-user mapping in Redis for cross-server routing
        await redisClient.setex(
            keys.userSocket(user._id.toString()),
            86400, // 24 hours
            socket.id
        );

        logger.debug(`Socket authenticated: ${user.name} (${user.role}) - ${socket.id}`);
        next();
    } catch (error) {
        logger.error('Socket auth error:', error.message);
        next(new Error('Authentication failed'));
    }
};

/**
 * Generate JWT access + refresh tokens
 */
export const generateTokens = (userId, role) => {
    const accessToken = jwt.sign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
        { userId, role },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    return { accessToken, refreshToken };
};
