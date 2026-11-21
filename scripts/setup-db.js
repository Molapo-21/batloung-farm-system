'use strict';
// Usage: npm run db:setup   -> creates the database, tables and sample data using the .env credentials
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true
    });
    for (const file of ['schema.sql', 'seed.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'database', file), 'utf8');
      await conn.query(sql);
      console.log(`Executed database/${file}`);
    }
    console.log('Database ready.');
  } catch (err) {
    console.error('Database setup failed:', err.code || '', err.message);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
