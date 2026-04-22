import { Router } from 'express';
import { ai, blueprintResponseSchema } from '../lib/genai';
import { checkRateLimit, getRateLimitKey } from '../lib/rateLimiter';
import { validateBlueprintInput } from '../lib/validation';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const rateLimitKey = getRateLimitKey(req.header('x-user-id') ?? undefined, req.ip);
    const rate = checkRateLimit(rateLimitKey, 20, 60_000);

    res.setHeader('X-RateLimit-Limit', String(rate.limit));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));

    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'Rate limit exceeded. Please wait before trying again.' });
      return;
    }

    const input = validateBlueprintInput(req.body);

    const prompt = `
Generate a highly detailed, cinematic music video blueprint for a song with the following characteristics:
Vibe: ${input.vibe}
Lyrics/Theme: ${input.lyrics}
Duration: ${input.durationSeconds} seconds

${input.audioData ? 'Crucially, ANALYZE the provided audio to detect BPM, energy peaks, and song structure (Verse, Chorus, etc.) and align the storyboard perfectly with these shifts.' : ''}

The blueprint should be "spot on" and professionally directed.
It must include exactly ${input.sceneLimit} major storyboard scenes/transitions.
It must include:
1. A storyboard with timestamps.
2. Detailed camera movements (e.g., "slow push-in", "low-angle pan", "handheld jitter").
3. Lighting directions (e.g., "high-contrast chiaroscuro", "neon cyan backlighting", "soft golden-hour diffuse").
4. Technical Specifications for each scene:
    - Lens Suggestion (e.g., "35mm Anamorphic", "85mm Prime", "Wide Angle").
    - Camera Rig (e.g., "Steadicam", "Handheld", "Drone", "Slider").
5. A consistent visual style description.
6. A recommended color palette (hex codes).
`;

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: prompt }];

    if (input.audioData) {
      parts.push({
        inlineData: {
          data: input.audioData.data,
          mimeType: input.audioData.mimeType,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: blueprintResponseSchema,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.status(200).json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate blueprint';
    const status = message.includes('must') || message.includes('required') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
