import express from 'express';
import { protect, adminOnly } from '../Middleware/authMiddleware.js';
import { submitFeedback, getFeedbacks } from '../Controllers/feedbackController.js';

const router = express.Router();

router.post('/submit', protect, submitFeedback);
router.get('/', protect, adminOnly, getFeedbacks);

export default router;
