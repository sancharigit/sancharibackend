import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./Models/User.js"; // Import your User model

dotenv.config();

const testUserCreation = async () => {
    console.log("Connecting to MongoDB...");
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        console.log("Connected successfully.");

        const mockVehicle = {
            make: "TestMake",
            model: "TestModel",
            year: "2025",
            plateNumber: "TestPlate123",
            color: "TestColor",
            fuelType: "Petrol",
            seatingCapacity: 4,
            bootSpace: "TestBoot"
        };

        const mockUser = {
            name: "Test Driver",
            email: `testdriver${Date.now()}@example.com`,
            phone: `999999999${Date.now().toString().slice(-1)}`, // Unique phone
            password: "password123",
            role: "driver",
            driverDetails: {
                vehicle: mockVehicle,
                licenseNumber: "TestLicense123"
            }
        };

        console.log("Creating user with mock data:", JSON.stringify(mockUser, null, 2));

        const user = new User(mockUser);
        const savedUser = await user.save();

        console.log("User saved successfully!");
        console.log("Saved Vehicle Data:", JSON.stringify(savedUser.driverDetails.vehicle, null, 2));

        if (savedUser.driverDetails.vehicle.make === "TestMake") {
            console.log("✅ SUCCESS: Vehicle data saved correctly.");
        } else {
            console.error("❌ FAILURE: Vehicle data is missing or default.");
        }

        process.exit(0);

    } catch (err) {
        console.error("Test blocked by error:", err);
        process.exit(1);
    }
};

testUserCreation();
