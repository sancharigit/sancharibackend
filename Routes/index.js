import express from 'express';
import authRoutes from './authRoutes.js';
import driverRoutes from './driverRoutes.js';
import adminRoutes from './adminRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import poolRoutes from './poolRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import walletRoutes from './walletRoutes.js';
import feedbackRoutes from './feedbackRoutes.js';
import rideRoutes from './rideRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/driver', driverRoutes);
router.use('/admin', adminRoutes);
router.use('/bookings', bookingRoutes);
router.use('/pools', poolRoutes);
router.use('/payments', paymentRoutes);
router.use('/wallet', walletRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/rides', rideRoutes);

export default router;
