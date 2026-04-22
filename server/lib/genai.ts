import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not configured on the server');
}

export const ai = new GoogleGenAI({ apiKey });

export const blueprintResponseSchema = {
  type: Type.OBJECT,
  required: ['title', 'overallMood', 'colorPalette', 'suggestedAspectRatio', 'storyboard'],
  properties: {
    title: { type: Type.STRING },
    overallMood: { type: Type.STRING },
    colorPalette: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    suggestedAspectRatio: { type: Type.STRING },
    storyboard: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['timestamp', 'description', 'visualStyle', 'cameraMovement', 'lighting', 'lensSuggestion', 'cameraRig'],
        properties: {
          timestamp: { type: Type.STRING, description: 'e.g. 0:00, 0:15, 1:30' },
          description: { type: Type.STRING },
          visualStyle: { type: Type.STRING },
          cameraMovement: { type: Type.STRING },
          lighting: { type: Type.STRING },
          lensSuggestion: { type: Type.STRING },
          cameraRig: { type: Type.STRING },
          shotType: { type: Type.STRING, description: 'e.g. ECU, MCU, Long Shot, POV' },
          lightingEquipment: { type: Type.STRING, description: 'Detailed gear e.g. 2x Arri Skypanel, Red gels' },
        },
      },
    },
  },
} as const;
