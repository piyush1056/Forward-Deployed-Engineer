import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import MiniSearch from 'minisearch';
import { encoding_for_model } from 'tiktoken';

// Support CommonJS modules in ES module files
const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory MiniSearch index and caching flag
let searchIndex = null;
let isInitialized = false;

/**
 * Extracts plain text from a PDF Buffer, supporting both pdf-parse v1 and v2
 * @param {Buffer} buffer - Raw PDF buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractPdfText(buffer) {
  if (typeof pdfParseModule === 'function') {
    const data = await pdfParseModule(buffer);
    return data.text || '';
  }
  if (pdfParseModule?.PDFParse) {
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    const result = await parser.getText();
    return result?.text || '';
  }
  return '';
}

/**
 * Splits extracted document text into overlapping chunks using tiktoken.
 * Uses the exact same parameters (500 token chunk size, 100 token overlap)
 * as the Pinecone ingestion pipeline.
 * 
 * @param {string} text - Raw document text
 * @param {number} chunkSize - Number of tokens per chunk
 * @param {number} overlap - Number of overlapping tokens between consecutive chunks
 * @returns {Array<string>} - Array of chunk text strings
 */
function chunkTextWithTiktoken(text, chunkSize = 500, overlap = 100) {
  const enc = encoding_for_model("gpt-4o-mini");
  const tokens = enc.encode(text);
  const chunks = [];

  for (let i = 0; i < tokens.length; i += (chunkSize - overlap)) {
    const chunkTokens = tokens.slice(i, i + chunkSize);
    if (chunkTokens.length === 0) break;

    const chunkString = new TextDecoder().decode(enc.decode(chunkTokens));
    chunks.push(chunkString.trim());

    if (i + chunkSize >= tokens.length) break;
  }

  enc.free();
  return chunks;
}

/**
 * Generates the identical unique SHA-256 hash ID for each chunk as the vector store.
 * This allows Reciprocal Rank Fusion (RRF) to merge and correlate matches by chunk ID.
 * 
 * @param {string} sourceName - Document filename (e.g. 'return-policy.pdf')
 * @param {number} chunkIndex - Zero-based chunk position within the document
 * @param {string} text - Text content of the chunk
 * @returns {string} - Hex-encoded SHA-256 hash
 */
function generateChunkId(sourceName, chunkIndex, text) {
  return crypto
    .createHash('sha256')
    .update(`${sourceName}_${chunkIndex}_${text}`)
    .digest('hex');
}

/**
 * Loads the 4 policy PDFs from Day-11, creates chunks, and indexes them in MiniSearch.
 * The index is kept in memory so files are parsed only once on initial search.
 */
async function initializeKeywordIndex() {
  if (isInitialized && searchIndex) {
    return;
  }

  // 1. Initialize MiniSearch with field configurations
  searchIndex = new MiniSearch({
    fields: ['text'],                                    // Fields indexed for keyword matching
    storeFields: ['id', 'text', 'source', 'chunkIndex'], // Metadata fields stored and returned
    searchOptions: {
      boost: { text: 1 },
      fuzzy: 0.2,                                        // Allow slight typo tolerance (e.g., refnd -> refund)
      prefix: true                                       // Match prefix terms
    }
  });

  // 2. Resolve directory containing Day-11 policy PDFs
  const primaryPoliciesDir = path.resolve(__dirname, '../../../../Day-11/code/chatbot-rag-backend/src/policies');
  const localPoliciesDir = path.resolve(__dirname, '../policies');
  const policiesDir = fs.existsSync(primaryPoliciesDir) ? primaryPoliciesDir : localPoliciesDir;

  if (!fs.existsSync(policiesDir)) {
    console.warn(`[KeywordSearch] Policy directory not found at: ${policiesDir}`);
    isInitialized = true;
    return;
  }

  const pdfFiles = fs.readdirSync(policiesDir).filter(file => file.toLowerCase().endsWith('.pdf'));
  const documentsToIndex = [];

  // 3. Parse each PDF, chunk text, and prepare documents for search index
  for (const file of pdfFiles) {
    const filePath = path.join(policiesDir, file);
    const dataBuffer = fs.readFileSync(filePath);
    const fullText = await extractPdfText(dataBuffer);

    if (!fullText.trim()) continue;

    const chunks = chunkTextWithTiktoken(fullText, 500, 100);

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const chunkId = generateChunkId(file, i, chunkText);

      documentsToIndex.push({
        id: chunkId,
        text: chunkText,
        source: file,
        chunkIndex: i,
      });
    }
  }

  // 4. Index all chunks into MiniSearch
  if (documentsToIndex.length > 0) {
    searchIndex.addAll(documentsToIndex);
    console.log(`[KeywordSearch] Successfully indexed ${documentsToIndex.length} chunks from ${pdfFiles.length} policy PDFs.`);
  }

  isInitialized = true;
}

/**
 * Searches policy chunks by keywords using MiniSearch (BM25-style lexical scoring).
 * 
 * Returns candidates in the exact format required by reciprocalRankFusion (rrfService.js):
 * [
 *   {
 *     id: string,
 *     score: number,
 *     text: string,
 *     source: string,
 *     chunkIndex: number
 *   }
 * ]
 * 
 * @param {string} userQuery - The user query to search for
 * @param {number} topK - Maximum number of candidate chunks to return (default: 15)
 * @returns {Promise<Array<{id: string, score: number, text: string, source: string, chunkIndex: number}>>}
 */
export async function searchByKeywords(userQuery, topK = 15) {
  if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
    return [];
  }

  // Ensure policy index is loaded
  await initializeKeywordIndex();

  if (!searchIndex) {
    return [];
  }

  // Execute BM25/keyword search across indexed chunks
  const results = searchIndex.search(userQuery);

  // Return formatted candidate objects matching Pinecone vector store schema
  return results.slice(0, topK).map(result => ({
    id: result.id,
    score: result.score,
    text: result.text,
    source: result.source,
    chunkIndex: result.chunkIndex,
  }));
}
