import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import watchlistRouter from './routes/watchlist.js';
import priceRouter from './routes/price.js';
import explainRouter from './routes/explain.js';
import diffRouter from './routes/diff.js';
import chartRouter from './routes/chart.js';
import metaRouter from './routes/meta.js';
import { startPricePoller } from './services/pricePoller.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Routes
app.use('/api/watchlist', watchlistRouter);
app.use('/api/prices', priceRouter);
app.use('/api/explain', explainRouter);
app.use('/api/diff', diffRouter);
app.use('/api/chart', chartRouter);
app.use('/api/meta', metaRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  // Start background price polling every 25 seconds
  startPricePoller(25_000);
});
