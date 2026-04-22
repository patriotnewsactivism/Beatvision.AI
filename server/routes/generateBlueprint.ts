import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { validateBlueprintRequest } from '../lib/validation';

const router = Router();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn('GEMINI_API_KEY is not set; /api/generate-blueprint will fail until configured.');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

router.post('/', async (req, res) => {
  try {
    const { vibe, lyrics, durationSeconds, audioData, sceneLimit } = validateBlueprintRequest(req.body ?? {});

    const prompt = `
Generate a highly detailed, cinematic music video blueprint for a song.
Vibe: ${vibe || 'N/A'}
Lyrics/Theme: ${lyrics || 'N/A'}
Duration: ${durationSeconds} seconds

${audioData ? 'Crucially, analyze the provided audio for BPM, energy peaks, and song structure and align the storyboard with those transitions.' : ''}

Rules:
- Return strictly valid JSON.
- Storyboard must have exactly ${sceneLimit} scenes.
- Include detailed camera movement, lighting direction, lens suggestions, and camera rig per scene.
- Keep timestamps coherent for the full duration.
`;

    const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [{ text: prompt }];
    if (audioData) {
      parts.push({
        inlineData: {
          data: audioData.data,
          mimeType: audioData.mimeType,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['title', 'overallMood', 'colorPalette', 'suggestedAspectRatio', 'storyboard'],
          properties: {
            title: { type: Type.STRING },
            overallMood: { type: Type.STRING },
            colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedAspectRatio: { type: Type.STRING },
            storyboard: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: [
                  'timestamp',
                  'description',
                  'visualStyle',
                  'cameraMovement',
                  'lighting',
                  'lensSuggestion',
                  'cameraRig',
                ],
                properties: {
                  timestamp: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualStyle: { type: Type.STRING },
                  cameraMovement: { type: Type.STRING },
                  lighting: { type: Type.STRING },
                  lensSuggestion: { type: Type.STRING },
                  cameraRig: { type: Type.STRING },
                  shotType: { type: Type.STRING },
                  lightingEquipment: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    let blueprint: unknown;
    try {
      blueprint = JSON.parse(response.text || '{}');
    } catch {
      return res.status(502).json({ error: 'Invalid model response format.' });
    }

    return res.json(blueprint);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const isValidationError =
      message.includes('required') ||
      message.includes('must be') ||
      message.includes('exceed') ||
      message.includes('Provide at least one');

    return res.status(isValidationError ? 400 : 500).json({ error: message });
  }
});

export default router;
