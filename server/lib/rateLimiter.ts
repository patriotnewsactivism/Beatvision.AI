import { Request, Response, NextFunction } from 'express';

type RateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
  keyFromRequest: (req: Request) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = options.keyFromRequest(req);

    const current = buckets.get(key);
    if (!current || now >= current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (current.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
}

export function userRateLimitKey(req: Request): string {
  const bodyUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  const headerUserId = typeof req.header('x-user-id') === 'string' ? req.header('x-user-id')!.trim() : '';

  if (bodyUserId) return `user:${bodyUserId}`;
  if (headerUserId) return `user:${headerUserId}`;

  const forwardedFor = req.header('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return `ip:${firstIp}`;
  }

  return `ip:${req.ip || 'unknown'}`;
}
