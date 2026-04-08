import Booking from './Models/Booking.js';
import User from './Models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const checkActiveRides = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('--- Database Connected ---');

        const activeRides = await Booking.find({
            status: { $in: ['accepted', 'arrived', 'ongoing', 'pending'] }
        }).populate('passenger', 'name').populate('driver', 'name');
        
        console.log(`\nFound ${activeRides.length} potentially active/pending rides:`);

        activeRides.forEach((ride, index) => {
            console.log(`\n[${index + 1}] ID: ${ride._id}`);
            console.log(`    Status: ${ride.status}`);
            console.log(`    Passenger: ${ride.passenger?.name || 'Unknown'}`);
            console.log(`    Driver: ${ride.driver?.name || 'None (Still Requesting)'}`);
            console.log(`    Created At: ${ride.createdAt}`);
        });

        console.log('\n--- End of Report ---');
    } catch (error) {
        console.error('Error checking active rides:', error);
    } finally {
        process.exit(0);
    }
};

checkActiveRides();
