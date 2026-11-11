import { Router } from 'express';
import { search, recommend } from '../controllers/movieController.js';

const router = Router();

router.post('/search', search);
router.get('/recommend/:id', recommend);

export default router;