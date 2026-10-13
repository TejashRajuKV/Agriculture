import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { createApp } from './app.js';
import { csvMarket } from './services/agmarknetCsv.js';
import { deliverDueReminders } from './services/schemeService.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in backend/.env (e.g. mongodb://127.0.0.1:27017/agriloop)');
  process.exit(1);
}
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error('❌ AUTH_SECRET (32+ random characters) is not set in backend/.env');
  process.exit(1);
}

// Connect first so no request ever runs against a missing database
await connectDB();

// Send scheme reminders that have come due (now, then hourly). Never lets a failure stop the server.
const sendReminders = () => deliverDueReminders().catch((err) => console.error('Reminder run failed:', err.message));
sendReminders();
setInterval(sendReminders, 60 * 60 * 1000).unref();

createApp().listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Market prices: MongoDB if seeded, otherwise CSV (${csvMarket.source() || 'none found'})`);
});
