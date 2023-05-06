// Allows no more than 10 requests per 5 seconds, per IP
const { RateLimiterMemory } = require('rate-limiter-flexible');

// storage key prefix
const keyPrefix = 'RateLimit:Server';

// duration in seconds
const duration = 5;

// max number of requests per period
const quota = 10;

// start blocking in memory after this many requests
const blockAfter = quota;

// rate limiter for free accounts
const RateLimiter = new RateLimiterMemory({
  keyPrefix: keyPrefix,
  points: quota, 
  duration: duration,
  inmemoryBlockOnConsumed: quota,
  execEvenly: false
});

module.exports = (req, res, next) => {
  RateLimiter
    .consume(req.ip, 1)
    .then(() => next())
    .catch(rateLimitRes => {
      // if request count is more than the max, send 429
      if(rateLimitRes.consumedPoints >= blockAfter) {
        console.log('Server rate-limit 429: %s --> %s', req.ip, req.originalUrl);
        return res.status(429).json({ error: 'Too Many Requests' });
      } else {
        delay(rateLimitRes.msBeforeNext).then(() => next());
      }
  });
};