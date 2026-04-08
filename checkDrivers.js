import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './Models/User.js';
import connectDB from './db.js';

dotenv.config();

const checkDrivers = async () => {
    await connectDB();
    const drivers = await User.find({ role: 'driver' });
    console.log(`Found ${drivers.length} drivers.`);
    if (drivers.length > 0) {
        console.log('Sample driver:', JSON.stringify(drivers[0], null, 2));
    }
    process.exit();
};

checkDrivers();
