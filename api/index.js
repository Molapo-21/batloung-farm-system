'use strict';
const serverless = require('serverless-http');
const app = require('../src/app');
const { testConnection } = require('../src/config/db');

// Non-blocking DB warm-up on cold start
testConnection().then(db => {
  if (db.ok) console.log('[db] connected to TiDB Serverless');
  else console.warn('[db] TiDB Serverless not reachable:', db.error);
}).catch(() => {});

module.exports.handler = serverless(app);
