import express from 'express';
import apiRouter from './route';

const app = express();

app.use(express.json());


app.use('/api', apiRouter);

app.use((err, req, res, next) => {
  console.error('Core App Error Caught:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Fatal Internal Server Exception',
  });
});

export default app;
