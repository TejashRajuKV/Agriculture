import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import CropPrice from './models/CropPrice.js';
import { csvMarket } from './services/agmarknetCsv.js';
import { UPLOAD_DIR } from './utils/imageStore.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import { centersRouter, bookingsRouter } from './routes/procurement.js';
import managerRoutes from './routes/manager.js';
import notificationRoutes from './routes/notifications.js';
import marketplaceRoutes, { cropsRouter } from './routes/marketplace.js';
import orderRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboard.js';
import wasteRoutes from './routes/waste.js';
import poolRoutes from './routes/pools.js';
import mandiRoutes from './routes/mandi.js';
import fpoRoutes from './routes/fpo.js';
import alertRoutes from './routes/alerts.js';
import machineRoutes from './routes/machines.js';
import schemeRoutes from './routes/schemes.js';
import logisticsRoutes from './routes/logistics.js';
import intelligenceRoutes from './routes/intelligence.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';

// Builds the Express app without starting it, so tests can run it against a test DB.
export const createApp = () => {
  const app = express();

  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      console.log(`--> ${req.method} ${req.url}`);
      next();
    });
  }

  // Basic hardening headers (this is a JSON API plus uploaded images)
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-site' });
    next();
  });

  // The browser reaches the API through the Vite proxy; direct calls only from the dev client
  app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',') }));
  // Listing photos arrive as data URLs (up to 3 MB each)
  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

  const mongoReady = () => mongoose.connection.readyState === 1;

  // --- Market data: MongoDB when it has data, otherwise the AGMARKNET CSV ---
  const listMarketCrops = async () => {
    if (mongoReady()) {
      const crops = await CropPrice.distinct('crop');
      if (crops.length) return { source: 'mongodb', crops };
    }
    return { source: csvMarket.source() ? 'agmarknet-csv' : 'none', crops: csvMarket.listCrops() };
  };

  const getMarketCropData = async (crop) => {
    if (mongoReady()) {
      const priceHistory = await CropPrice.find({ crop }).sort({ date: -1 }).limit(7);
      if (priceHistory.length) {
        const currentPrice = priceHistory[0].price;
        const previousPrice = priceHistory.length > 1 ? priceHistory[1].price : currentPrice;
        const percentageChange = ((currentPrice - previousPrice) / previousPrice) * 100;
        return {
          crop,
          price: currentPrice,
          previousPrice,
          trend: percentageChange > 2 ? 'UP' : percentageChange < -2 ? 'DOWN' : 'STABLE',
          percentageChange,
          last7Days: priceHistory.reverse().map((record) => ({
            date: record.date.toISOString().split('T')[0],
            price: record.price
          })),
          source: 'mongodb'
        };
      }
    }
    const row = csvMarket.getCrop(crop);
    return row ? { ...row, source: 'agmarknet-csv' } : null;
  };

  // Root route with API status
  app.get('/', (req, res) => {
    res.json({
      message: 'AgriLoop API Server is running',
      status: 'healthy',
      endpoints: {
        health: '/api/health',
        crops: '/api/market/crops',
        cropPrice: '/api/market/crop/:crop'
      }
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mongodb: mongoReady() ? 'connected' : 'disconnected',
      marketCsv: csvMarket.source() || 'missing'
    });
  });

  app.get('/api/market/crops', async (req, res) => {
    try {
      const { source, crops } = await listMarketCrops();
      res.json({ success: true, source, data: crops });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const cropHandler = async (req, res) => {
    try {
      const data = await getMarketCropData(req.params.crop);
      if (!data) {
        return res.status(404).json({ success: false, error: `No data for ${req.params.crop}` });
      }
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  app.get('/api/market/crop/:crop', cropHandler);
  // Older path kept for compatibility
  app.get('/api/market/:crop', cropHandler);

  // --- Platform APIs ---
  app.use('/api/auth', authRoutes);
  app.use('/api/crops', cropsRouter);
  app.use('/api/procurement-centers', centersRouter);
  app.use('/api/procurement', bookingsRouter);
  app.use('/api/manager', managerRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/marketplace', marketplaceRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/waste', wasteRoutes);
  app.use('/api/pools', poolRoutes);
  app.use('/api/mandi', mandiRoutes);
  app.use('/api/fpo', fpoRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/machines', machineRoutes);
  app.use('/api/schemes', schemeRoutes);
  app.use('/api/logistics', logisticsRoutes);
  app.use('/api/intelligence', intelligenceRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/public', publicRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
};
