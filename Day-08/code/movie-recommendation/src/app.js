import express from 'express';
import movieRoutes from './routes/movieRoutes.js';

const app = express();

app.use(express.json());

app.use('/api/movies', movieRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

export default app;