import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

async function testUpload() {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Test Driver',
      email: 'testdriveru1@example.com',
      phone: '9998887771',
      password: 'password123',
      role: 'driver',
      vehicle: {
          make: 'Toyota',
          model: 'Corolla',
          year: 2022,
          plateNumber: 'ABC-1234'
      }
    });
    const token = loginRes.data.data.token;
    console.log("Registered, token:", token);

    fs.writeFileSync('dummy.jpg', 'dummy image content');

    const form = new FormData();
    form.append('docType', 'licenseFront');
    form.append('document', fs.createReadStream('dummy.jpg'), {
        filename: 'dummy.jpg',
        contentType: 'image/jpeg'
    });

    const uploadRes = await axios.post('http://localhost:5000/api/driver/upload', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log("Upload Success:", uploadRes.data);
  } catch(e) {
    if(e.response) {
      console.log("Upload failed with response:", e.response.status, e.response.data);
    } else {
      console.log("Upload failed with completely crash/network error:", e.message);
    }
  }
}
testUpload();
