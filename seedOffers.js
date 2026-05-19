import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Offer from './Models/Offer.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const seedOffers = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Database connected successfully.');

        // Delete existing offers to avoid duplicates
        await Offer.deleteMany({});
        console.log('Cleared existing offers.');

        // Insert premium seed offers
        const seedData = [
            {
                title: 'Weekday Office Route',
                description: 'Save 10% on your morning commute to Tech Park.',
                badge: 'CITY COMMUTE',
                actionText: 'LEARN MORE',
                targetScreen: ''
            },
            {
                title: 'Shared-Ride Savings',
                description: 'Planning a long weekend? Book shared rides and save up to ₹45.',
                badge: 'INTER-CITY',
                actionText: 'CHECK AVAILABILITY',
                targetScreen: 'Outstation'
            }
        ];

        const createdOffers = await Offer.insertMany(seedData);
        console.log('Seeded offers successfully:', createdOffers);

        mongoose.connection.close();
        console.log('Database connection closed.');
    } catch (err) {
        console.error('Failed to seed offers:', err);
        process.exit(1);
    }
};

seedOffers();
