import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config/env';

const pc = new Pinecone({ apiKey: config.pineconeApiKey });
const index = pc.index(config.pineconeIndexName);

//Upserts vectors with id, values, and metadata into Pinecone 
export async function upsertVectors(vectors) {
  if (!vectors || vectors.length === 0) return;
  await index.upsert(vectors);
}

// Searches Pinecone for top-K matching policy chunks
export async function queryVectorStore(queryEmbedding, topK = 3) {
  const results = await index.query({
    vector: queryEmbedding,
    topK: topK,
    includeMetadata: true,
  });

  // Extract text chunks from metadata matches
  return results.matches.map(match => match.metadata.text);
}