import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbedding, getBatchEmbeddings } from './embeddingService.js';
import { cosineSimilarity } from '../utils/math.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory movie store (cached with precomputed vectors)
let movieCatalog = [];

/**
 * Precomputes and attaches embedding vectors to every movie on server boot.
 */
export async function initCatalog() {
  const filePath = path.join(__dirname, '../../data/movies.json');
  const rawData = await fs.readFile(filePath, 'utf-8');
  const movies = JSON.parse(rawData);

  // Combine title and description to give maximum semantic context
  const textsToEmbed = movies.map((m) => `${m.title}: ${m.description}`);

  console.log(`Precomputing embeddings for ${movies.length} movies...`);
  const vectors = await getBatchEmbeddings(textsToEmbed);

  // Store movies in memory with IDs and precomputed vectors
  movieCatalog = movies.map((movie, index) => ({
    id: movie.id || index + 1,
    title: movie.title,
    description: movie.description,
    embedding: vectors[index]
  }));

  console.log('Movie catalog embeddings loaded in memory.');
}

/**
 * Feature 1: Semantic Search
 * Query -> Embedding -> Cosine Similarity -> Rank
 */
export async function searchMovies(queryText, topK = 3) {
  const queryVector = await getEmbedding(queryText);

  const scoredMovies = movieCatalog.map((movie) => ({
    id: movie.id,
    title: movie.title,
    description: movie.description,
    score: Number(cosineSimilarity(queryVector, movie.embedding).toFixed(4))
  }));

  // Sort descending by score and pick top K
  return scoredMovies
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Feature 2: Similar Movie Recommendations
 * Target Movie Vector -> Cosine Similarity -> Rank (excluding itself)
 */
export function recommendSimilar(movieId, topK = 3) {
  const targetMovie = movieCatalog.find((m) => m.id === Number(movieId));
  if (!targetMovie) {
    throw new Error(`Movie with ID ${movieId} not found`);
  }

  const scoredMovies = movieCatalog
    .filter((movie) => movie.id !== targetMovie.id) // Exclude current movie
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      description: movie.description,
      score: Number(cosineSimilarity(targetMovie.embedding, movie.embedding).toFixed(4))
    }));

  // Sort descending by score and pick top K
  return scoredMovies
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}