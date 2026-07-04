require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharma_mgmt';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api', apiRoutes);

// Root path diagnostic route
app.get('/', (req, res) => {
  res.json({ message: 'Pharma Management System API is running.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something broke on the server!' });
});

const https = require('https');

// Keep-alive scheduler to prevent Render free tier from sleeping
const startKeepAlive = () => {
  const url = 'https://pharoxrx.onrender.com/';
  console.log(`[Keep-Alive] Initializing self-ping scheduler for: ${url}`);
  
  // Ping every 10 minutes (600,000 ms)
  setInterval(() => {
    https.get(url, (res) => {
      console.log(`[Keep-Alive] Self-ping successful. Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('[Keep-Alive] Self-ping failed:', err.message);
    });
  }, 600000); 
};

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      startKeepAlive();
    });
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });
