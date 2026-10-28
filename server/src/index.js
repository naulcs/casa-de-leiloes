import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hora: new Date().toISOString() });
});

app.use('/api/auth', authRouter);

app.use((erro, req, res, next) => {
  if (erro.status && erro.status < 500) {
    return res.status(erro.status).json({ error: 'Requisição inválida.' });
  }
  console.error(erro);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(config.port, () => {
  console.log(`Servidor rodando em http://localhost:${config.port}`);
});