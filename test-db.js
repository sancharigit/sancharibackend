import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const test = async () => {
    console.log("Connecting to MongoDB...");
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        console.log("Connected successfully. performing admin ping...");
        const result = await mongoose.connection.db.admin().ping();
        console.log("Ping result:", result);
        console.log("Database connection is HEALTHY.");
        process.exit(0);
    } catch (err) {
        console.error("Database connection FAILED:");
        console.error(err);
        process.exit(1);
    }
};

test();
