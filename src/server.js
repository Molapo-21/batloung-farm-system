'use strict';
require('dotenv').config();
const app = require('./app');
const { testConnection, pool } = require('./config/db');

const PORT = Number(process.env.PORT) || 3000;
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) console.warn('[auth] JWT_SECRET is missing or too short - login will not work until it is set in .env');

// The process must never die because MySQL is down or a promise was not handled.
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason?.code || reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err.code || err.message));

const server = app.listen(PORT, async () => {
  console.log(`Batloung Farm system running at http://localhost:${PORT}`);
  const db = await testConnection();
  if (db.ok) console.log(`[db] connected to MySQL database "${process.env.DB_NAME}"`);
  else console.warn(`[db] MySQL not reachable (${db.error}). Server stays up; API calls will return 503 until the database is available.`);
});

server.on('error', (err) => { console.error('[server] cannot start:', err.code || err.message); process.exit(1); });

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(async () => { await pool.end().catch(() => {}); process.exit(0); }));
}
