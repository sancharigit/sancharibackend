import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    category: {
        type: String,
        enum: ['app_performance', 'ui_ux', 'driver_experience', 'safety', 'suggestion', 'other'],
        default: 'other'
    },
    comment: {
        type: String,
        required: true,
        trim: true
    },
    deviceInfo: {
        platform: String,
        version: String,
        model: String
    }
}, {
    timestamps: true
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;
