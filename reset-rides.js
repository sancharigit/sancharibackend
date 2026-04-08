import Booking from './Models/Booking.js';
import User from './Models/User.js';
import mongoose from 'mongoose';

import dotenv from 'dotenv';
dotenv.config();

const resetActiveRides = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const activeRides = await Booking.find({
            status: { $in: ['accepted', 'arrived', 'ongoing'] }
        });
        
        console.log(`Found ${activeRides.length} active rides to cancel.`);

        for (const ride of activeRides) {
            ride.status = 'cancelled';
            ride.cancellationReason = 'Manual system reset';
            await ride.save();
            console.log(`Cancelled ride ${ride._id}`);
        }

        console.log('Done cleaning up rides.');
    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
};

resetActiveRides();
