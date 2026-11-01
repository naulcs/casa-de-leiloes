import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
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
app.set("trust proxy", 1);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
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

const clientDir = fileURLToPath(new URL("../../client/dist", import.meta.url));
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.use((error, req, res, next) => {
  if (error.status && error.status < 500) {
    return res.status(error.status).json({ error: "Requisição inválida." });
  }
  console.error(error);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const server = http.createServer(app);
initRealtime(server);
startSettler();

server.listen(config.port, () => {
  console.log(`Servidor rodando em http://localhost:${config.port}`);
});
