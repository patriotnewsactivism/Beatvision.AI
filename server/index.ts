import "dotenv/config";
import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { analyzeAudio } from "./audioAnalysis";
import { VideoBlueprint } from "../src/types";

const app = express();
const port = Number(process.env.API_PORT || 8787);
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  throw new Error("GEMINI_API_KEY is required for backend generation endpoints.");
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

app.use(express.json({ limit: "25mb" }));

app.post("/api/generate-blueprint", async (req, res) => {
  try {
    const {
      vibe,
      lyrics = "",
      durationSeconds = 180,
      audioData,
    }: {
      vibe?: string;
      lyrics?: string;
      durationSeconds?: number;
      audioData?: { data: string; mimeType: string };
    } = req.body ?? {};

    if (!vibe && !lyrics && !audioData) {
      return res.status(400).json({ error: "Provide vibe, lyrics, or audioData." });
    }

    const analysis = audioData
      ? analyzeAudio(audioData.data, audioData.mimeType, durationSeconds)
      : analyzeAudio("", "", durationSeconds);

    const hardConstraintPayload = {
      bpm: analysis.bpm,
      confidence: analysis.confidence,
      sections: analysis.sections,
      peaks: analysis.peaks,
      downbeats: analysis.downbeats,
      beatGrid: analysis.beatGrid,
    };

    const prompt = `
Generate a highly detailed, cinematic music video blueprint for a song with the following characteristics:
Vibe: ${vibe ?? "N/A"}
Lyrics/Theme: ${lyrics}
Duration: ${durationSeconds} seconds

HARD AUDIO CONSTRAINTS (must obey exactly):
${JSON.stringify(hardConstraintPayload, null, 2)}

Rules:
1) Every storyboard scene timestamp must align to a section start time when possible.
2) Scene intensity, camera energy, and lighting contrast must track section intensity exactly.
3) Mention BPM-aware movement pacing (cuts/motion tied to beat grid/downbeats).
4) Provide 6-12 storyboard scenes with exact timestamps (m:ss).
5) Keep transitions synchronized with section boundaries and major peaks.
`;

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: prompt }];
    if (audioData) {
      parts.push({
        inlineData: {
          data: audioData.data,
          mimeType: audioData.mimeType,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "overallMood", "colorPalette", "suggestedAspectRatio", "storyboard", "analysis"],
          properties: {
            title: { type: Type.STRING },
            overallMood: { type: Type.STRING },
            colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedAspectRatio: { type: Type.STRING },
            storyboard: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["timestamp", "description", "visualStyle", "cameraMovement", "lighting", "lensSuggestion", "cameraRig"],
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
            analysis: {
              type: Type.OBJECT,
              required: ["bpm", "sections", "confidence", "peaks", "beatGrid", "downbeats", "energyCurve"],
              properties: {
                bpm: { type: Type.NUMBER },
                confidence: { type: Type.NUMBER },
                peaks: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                beatGrid: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                downbeats: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                energyCurve: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["time", "value"],
                    properties: {
                      time: { type: Type.NUMBER },
                      value: { type: Type.NUMBER },
                    },
                  },
                },
                sections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["start", "end", "label", "intensity"],
                    properties: {
                      start: { type: Type.NUMBER },
                      end: { type: Type.NUMBER },
                      label: { type: Type.STRING },
                      intensity: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}") as VideoBlueprint;
    const blueprint: VideoBlueprint = {
      ...parsed,
      analysis,
    };

    return res.json(blueprint);
  } catch (error) {
    console.error("/api/generate-blueprint failed", error);
    return res.status(500).json({ error: "Failed to generate blueprint." });
  }
});

app.post("/api/generate-visual-seed", async (req, res) => {
  try {
    const { prompt } = req.body ?? {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `Generate a high-quality cinematic moodboard image for a music video. Vibe: ${prompt}. Style: Cinematic, professional, atmospheric, focus on lighting and texture. Exclude: Text, watermarks.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return res.json({ imageDataUrl: `data:image/png;base64,${part.inlineData.data}` });
      }
    }

    return res.status(502).json({ error: "Image generation did not return image data." });
  } catch (error) {
    console.error("/api/generate-visual-seed failed", error);
    return res.status(500).json({ error: "Failed to generate visual seed." });
  }
});

app.listen(port, () => {
  console.log(`BeatVision backend listening on http://localhost:${port}`);
});
