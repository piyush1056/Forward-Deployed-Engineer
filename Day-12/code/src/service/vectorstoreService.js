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
export async function queryVectorStore(queryEmbedding, topK = 15, filter) {
  const results = await index.query({
    vector: queryEmbedding,
    topK: topK,
    includeMetadata: true,
    filter: filter,
  });

  // Extract chunks all details for  RRF ,reranking 
 return results.matches.map(match => ({
    id: match.id,
    score: match.score,
    text: match.metadata?.text || "",
    source: match.metadata?.source,
    chunkIndex: match.metadata?.chunkIndex,
  }));
}

  