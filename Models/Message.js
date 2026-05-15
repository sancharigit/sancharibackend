import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: false,
        },
        pool: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ride', // In the backend, the model is called 'Ride'
            required: false,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        text: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { timestamps: true }
);

// Indexes to quickly find messages for a specific booking or pool, sorted chronologically
messageSchema.index({ booking: 1, createdAt: 1 });
messageSchema.index({ pool: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
