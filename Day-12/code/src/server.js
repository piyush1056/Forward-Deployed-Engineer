import app from './app.js';
import { config } from './config/env.js';

function startServer() {
  app.listen(config.port, () => {
    console.log(`ShopSphere Advanced RAG Server running on port ${config.port}`);
  });
}

startServer();