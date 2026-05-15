import express from 'express';
import { register, login, getMe, googleLogin, verifyOTP, whatsappLogin, updateProfile } from '../Controllers/authController.js';
import { protect } from '../Middleware/authMiddleware.js';
import upload from '../Utils/multer.js';

const router = express.Router();

// Public routes
// Public routes
router.post('/register', register);   // POST /api/auth/register
router.post('/login', login);         // POST /api/auth/login
router.post('/whatsapp-login', whatsappLogin); // POST /api/auth/whatsapp-login
router.post('/verify-otp', verifyOTP); // POST /api/auth/verify-otp
router.post('/google', googleLogin);  // POST /api/auth/google

// Protected routes
// router.post('/logout', protect, logout);       // POST /api/auth/logout
// router.post('/refresh-token', refreshToken);   // POST /api/auth/refresh-token
router.get('/me', protect, getMe);    // GET  /api/auth/me
router.put('/profile', protect, upload.single('profileImage'), updateProfile); // PUT  /api/auth/profile

export default router;


