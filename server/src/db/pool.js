import pg from 'pg';
import { config } from '../config.js';

if (!config.databaseUrl) {
  throw new Error('Faltou DATABASE_URL no arquivo server/.env');
}

pg.types.setTypeParser(pg.types.builtins.INT8, Number);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });