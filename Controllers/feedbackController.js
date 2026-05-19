import Feedback from '../Models/Feedback.js';
import { sendEmail } from '../Utils/emailService.js';

/**
 * @desc    Submit new app feedback
 * @route   POST /api/feedback/submit
 * @access  Private
 */
export const submitFeedback = async (req, res) => {
    try {
        const { rating, category, comment, deviceInfo } = req.body;

        if (!rating || !comment) {
            return res.status(400).json({
                success: false,
                message: 'Rating and comment are required'
            });
        }

        const feedback = await Feedback.create({
            user: req.user._id,
            rating,
            category,
            comment,
            deviceInfo
        });

        // Trigger email notification automatically in background
        const userDetails = req.user;
        const emailSubject = `App Feedback - ${(category || 'general').toUpperCase()}`;
        const emailBody = `New feedback submitted!\n\n` +
            `Rating: ${rating}/5\n` +
            `Category: ${category || 'general'}\n` +
            `Comments:\n${comment}\n\n` +
            `User Details:\n` +
            `- Name: ${userDetails?.name || 'N/A'}\n` +
            `- Email: ${userDetails?.email || 'N/A'}\n` +
            `- Phone: ${userDetails?.phone || 'N/A'}\n` +
            `- Role: ${userDetails?.role || 'N/A'}\n\n` +
            `Device Info:\n` +
            `- Platform: ${deviceInfo?.platform || 'N/A'}\n` +
            `- Version: ${deviceInfo?.version || 'N/A'}\n` +
            `- Model: ${deviceInfo?.model || 'N/A'}`;

        sendEmail({
            to: process.env.SUPPORT_EMAIL || 'support@sanchari.io',
            subject: emailSubject,
            text: emailBody
        }).catch(err => console.error('Failed to trigger email from backend:', err));

        res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: feedback
        });
    } catch (error) {
        console.error('Submit Feedback Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit feedback',
            error: error.message
        });
    }
};

/**
 * @desc    Get all feedbacks
 * @route   GET /api/feedback
 * @access  Private/Admin
 */
export const getFeedbacks = async (req, res) => {
    try {
        const feedbacks = await Feedback.find()
            .populate('user', 'name email phone role')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: feedbacks.length,
            data: feedbacks
        });
    } catch (error) {
        console.error('Get Feedbacks Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feedbacks',
            error: error.message
        });
    }
};
