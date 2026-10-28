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

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function readUser(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  return { id: Number(payload.sub), role: payload.role };
}

export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Faça login para continuar.' });
  }
  try {
    req.user = readUser(token);
    next();
    } catch (erro) {
    const expirou = erro.name === 'TokenExpiredError';
    res.status(401).json({
      error: expirou
        ? 'Sessão expirada. Faça login novamente.'
        : 'Token inválido. Faça login novamente.',
    });
  }}

export function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = readUser(token);
    } catch {
    }
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'Você não tem permissão para isso.' });
    }
    next();
  };
}