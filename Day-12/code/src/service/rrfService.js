
//Merges and scores items from semantic and keyword search lists using RRF.

 function reciprocalRankFusion(vectorResults = [], keywordResults = [], k = 60) {
  const scoreMap = new Map();
  const docMap = new Map();

  const rankLists = [vectorResults, keywordResults];

  rankLists.forEach((list) => {
    list.forEach((doc, index) => {
      const docId = doc.id;
      const rank = index + 1; // 1-based index position
      const currentScore = scoreMap.get(docId) || 0;

      // Add points based on rank position
      scoreMap.set(docId, currentScore + 1 / (k + rank));

      // Retain document content and metadata
      if (!docMap.has(docId)) {
        docMap.set(docId, doc);
      }
    });
  });

  // Sort descending by calculated RRF score
  return Array.from(scoreMap.entries())
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .map(([id, rrfScore]) => ({
      ...docMap.get(id),
      rrfScore,
    }));
}