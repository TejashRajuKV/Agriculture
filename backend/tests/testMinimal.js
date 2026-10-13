import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Test server working' });
});

app.get('/api/market/crops', (req, res) => {
  res.json({ 
    success: true, 
    data: ['Wheat', 'Rice', 'Maize'] 
  });
});

app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/api/health`);
});