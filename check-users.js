import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const passengers = await User.find({ role: 'passenger' }).lean();
        console.log('Passengers:', JSON.stringify(passengers.slice(0, 3), null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
