import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
let db;
const client = new MongoClient(process.env.MONGODB_URI);

async function connectDB() {
  try {
    await client.connect();
    db = client.db();
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

connectDB();

// Helper functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Routes
app.post('/users', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const newUser = {
      username,
      password,
      createdAt: new Date()
    };
    
    const userResult = await db.collection('users').insertOne(newUser);
    
    // Create account for user
    const newAccount = {
      userId: userResult.insertedId,
      amount: 0,
      createdAt: new Date()
    };
    
    await db.collection('accounts').insertOne(newAccount);
    
    res.status(201).json({ 
      message: 'User created successfully',
      userId: userResult.insertedId 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sessions', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await db.collection('users').findOne({ username, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateOTP();
    await db.collection('sessions').insertOne({
      userId: user._id,
      token,
      createdAt: new Date()
    });
    
    res.json({ 
      token, 
      userId: user._id 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/me/accounts', async (req, res) => {
  try {
    const { userId, token } = req.body;
    
    const session = await db.collection('sessions').findOne({ 
      userId: new ObjectId(userId), 
      token 
    });
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const account = await db.collection('accounts').findOne({ 
      userId: new ObjectId(userId) 
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({ amount: account.amount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/me/accounts/transactions', async (req, res) => {
  try {
    const { userId, token, amount } = req.body;
    
    const session = await db.collection('sessions').findOne({ 
      userId: new ObjectId(userId), 
      token 
    });
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    if (isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const result = await db.collection('accounts').updateOne(
      { userId: new ObjectId(userId) },
      { $inc: { amount: parseFloat(amount) } }
    );
    
    const updatedAccount = await db.collection('accounts').findOne({ 
      userId: new ObjectId(userId) 
    });
    
    res.json({ 
      message: 'Transaction successful',
      newBalance: updatedAccount.amount 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});