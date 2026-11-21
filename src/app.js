'use strict';
const path = require('path');
const express = require('express');
const cors = require('cors');
const requestLogger = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.use('/api', require('./routes'));
app.use('/api', notFound);                                   // unknown API routes -> JSON 404
app.use(express.static(path.join(__dirname, '..', 'public'))); // the admin web interface
app.use(errorHandler);

module.exports = app;
