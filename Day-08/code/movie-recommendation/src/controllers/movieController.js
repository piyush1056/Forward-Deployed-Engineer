import { searchMovies, recommendSimilar } from '../services/recommendationService.js';


export async function search(req, res) {
  try {
    const { query, topK } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'A text "query" is required' });
    }

    const results = await searchMovies(query, topK ? Number(topK) : 3);
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Failed to process semantic search' });
  }
}


export function recommend(req, res) {
  try {
    const { id } = req.params;
    const { topK } = req.query;

    const results = recommendSimilar(id, topK ? Number(topK) : 3);
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Recommendation error:', error.message);
    res.status(404).json({ error: error.message });
  }
}