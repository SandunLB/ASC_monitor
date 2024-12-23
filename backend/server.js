import express from 'express';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Function to properly format the private key
function formatPrivateKey(key) {
  const trimmedKey = key.startsWith('"') && key.endsWith('"') 
    ? key.slice(1, -1) 
    : key;
  return trimmedKey.replace(/\\n/g, '\n');
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

const db = admin.firestore();

app.use(express.json());

app.post('/update', async (req, res) => {
  try {
    const { email, username, reviewCount } = req.body;
    
    if (!email || !username || reviewCount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userRef = db.collection('users').doc(email);
    
    // Get the current data
    const doc = await userRef.get();
    let data = doc.exists ? doc.data() : { dataPoints: [] };
    
    // Add new data point
    data.dataPoints.push({
      timestamp: Date.now(),
      reviewCount: reviewCount
    });
    
    // Keep only the last 3 data points
    if (data.dataPoints.length > 3) {
      data.dataPoints = data.dataPoints.slice(-3);
    }
    
    // Update the document
    await userRef.set({
      username: username,
      email: email,
      dataPoints: data.dataPoints
    });

    res.json({ message: 'Data updated successfully' });
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New endpoint to get the latest data for a given email
app.get('/latest/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = doc.data();
    const latestDataPoint = userData.dataPoints[userData.dataPoints.length - 1];

    res.json({
      email: userData.email,
      username: userData.username,
      latestReviewCount: latestDataPoint.reviewCount,
      timestamp: latestDataPoint.timestamp
    });
  } catch (error) {
    console.error('Error retrieving latest data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});