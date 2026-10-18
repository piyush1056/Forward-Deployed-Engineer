import { generateEmbedding, getLLMResponse } from './embeddingService';
import { queryVectorStore } from './vectorStoreService';

export async function handleRAGQuery(userQuery) {
  // 1: Embed user query
  const queryEmbedding = await generateEmbedding(userQuery);

  // 2: Retrieve top relevant chunks from Pinecone
  const retrievedChunks = await queryVectorStore(queryEmbedding, 3);
  const contextText = retrievedChunks.join("\n\n---\n\n");

  // 3: Define system instructions 
  const systemPrompt = `You are a helpful customer support AI for ShopSphere. Answer the user's question accurately using ONLY the provided ShopSphere policy context (refunds, returns, cancellations, etc.). If the answer cannot be found in the context, politely state that you don't know and advise them to contact live support. Do not make up policies.`;

  // 4: Generate precise answer from OpenAI LLM
  const answer = await getLLMResponse(systemPrompt, contextText, userQuery);

  return {
    answer,
    sourcesUsed: retrievedChunks,
  };
}