import dotenv from 'dotenv';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY is missing in your .env file.');
  process.exit(1);
}

export const env = {
  port: process.env.PORT || 3000,
  openAiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
};