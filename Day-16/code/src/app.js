import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { createChatRouter } from './routes/chatRoute';

const directory = path.dirname(fileURLToPath(import.meta.url));

export function createApp(chatService) {
  const app = express();

  app.use(express.static(path.join(directory, '../public')));
  app.use('/api/chat', createChatRouter(chatService));

  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).type('text').send(
        status === 413 ? 'Maximum image size is 10 MB.' : 'Invalid multipart upload.',
      );
    }
    if (error.status === 400) {
      return res.status(400).type('text').send(error.message);
    }
    res.status(502).type('text').send('Unable to get an AI response. Check your API key and try again.');
  });

  return app;
}
