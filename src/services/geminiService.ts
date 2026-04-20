import { GoogleGenAI, Type } from "@google/genai";
import { VideoBlueprint } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateMusicVideoBlueprint(
  vibe: string,
  lyrics: string = "",
  durationSeconds: number = 180,
  audioData?: { data: string; mimeType: string }
): Promise<VideoBlueprint> {
  const prompt = `
    Generate a highly detailed, cinematic music video blueprint for a song with the following characteristics:
    Vibe: ${vibe}
    Lyrics/Theme: ${lyrics}
    Duration: ${durationSeconds} seconds
    
    ${audioData ? "Crucially, ANALYZE the provided audio to detect BPM, energy peaks, and song structure (Verse, Chorus, etc.) and align the storyboard perfectly with these shifts." : ""}

    The blueprint should be "spot on" and professionally directed. 
    It must include:
    1. A storyboard with timestamps (at least 6-10 major scenes or transitions).
    2. Detailed camera movements (e.g., "slow push-in", "low-angle pan", "handheld jitter").
    3. Lighting directions (e.g., "high-contrast chiaroscuro", "neon cyan backlighting", "soft golden-hour diffuse").
    4. Technical Specifications for each scene:
        - Lens Suggestion (e.g., "35mm Anamorphic", "85mm Prime", "Wide Angle").
        - Camera Rig (e.g., "Steadicam", "Handheld", "Drone", "Slider").
    5. A consistent visual style description.
    6. A recommended color palette (hex codes).
  `;

  const contents: any[] = [{ text: prompt }];
  if (audioData) {
    contents.push({
      inlineData: {
        data: audioData.data,
        mimeType: audioData.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["title", "overallMood", "colorPalette", "suggestedAspectRatio", "storyboard"],
        properties: {
          title: { type: Type.STRING },
          overallMood: { type: Type.STRING },
          colorPalette: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          suggestedAspectRatio: { type: Type.STRING },
          storyboard: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["timestamp", "description", "visualStyle", "cameraMovement", "lighting", "lensSuggestion", "cameraRig"],
              properties: {
                timestamp: { type: Type.STRING, description: "e.g. 0:00, 0:15, 1:30" },
                description: { type: Type.STRING },
                visualStyle: { type: Type.STRING },
                cameraMovement: { type: Type.STRING },
                lighting: { type: Type.STRING },
                lensSuggestion: { type: Type.STRING },
                cameraRig: { type: Type.STRING },
                shotType: { type: Type.STRING, description: "e.g. ECU, MCU, Long Shot, POV" },
                lightingEquipment: { type: Type.STRING, description: "Detailed gear e.g. 2x Arri Skypanel, Red gels" }
              }
            }
          }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as VideoBlueprint;
  } catch (e) {
    console.error("Failed to parse blueprint", e);
    throw new Error("Failed to generate music video blueprint");
  }
}
