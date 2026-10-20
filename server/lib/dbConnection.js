const mongoose = require("mongoose");
require("dotenv").config();
// Function to connect to the database
const connectToDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error("Set MONGODB_URI in the server environment before starting the server");
    }
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10,
    });
    console.log("Successfully connected to the database");
  } catch (error) {
    console.error("Error connecting to the database:", error.message);
    throw error;
  }
};

module.exports = connectToDatabase;
