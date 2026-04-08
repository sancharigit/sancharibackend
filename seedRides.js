import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './models/Booking.js';
import User from './models/User.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log("Seeding dummy rides...");
        const passengers = await User.find({ role: 'passenger' }).limit(1);
        const drivers = await User.find({ role: 'driver' }).limit(1);

        if (passengers.length === 0 || drivers.length === 0) {
            console.log("Need at least 1 passenger and 1 driver.");
            process.exit();
        }

        const passengerId = passengers[0]._id;
        const driverId = drivers[0]._id;

        // Dummy Ride 1 - Completed
        await Booking.create({
            passenger: passengerId,
            driver: driverId,
            pickup: { address: '123 Main St', coordinates: [77.2, 28.6] },
            dropoff: { address: '456 Central Ave', coordinates: [77.3, 28.5] },
            status: 'completed',
            paymentMethod: 'cash',
            paymentStatus: 'completed',
            finalFare: 250,
            distanceKm: 12,
            durationMins: 35
        });

        // Dummy Ride 2 - Cancelled by driver (Should trigger a refund in the mock logic if we set paymentStatus to completed)
        await Booking.create({
            passenger: passengerId,
            driver: driverId,
            pickup: { address: '789 Park Rd', coordinates: [77.1, 28.7] },
            dropoff: { address: '321 Elm St', coordinates: [77.4, 28.3] },
            status: 'cancelled',
            paymentMethod: 'wallet',
            paymentStatus: 'completed', // Artificial simulation
            offeredFare: 150,
            distanceKm: 8,
            durationMins: 20
        });

        console.log("Successfully seeded dummy bookings.");
        process.exit();

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
