import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Hide credentials when logging a connection string
const redact = (uri) => String(uri).replace(/\/\/([^@/]+)@/, '//***@');

const connectDB = async (uri = process.env.MONGODB_URI) => {
  console.log(`🔌 Connecting to MongoDB at ${redact(uri)} ...`);
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    // Make sure unique indexes (booking/token/slot rules) exist before traffic arrives
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('   Is the MongoDB service running? Check MONGODB_URI in backend/.env');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err.message);
});

export default connectDB;
