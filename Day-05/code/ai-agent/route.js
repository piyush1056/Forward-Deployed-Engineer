import express from 'express';
import { runGeneralChat, runWebsiteGeneration } from './chatService';

const router = express.Router();

router.post('/agent/chat', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Field "message" required.' });

    const reply = await runGeneralChat(message);
    res.status(200).json({ success: true, result: reply });
  } catch (error) {
    next(error);
  }
});

router.post('/agent/generate-site', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Field "message" required.' });

    const reply = await runWebsiteGeneration(message);
    res.status(200).json({ success: true, result: reply });
  } catch (error) {
    next(error);
  }
});

export default router;
