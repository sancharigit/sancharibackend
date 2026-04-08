import mongoose from 'mongoose';

const supportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride'
    },
    type: {
        type: String,
        enum: ['ride_issue', 'payment_issue', 'safety_concern', 'general_inquiry'],
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    attachments: [String],
    messages: [{
        sender: {
            type: String,
            enum: ['user', 'admin']
        },
        text: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    resolvedAt: Date,
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

const Support = mongoose.model('Support', supportSchema);

export default Support;