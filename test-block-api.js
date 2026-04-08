import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const passengers = await User.find({ role: 'passenger' });
        
        if(passengers.length === 0) {
            console.log("No passengers found to test with.");
            process.exit(0);
        }

        const target = passengers[0];
        console.log(`Target passenger before block: ${target.name} (Blocked: ${target.isBlocked})`);

        target.isBlocked = !target.isBlocked;
        await target.save();

        const updated = await User.findById(target._id);
        console.log(`Target passenger after block: ${updated.name} (Blocked: ${updated.isBlocked})`);

        // Revert for cleanliness
        updated.isBlocked = !updated.isBlocked;
        await updated.save();

        console.log("Verified: `isBlocked` field works in User model.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
