import jwt from 'jsonwebtoken';
import { config } from '../config.js';

if (!config.jwtSecret) {
  throw new Error('Faltou JWT_SECRET no arquivo server/.env');
}

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Faça login para continuar.' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'Você não tem permissão para isso.' });
    }
    next();
  };
}