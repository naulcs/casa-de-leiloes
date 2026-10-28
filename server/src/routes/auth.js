import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const ROLES = ['auctioneer', 'bidder'];
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

authRouter.post('/register', async (req, res) => {
  const { password, role } = req.body ?? {};
  const name = texto(req.body?.name);
  const email = texto(req.body?.email).toLowerCase();

  if (!name || !email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Preencha nome, e-mail e senha.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: 'A senha deve ter de 6 a 72 caracteres.' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Escolha o perfil: leiloeiro ou licitante.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, passwordHash, role]
    );
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }
    throw erro;
  }
});

authRouter.post('/login', async (req, res) => {
  const email = texto(req.body?.email).toLowerCase();
  const password = req.body?.password;

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const senhaOk =
    user && typeof password === 'string' && (await bcrypt.compare(password, user.password_hash));
  if (!senhaOk) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const publico = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(publico), user: publico });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) {
    return res.status(401).json({ error: 'Usuário não encontrado.' });
  }
  res.json({ user: rows[0] });
});