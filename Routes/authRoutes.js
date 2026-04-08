import express from 'express';
import { register, login, getMe, googleLogin, verifyOTP, whatsappLogin } from '../Controllers/authController.js';
import { protect } from '../Middleware/authMiddleware.js';

const router = express.Router();

// Public routes
// Public routes
router.post('/register', register);   // POST /api/auth/register
router.post('/login', login);         // POST /api/auth/login
router.post('/whatsapp-login', whatsappLogin); // POST /api/auth/whatsapp-login
router.post('/verify-otp', verifyOTP); // POST /api/auth/verify-otp
router.post('/google', googleLogin);  // POST /api/auth/google

// Protected routes
router.get('/me', protect, getMe);    // GET  /api/auth/me

export default router;
