import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';

const reset = process.argv.includes('--reset');

if (reset && process.env.NODE_ENV === 'production') {
  console.error('--reset e proibido em producao.');
  process.exit(1);
}

const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

try {
  if (reset) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Banco zerado.');
  }
  await pool.query(sql);
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('Tabelas:', rows.map((r) => r.table_name).join(', '));
} catch (erro) {
  console.error('Erro ao criar tabelas:', erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}