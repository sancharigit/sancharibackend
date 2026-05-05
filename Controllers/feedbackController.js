import Feedback from '../Models/Feedback.js';

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
