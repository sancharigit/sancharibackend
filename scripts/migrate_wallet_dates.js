import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Wallet from '../Models/Wallet.js';

dotenv.config();

const migrate = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const wallets = await Wallet.find();
        console.log(`Auditing ${wallets.length} wallets...`);

        let updatedCount = 0;
        for (const wallet of wallets) {
            let changed = false;
            wallet.transactions.forEach(tx => {
                // If tx has a 'date' field but no 'timestamp' field, rename it
                // Note: Mongoose subdocuments might have it as tx.get('date')
                const txObj = tx.toObject();
                if (txObj.date && !txObj.timestamp) {
                    tx.timestamp = txObj.date;
                    // We can't easily delete the 'date' field via Mongoose if it's not in schema anymore,
                    // but since I renamed it in the schema, Mongoose will ignore 'date' on save/load.
                    changed = true;
                }
            });

            if (changed) {
                await wallet.save();
                updatedCount++;
                console.log(`Updated wallet for user: ${wallet.user}`);
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} wallets.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
