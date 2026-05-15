import express from 'express';
import { protect } from '../Middleware/authMiddleware.js';
import {
  estimateFare,
  requestRide,
  acceptRide,
  verifyOTP,
  getRideDetails,
  getActiveRide,
  getRideHistory,
  cancelRide,
  rateRide,
  getNearbyDrivers,
} from '../Controllers/rideController.js';

const router = express.Router();

router.use(protect);

router.get('/estimate-fare', estimateFare);
router.post('/request', requestRide);
router.post('/:rideId/accept', acceptRide);
router.post('/:rideId/verify-otp', verifyOTP);
router.get('/active', getActiveRide);
router.get('/history', getRideHistory);
router.get('/nearby-drivers', getNearbyDrivers);
router.get('/:rideId', getRideDetails);
router.put('/:rideId/cancel', cancelRide);
router.post('/:rideId/rate', rateRide);

export default router;
