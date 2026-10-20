import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config/env';

const pc = new Pinecone({ apiKey: config.pineconeApiKey });

// Reorders retrieved chunks based on relevance to the user's query
export async function rerank(userQuery, candidates) {
  if (!candidates || candidates.length === 0) return '';

  const response = await pc.inference.rerank({
    model: 'bge-reranker-v2-m3',
    query: userQuery,
    documents: candidates.map((doc) => doc.text),
    topN: 5,
    returnDocuments: true,
  });

  // Combine the top-ranked chunks into context for the LLM
  return response.data
    .map((item) => item.document.text)
    .join('\n\n---\n\n');
}
