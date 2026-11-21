'use strict';
// Usage:  npm run admin:create -- <username> <password> "<Full Name>"
// Creates the admins table if needed, then creates the admin (or resets the password if the username exists).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const [username, password, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(' ') || 'Administrator';
  if (!username || !password) { console.error('Usage: npm run admin:create -- <username> <password> "<Full Name>"'); process.exit(1); }
  if (password.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, multipleStatements: true });
    const ddl = fs.readFileSync(path.join(__dirname, '..', 'database', 'admin.sql'), 'utf8').replace(/^USE .*;$/m, '');
    await conn.query(ddl);
    const hash = await bcrypt.hash(password, 10);
    await conn.query(
      `INSERT INTO admins (username, password_hash, full_name) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name)`, [username, hash, fullName]);
    console.log(`Administrator "${username}" is ready. You can now log in.`);
  } catch (err) { console.error('Could not create administrator:', err.code || '', err.message); process.exitCode = 1; }
  finally { if (conn) await conn.end(); }
})();
