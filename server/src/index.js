import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { walletRouter } from "./routes/wallet.js";
import { catalogRouter } from "./routes/catalog.js";
import { lotsRouter } from "./routes/lots.js";
import { bidsRouter } from "./routes/bids.js";
import { auditRouter } from "./routes/audit.js";
import { receiptsRouter } from "./routes/receipts.js";
import { meRouter } from "./routes/me.js";
import { initRealtime } from "./services/realtime.js";
import { startSettler } from "./services/settlement.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hora: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/lots", lotsRouter);
app.use("/api/lots", bidsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/receipts", receiptsRouter);
app.use("/api/me", meRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

const pastaFront = fileURLToPath(new URL("../../client/dist", import.meta.url));
if (fs.existsSync(pastaFront)) {
  app.use(express.static(pastaFront));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(pastaFront, "index.html"));
  });
}

app.use((erro, req, res, next) => {
  if (erro.status && erro.status < 500) {
    return res.status(erro.status).json({ error: "Requisição inválida." });
  }
  console.error(erro);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const server = http.createServer(app);
initRealtime(server);
startSettler();

server.listen(config.port, () => {
  console.log(`Servidor rodando em http://localhost:${config.port}`);
});
