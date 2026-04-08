import axios from 'axios';

const run = async () => {
    try {
        // 1. Login as admin
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'admin@hybridride.com', // assuming this is the admin email
            password: 'admin' // or whatever it is, wait, what is the admin credentials?
        });
        
        console.log('Login success:', loginRes.data.success);
        const token = loginRes.data.data.token;

        // 2. Fetch passengers
        const passRes = await axios.get('http://localhost:5000/api/admin/passengers', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('Passengers fetched:', passRes.data.data.length);
        console.log(passRes.data.data[0]);

    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
};

run();
