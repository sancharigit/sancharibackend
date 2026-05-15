import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './Models/Booking.js';

dotenv.config();

async function checkPendingBookings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const pending = await Booking.find({ status: 'pending' });
        console.log(`Found ${pending.length} pending bookings:`);
        
        pending.forEach((b, i) => {
            console.log(`[${i}] ID: ${b._id}, VehicleType: "${b.vehicleType}", Status: "${b.status}", Driver: ${b.driver}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkPendingBookings();
