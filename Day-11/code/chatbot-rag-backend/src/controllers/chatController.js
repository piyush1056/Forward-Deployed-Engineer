import { handleRAGQuery } from '../service/ragService';

export async function chatEndpoint(req, res) {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required in request body." });
    }

    const result = await handleRAGQuery(question);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("RAG Chat Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}