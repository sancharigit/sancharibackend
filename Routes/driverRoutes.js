
import express from 'express';
import { protect, driverOnly } from '../Middleware/authMiddleware.js';
import upload from '../Utils/multer.js';
import {
    getDriverProfile,
    updateDriverProfile,
    toggleOnline,
    uploadDocument,
    getOnlineDrivers,
    getEarnings,
    updateLocation,
    addVehicle,
    getActiveDriverOffers,
    getTripModeStats
} from '../Controllers/driverController.js';

const router = express.Router();

// Unified upload handling moved to Utils/multer.js


// Routes
router.get('/profile', protect, driverOnly, getDriverProfile);
router.patch('/profile', protect, driverOnly, updateDriverProfile);
router.patch('/status', protect, driverOnly, toggleOnline);
router.post('/vehicle', protect, driverOnly, addVehicle);
router.patch('/location', protect, driverOnly, updateLocation);
router.get('/online', protect, getOnlineDrivers);
router.get('/earnings', protect, driverOnly, getEarnings);
router.get('/offers', protect, driverOnly, getActiveDriverOffers);
router.get('/trip-modes', protect, driverOnly, getTripModeStats);

// Upload Route with Error Handling - Accessible by all roles for profile images
router.post('/upload', protect, upload.single('document'), uploadDocument);

export default router;
