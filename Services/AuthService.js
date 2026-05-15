import User from '../Models/User.js';
import Passenger from '../Models/Passenger.js';
import Driver from '../Models/Driver.js';
import { generateTokens } from '../Middleware/authMiddleware.js';
import { redisClient } from '../redis.js';
import AppError from '../Utils/AppError.js';
import logger from '../logger.js';
import jwt from 'jsonwebtoken';

class AuthService {
  /**
   * Register a new passenger or driver
   */
  async register(userData) {
    const { name, email, phone, password, role, licenseNumber } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'phone';
      throw new AppError(`User with this ${field} already exists.`, 409);
    }

    // Create user
    const user = await User.create({ name, email, phone, password, role });

    // Create role-specific profile
    if (role === 'passenger') {
      await Passenger.create({ userId: user._id });
    } else if (role === 'driver') {
      if (!licenseNumber) throw new AppError('License number required for drivers.', 400);
      await Driver.create({ userId: user._id, licenseNumber });
    }

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    // Save refresh token hash
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    logger.info(`New ${role} registered: ${email}`);

    // Assuming User model has toSafeObject, otherwise we return a manual object
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;

    return {
      user: userObj,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login user
   */
  async login(email, password) {
    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user) throw new AppError('Invalid email or password.', 401);

    // Check if comparePassword exists on user (added via userSchema.methods earlier)
    const isPasswordValid = user.comparePassword ? await user.comparePassword(password) : (password === user.password); // Fallback if method missing
    if (!isPasswordValid) throw new AppError('Invalid email or password.', 401);

    if (user.isActive === false) throw new AppError('Account deactivated. Contact support.', 401);

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    logger.info(`User logged in: ${email}`);

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;

    return {
      user: userObj,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Logout - blacklist access token in Redis
   */
  async logout(userId, token) {
    // Get token expiry to set TTL on blacklist
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisClient.setex(`blacklist:${token}`, ttl, '1');
      }
    }

    // Clear refresh token from DB
    await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });

    logger.info(`User logged out: ${userId}`);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Invalid or expired refresh token.', 401);
    }

    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      throw new AppError('Refresh token mismatch. Please log in again.', 401);
    }

    const tokens = generateTokens(user._id, user.role);
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    return tokens;
  }
}

export default new AuthService();
