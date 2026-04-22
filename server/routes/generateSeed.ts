import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { validateSeedRequest } from '../lib/validation';

const router = Router();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn('GEMINI_API_KEY is not set; /api/generate-seed will fail until configured.');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

router.post('/', async (req, res) => {
  try {
    const { prompt } = validateSeedRequest(req.body ?? {});

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a high-quality cinematic moodboard image for a music video.
Vibe: ${prompt}
Style: Cinematic, professional, atmospheric, focus on lighting and texture.
Exclude: Text, watermarks.`,
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
        return res.json({ imageDataUrl: `data:image/png;base64,${part.inlineData.data}` });
      }
    }

    return res.status(502).json({ error: 'Failed to generate visual seed image.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const isValidationError = message.includes('prompt');
    return res.status(isValidationError ? 400 : 500).json({ error: message });
  }
});

export default router;
