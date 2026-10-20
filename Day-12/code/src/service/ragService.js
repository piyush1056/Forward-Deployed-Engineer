import { generateEmbedding, getLLMResponse } from './embeddingService';
import { queryVectorStore } from './vectorstoreService';
import {reciprocalRankFusion} from './rrfService';
import {rerank} from './rerankingService';
import {searchByKeywords} from './keywordSearchService';

export async function handleRAGQuery(userQuery) {
  // 1: Embed user query
  const queryEmbedding = await generateEmbedding(userQuery);

 
  // 2. Fetch dense and sparse results concurrently
  const [vectorCandidates, bm25Candidates] = await Promise.all([
    queryVectorStore(queryEmbedding, 15),
    searchByKeywords(userQuery, 15),
  ]);

  // 3. Fuse rankings without raw score conflicts
  const fusedCandidates = reciprocalRankFusion(vectorCandidates, bm25Candidates);

  // 4. Take top pool (e.g., top 10-15) and pass to reranker 
  const topCandidates = fusedCandidates.slice(0, 15);
  const contextText = await rerank(userQuery, topCandidates);

  // 5: Define system instructions 
  const systemPrompt = `You are a helpful customer support AI for ShopSphere. Answer the user's question accurately using ONLY the provided ShopSphere policy context (refunds, returns, cancellations, etc.). If the answer cannot be found in the context, politely state that you don't know and advise them to contact live support. Do not make up policies.`;

  // 6: Generate precise answer from OpenAI LLM
  const answer = await getLLMResponse(systemPrompt, contextText, userQuery);

  return {
    answer,
    sourcesUsed: topCandidates,
  };
}