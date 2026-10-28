import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiUnavailableError, searchAnts } from '../services/inaturalist.js';

export const catalogRouter = Router();

catalogRouter.get('/search', requireAuth, requireRole('auctioneer'), async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    return res.status(400).json({ error: 'Digite pelo menos 2 letras para buscar.' });
  }
  try {
    const { items, stale } = await searchAnts(q);
    res.json({ items, stale });
  } catch (erro) {
    if (erro instanceof ApiUnavailableError) {
      return res.status(503).json({
        error: 'A API de formigas está indisponível agora. Tente de novo em instantes.',
      });
    }
    throw erro;
  }
});