import { Router } from 'express';
import { ai } from '../lib/genai';
import { checkRateLimit, getRateLimitKey } from '../lib/rateLimiter';
import { validateSeedInput } from '../lib/validation';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const rateLimitKey = getRateLimitKey(req.header('x-user-id') ?? undefined, req.ip);
    const rate = checkRateLimit(rateLimitKey, 30, 60_000);

    res.setHeader('X-RateLimit-Limit', String(rate.limit));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));

    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'Rate limit exceeded. Please wait before trying again.' });
      return;
    }

    const { prompt } = validateSeedInput(req.body);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a high-quality cinematic moodboard image for a music video. Vibe: ${prompt}. Style: Cinematic, professional, atmospheric, focus on lighting and texture. Exclude: Text, watermarks.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: '16:9',
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        res.status(200).json({ imageBase64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' });
        return;
      }
    }

    res.status(502).json({ error: 'Gemini returned no image data' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate visual seed';
    const status = message.includes('must') || message.includes('required') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
