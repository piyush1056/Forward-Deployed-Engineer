# Advanced RAG Pipeline (Day 12)

This document explains the end-to-end workflow of the Advanced RAG pipeline and highlights what extra techniques were added compared to basic RAG.

---

## 1. End-to-End Workflow Diagram

```text
                      [ 1. User Query ]
                             │
                             ├─────────────────────────────────────────┐
                             ▼                                         ▼
                 [ Generate Embedding ]                             [ Raw Query ]
                 (text-embedding-3-small)                                  │
                             │                                         │
                             ▼                                         ▼
                  [ Dense Vector Search ]                   [ Sparse Keyword Search ]
                  (Pinecone Top-15 Chunks)                  (MiniSearch / BM25 Top-15)
                             │                                         │
                             └───────────────────┬─────────────────────┘
                                                 ▼
                                  [ Reciprocal Rank Fusion (RRF) ]
                                   Combines & deduplicates rankings
                                                 │
                                                 ▼
                                        [ Top-15 Candidates ]
                                                 │
                                                 ▼
                                        [ Two-Stage Reranking ]
                                        (Pinecone bge-reranker)
                                                 │
                                                 ▼
                                        [ Top-5 Best Chunks ]
                                                 │
                                                 ▼
                                    [ Build Structured Prompt ]
                                                 │
                                                 ▼
                                         [ OpenAI LLM Call ]
                                           (gpt-4o-mini)
                                                 │
                                                 ▼
                                          [ Final Answer ]
```

---

## 2. Step-by-Step Breakdown

| Step | Action | Service File | What Happens |
| :--- | :--- | :--- | :--- |
| **1. Input** | User Query | `chatController.js` | Receives `{ question }` from the client request. |
| **2. Parallel Retrieval** | Dense + Sparse Search | `vectorstoreService.js`<br>`keywordSearchService.js` | Runs both searches concurrently via `Promise.all`: <br>• **Vector Search:** Finds chunks with matching semantic meaning.<br>• **Keyword Search:** Finds chunks with exact words, model numbers, or terms. |
| **3. Fusion** | Reciprocal Rank Fusion (RRF) | `rrfService.js` | Merges the two lists using rank position (`1 / (60 + rank)`), eliminating score mismatch issues between cosine similarity and BM25 scores. |
| **4. Reranking** | Cross-Encoder Scoring | `rerankingService.js` | Evaluates the `(query, chunk)` pairs together using a cross-encoder model to pick the most accurate top 5 chunks. |
| **5. Generation** | Context + LLM | `embeddingService.js` | Combines top policy chunks into context and asks the LLM to generate an accurate answer without hallucinations. |

---

## 3. What Extra Does Day 12 Do vs Basic RAG?

1. **Parallel Hybrid Search (Dense + Sparse):**
   - *Basic RAG:* Only does semantic vector search (often misses exact keywords or policy names).
   - *Day 12:* Runs vector search AND keyword search side by side.

2. **Reciprocal Rank Fusion (RRF):**
   - Balances conceptual understanding with exact keyword matches fairly without conflict.

3. **Two-Stage Reranking:**
   - Instead of blindly trusting vector distance, a cross-encoder evaluates full query-document context, moving the exact required policy clause straight to the top.
