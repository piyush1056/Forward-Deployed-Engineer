import { Router } from 'express';
import { chatEndpoint } from '../controllers/chatController.js';

const router = Router();
router.post('/chat', chatEndpoint);

export default router;