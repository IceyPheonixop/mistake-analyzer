const mongoose = require('mongoose');

let isConnected = false;

async function connectToDatabase() {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is missing.');
  }

  await mongoose.connect(uri, {
    bufferCommands: false, // Disables 10s buffering so connection errors surface immediately
  });

  isConnected = true;
}

module.exports = connectToDatabase;