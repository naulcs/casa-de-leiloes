import { pool } from "./pool.js";

try {
  const { rows } = await pool.query(
    "SELECT current_database() AS database_name, NOW() AS now",
  );
  console.log("Conectado ao banco!", rows[0]);
} catch (error) {
  console.error("Nao consegui conectar:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
