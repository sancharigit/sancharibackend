import express from 'express';
import { protect } from '../Middleware/authMiddleware.js';
import {
    requestRide,
    getNearbyRides,
    acceptRide,
    updateRideStatus,
    getActiveRide,
    getRideHistory,
    rateRide,
    getBookingById,
    getMessages,
    sendMessage,
} from '../Controllers/bookingController.js';

const router = express.Router();

// All booking routes require authentication
router.use(protect);

// ─── Passenger Routes ─────────────────────────────────────
// POST   /api/bookings/request       → Passenger requests a ride
// GET    /api/bookings/active        → Get current active ride
// GET    /api/bookings/history       → Ride history (passenger or driver)
// GET    /api/bookings/:id           → Get a single booking
// PUT    /api/bookings/:id/status    → Cancel a ride (passenger)
// POST   /api/bookings/:id/rate      → Rate a completed ride

// ─── Driver Routes ────────────────────────────────────────
// GET    /api/bookings/nearby        → Driver sees pending ride requests
// POST   /api/bookings/:id/accept    → Driver accepts a ride
// PUT    /api/bookings/:id/status    → Update status (arrived/ongoing/completed/cancelled)

router.post('/request',         requestRide);
router.get('/nearby',           getNearbyRides);
router.get('/active',           getActiveRide);
router.get('/history',          getRideHistory);
router.get('/:id',              getBookingById);
router.post('/:id/accept',      acceptRide);
router.put('/:id/status',       updateRideStatus);
router.post('/:id/rate',        rateRide);
router.get('/:id/messages',     getMessages);
router.post('/:id/messages',    sendMessage);

export default router;