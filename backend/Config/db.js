const mongoose = require('mongoose');
const os = require('os');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      w: 'majority',
      runtimeAdapters: { os },
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
