import dotenv from 'dotenv';
import OpenAI from 'openai';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { ChatService } from './services/chatService.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

if (!process.env.OPENAI_API_KEY) {
  console.error('Set OPENAI_API_KEY in .env before starting the demo.');
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000, maxRetries: 0 });
const chatService = new ChatService(client, process.env.OPENAI_MODEL || 'gpt-4o-mini');
const port = Number(process.env.PORT || 8080);

createApp(chatService).listen(port, '127.0.0.1', () => {
  console.log(`Vision Chat is running at http://localhost:${port}`);
});
