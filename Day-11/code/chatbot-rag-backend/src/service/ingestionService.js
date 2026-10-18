import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import { encoding_for_model } from 'tiktoken';
import { generateEmbedding } from './embeddingService.js';
import { upsertVectors } from './vectorStoreService.js';

/**
 * Splits text into overlapping token chunks using tiktoken
 */
export function chunkTextWithTiktoken(text, chunkSize = 500, overlap = 100) {
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
 * Generates a consistent unique SHA-256 hash ID for a chunk
 */
export function generateChunkId(sourceName, chunkIndex, text) {
  return crypto
    .createHash('sha256')
    .update(`${sourceName}_${chunkIndex}_${text}`)
    .digest('hex');
}

/**
 * Ingestion pipeline:
 * 1. Reads PDF files from the documents folder
 * 2. Parses text from each PDF
 * 3. Splits text into chunks using tiktoken
 * 4. Generates unique hashes for IDs
 * 5. Creates embeddings via OpenAI
 * 6. Upserts vectors into Pinecone
 */
export async function runIngestionPipeline(docsDir = path.resolve(process.cwd(), 'src', 'policies')) {
  console.log(`Starting ingestion pipeline from: ${docsDir}`);

  if (!fs.existsSync(docsDir)) {
    console.warn(`Documents directory not found at: ${docsDir}. Skipping ingestion.`);
    return;
  }

  const files = fs.readdirSync(docsDir).filter(file => file.toLowerCase().endsWith('.pdf'));

  if (files.length === 0) {
    console.log("No PDF files found to ingest.");
    return;
  }

  const allVectors = [];

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    console.log(`Processing: ${file}`);

    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const fullText = pdfData.text || '';

    if (!fullText.trim()) {
      console.warn(`Warning: No extractable text found in ${file}`);
      continue;
    }

    const chunks = chunkTextWithTiktoken(fullText, 500, 100);
    console.log(`Generated ${chunks.length} chunks for ${file}`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const chunkId = generateChunkId(file, i, chunkText);
      const embedding = await generateEmbedding(chunkText);

      allVectors.push({
        id: chunkId,
        values: embedding,
        metadata: {
          source: file,
          chunkIndex: i,
          text: chunkText,
        },
      });
    }
  }

  if (allVectors.length > 0) {
    // Upsert in batches of 100 to stay within limits
    const batchSize = 100;
    for (let i = 0; i < allVectors.length; i += batchSize) {
      const batch = allVectors.slice(i, i + batchSize);
      await upsertVectors(batch);
      console.log(`Upserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} vectors) to Pinecone`);
    }
    console.log(`Ingestion completed successfully. Total vectors upserted: ${allVectors.length}`);
  } else {
    console.log("No vectors generated for ingestion.");
  }
}
