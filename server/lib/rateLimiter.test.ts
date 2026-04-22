import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './rateLimiter';

test('createRateLimiter blocks after max requests', () => {
  const middleware = createRateLimiter({
    windowMs: 1000,
    maxRequests: 2,
    keyFromRequest: () => 'user:test',
  });

  const req = { body: {}, header: () => undefined, ip: '127.0.0.1' } as any;

  let statusCode = 200;
  let jsonPayload: unknown;
  const res = {
    setHeader: () => {},
    status: (code: number) => {
      statusCode = code;
      return {
        json: (payload: unknown) => {
          jsonPayload = payload;
        },
      };
    },
  } as any;

  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  middleware(req, res, next);
  middleware(req, res, next);
  middleware(req, res, next);

  assert.equal(nextCalls, 2);
  assert.equal(statusCode, 429);
  assert.deepEqual(jsonPayload, { error: 'Too many requests. Please try again later.' });
});
