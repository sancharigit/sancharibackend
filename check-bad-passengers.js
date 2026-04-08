import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const passengers = await User.find({ role: 'passenger' }).lean();
        
        let badCount = 0;
        passengers.forEach(p => {
            if (!p.name || !p.phone || !p.email) {
                console.log('Found bad passenger:', p._id, 'Name:', p.name, 'Phone:', p.phone, 'Email:', p.email);
                badCount++;
            }
        });
        
        console.log('Total bad passengers:', badCount);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
