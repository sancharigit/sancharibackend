import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./Models/User.js";

dotenv.config();

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        // Check for the most recently created driver
        const user = await User.findOne({ role: 'driver' }).sort({ createdAt: -1 });
        if (user) console.log("FOUND LATEST DRIVER:", user.email);

        if (user) {
            console.log("FOUND USER:", user.name);
            console.log("Raw driverDetails:", JSON.stringify(user.driverDetails, null, 2));
        } else {
            console.log("User not found!");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkUser();
