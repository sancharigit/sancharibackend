import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        console.log("1. Logging in as admin...");
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@hybridride.com', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        
        if (!loginData.success) {
            console.error("Login failed:", loginData.message);
            return;
        }
        const token = loginData.data.token;

        console.log("2. Fetching passengers...");
        const passRes = await fetch('http://localhost:5000/api/admin/passengers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const passData = await passRes.json();
        
        if(passData.data.length === 0) {
            console.log("No passengers found.");
            return;
        }

        const targetId = passData.data[0]._id;
        console.log(`Target passenger ID: ${targetId}`);

        console.log("\n3. Testing /rides API...");
        const ridesRes = await fetch(`http://localhost:5000/api/admin/passengers/${targetId}/rides`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const ridesData = await ridesRes.json();
        console.log(`Rides API Success: ${ridesData.success}`);
        console.log(`Found ${ridesData.data ? ridesData.data.length : 0} rides.`);
        if (ridesData.data && ridesData.data.length > 0) {
            console.log(ridesData.data[0]);
        }

        console.log("\n4. Testing /transactions API...");
        const txRes = await fetch(`http://localhost:5000/api/admin/passengers/${targetId}/transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const txData = await txRes.json();
        console.log(`Transactions API Success: ${txData.success}`);
        console.log(`Found ${txData.data ? txData.data.length : 0} transactions.`);
        if (txData.data && txData.data.length > 0) {
            console.log(txData.data[0]);
        }

    } catch (e) {
        console.error('Error:', e);
    }
};

run();
