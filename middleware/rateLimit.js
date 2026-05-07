const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many auth attempts. Try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests. Try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, apiLimiter };
