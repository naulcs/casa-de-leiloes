import { pool } from './pool.js';

try {
  const { rows } = await pool.query(
    'SELECT current_database() AS banco, NOW() AS agora'
  );
  console.log('Conectado ao banco!', rows[0]);
} catch (erro) {
  console.error('Nao consegui conectar:', erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}