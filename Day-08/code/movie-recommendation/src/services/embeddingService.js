import { openai } from '../config/openai.js';
import { env } from '../config/env.js';


export async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: env.embeddingModel,
    input: text
  });

  return response.data[0].embedding;
}


//Generates embeddings for an array of texts in one batch API request.
export async function getBatchEmbeddings(texts) {
  const response = await openai.embeddings.create({
    model: env.embeddingModel,
    input: texts   //array of strings  [movie1:des ,movie2:des...]
  });

  return response.data.map((item) => item.embedding);
}