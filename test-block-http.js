import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        console.log("1. Logging in...");
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@hybridride.com', password: 'admin' })
        });
        const loginData = await loginRes.json();
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

        const target = passData.data[0];
        console.log(`Target: ${target._id} (Blocked: ${target.isBlocked})`);

        console.log("3. Toggling block status via API...");
        const blockRes = await fetch(`http://localhost:5000/api/admin/passengers/${target._id}/block`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const blockData = await blockRes.json();

        console.log(`API Result: ${blockData.message}`);
        console.log(`New Status: Blocked = ${blockData.data.isBlocked}`);

    } catch (e) {
        console.error('Error:', e);
    }
};

run();
