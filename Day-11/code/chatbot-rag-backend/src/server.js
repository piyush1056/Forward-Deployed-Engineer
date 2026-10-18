import app from './app.js';
import { config } from './config/env.js';
import { runIngestionPipeline } from './service/ingestionService.js';

async function startServer() {
  try {
    // Populate/ensure vector store is up-to-date before accepting queries
    console.log("Initializing vector store ingestion...");
    await runIngestionPipeline();

    app.listen(config.port, () => {
      console.log(`ShopSphere Policy RAG Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server during initialization:", error);
    process.exit(1);
  }
}

startServer();