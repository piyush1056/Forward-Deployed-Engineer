import app from './app.js';
import { env } from './config/env.js';
import { initCatalog } from './services/recommendationService.js';

async function startServer() {
  try {
    // Precompute embeddings for all movies before taking requests
    await initCatalog();

    app.listen(env.port, () => {
      console.log(`Server running at http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();