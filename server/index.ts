import dotenv from 'dotenv';
import express from 'express';
import generateBlueprintRoute from './routes/generateBlueprint';
import generateSeedRoute from './routes/generateSeed';

dotenv.config({ path: '.env.local' });

const app = express();
const port = Number(process.env.PORT || 8787);

app.set('trust proxy', true);
app.use(express.json({ limit: '30mb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api/generateBlueprint', generateBlueprintRoute);
app.use('/api/generateSeed', generateSeedRoute);

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
