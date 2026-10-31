import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiUnavailableError, searchAnts } from "../services/inaturalist.js";

export const catalogRouter = Router();

catalogRouter.get(
  "/search",
  requireAuth,
  requireRole("auctioneer"),
  async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      return res
        .status(400)
        .json({ error: "Digite pelo menos 2 letras para buscar." });
    }
    const pagina = Math.min(
      Math.max(Number.parseInt(req.query.page, 10) || 1, 1),
      50,
    );
    try {
      const { items, hasMore, stale } = await searchAnts(q, pagina);
      res.json({ items, page: pagina, has_more: hasMore, stale });
    } catch (erro) {
      if (erro instanceof ApiUnavailableError) {
        return res.status(503).json({
          error:
            "A API de formigas está indisponível agora. Tente de novo em instantes.",
        });
      }
      throw erro;
    }
  },
);
