import 'dotenv/config';
import express from 'express';
import generateBlueprintRoute from './routes/generateBlueprint';
import generateSeedRoute from './routes/generateSeed';
import { createRateLimiter, userRateLimitKey } from './lib/rateLimiter';

const app = express();

app.use(express.json({ limit: '35mb' }));

const rateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  keyFromRequest: userRateLimitKey,
});

app.use('/api/generate-blueprint', rateLimiter, generateBlueprintRoute);
app.use('/api/generate-seed', rateLimiter, generateSeedRoute);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${port}`);
});
