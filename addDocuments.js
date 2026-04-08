import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './Models/User.js';
import connectDB from './db.js';

dotenv.config();

const addDocumentsToDriver = async () => {
    await connectDB();

    const email = 'vats@gmail.com'; // The driver found earlier
    const driver = await User.findOne({ email });

    if (!driver) {
        console.log('Driver not found');
        process.exit();
    }

    console.log(`Updating documents for ${driver.name}...`);

    // Mock file paths (assuming some files exist in uploads or just for testing URL generation)
    // In real app, these would be actual files. 
    // We can use a placeholder image URL if local files don't exist, 
    // BUT the frontend prepends 'http://localhost:5000', so we need relative paths that work.
    // Let's assume there is at least one file in uploads from previous attempts, 
    // or we can use a widely available placeholder served from web if backend proxies it?
    // No, backend serves 'uploads' static folder.
    // Let's just set them to a dummy path and hope the frontend handles 404 image gracefully, 
    // OR the user can upload a real file via Postman.
    // Better: Set them to a placeholder image hosted online? 
    // The frontend code: `http://localhost:5000${v}`.
    // So if v is `https://placehold.co/600x400`, result is `http://localhost:5000https://placehold.co...` -> BROKEN.
    
    // Use the actual file found in uploads for testing
    const realFile = '/uploads/driver-6996dd3c79f9c24551616f61-1771500400268.png';

    driver.driverDetails.documents = {
        licenseFront: realFile,
        licenseBack: realFile,
        registration: realFile,
        insurance: realFile
    };

    // Also ensure status is pending
    driver.verificationStatus.communityTrusted = false;

    await driver.save();
    console.log('Documents updated!');
    console.log(driver.driverDetails.documents);
    process.exit();
};

addDocumentsToDriver();
