import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        })
        console.log(`Mongodb connected: ${mongoose.connection.host}`);
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected. Attempting reconnect...');
        });
    }

    catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
}
export default connectDB;