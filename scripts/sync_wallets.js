import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../Models/User.js';
import Wallet from '../Models/Wallet.js';

dotenv.config();

const sync = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const drivers = await User.find({ role: 'driver' });
        console.log(`Found ${drivers.length} drivers.`);

        for (const user of drivers) {
            const earnings = user.driverDetails?.earnings || 0;
            if (earnings > 0 && user.walletBalance === 0) {
                const netBalance = Math.round(earnings * 0.98 * 100) / 100;
                user.walletBalance = netBalance;
                await user.save();
                
                // Also update/create Wallet document
                let wallet = await Wallet.findOne({ user: user._id });
                if (!wallet) {
                    wallet = await Wallet.create({ user: user._id, balance: netBalance });
                } else {
                    wallet.balance = netBalance;
                }
                
                // Add a sync transaction if none exists
                if (wallet.transactions.length === 0) {
                    wallet.transactions.push({
                        type: 'credit',
                        amount: netBalance,
                        description: 'System Sync: Earnings to Wallet Balance (98% share)',
                        timestamp: new Date()
                    });
                }
                await wallet.save();
                
                console.log(`Synced ${user.name}: Gross ₹${earnings} -> Net ₹${netBalance}`);
            } else {
                console.log(`Skipping ${user.name}: Earnings ₹${earnings}, Balance ₹${user.walletBalance}`);
            }
        }

        console.log('Sync complete.');
        process.exit(0);
    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
};

sync();
