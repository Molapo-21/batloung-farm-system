'use strict';
module.exports = (req, res, next) => {
  const t = Date.now();
  res.on('finish', () => {
    if (req.originalUrl.startsWith('/api')) {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t}ms)`);
    }
  });
  next();
};
