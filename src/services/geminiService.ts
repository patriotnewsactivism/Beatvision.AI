import { GoogleGenAI, Type } from "@google/genai";
import { Scene, VideoBlueprint } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface GenerationProfiles {
  stylePackName: string;
  cameraProfile: string;
  lightingProfile: string;
  gradeProfile: string;
}

const storyboardSceneSchema = {
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
};

export async function generateMusicVideoBlueprint(
  vibe: string,
  lyrics: string = "",
  durationSeconds: number = 180,
  audioData?: { data: string; mimeType: string },
  profiles?: GenerationProfiles
): Promise<VideoBlueprint> {
  const prompt = `
    Generate a highly detailed, cinematic music video blueprint for a song with the following characteristics:
    Vibe: ${vibe}
    Lyrics/Theme: ${lyrics}
    Duration: ${durationSeconds} seconds

    Style Pack: ${profiles?.stylePackName || "Custom"}
    Camera Profile: ${profiles?.cameraProfile || "Creative cinematic"}
    Lighting Profile: ${profiles?.lightingProfile || "Motivated cinematic lighting"}
    Grade Profile: ${profiles?.gradeProfile || "Cinematic color grading"}

    ${audioData ? "Crucially, ANALYZE the provided audio to detect BPM, energy peaks, and song structure (Verse, Chorus, etc.) and align the storyboard perfectly with these shifts." : "If no audio file is provided, infer structure from vibe and lyrics."}

    The blueprint should be professionally directed and production-ready.
    It must include:
    1. A storyboard with timestamps (at least 6-10 major scenes or transitions).
    2. Detailed camera movements aligned with the camera profile.
    3. Lighting directions aligned with the lighting profile.
    4. Technical specifications per scene:
        - Lens Suggestion
        - Camera Rig
        - Shot Type
        - Lighting Equipment
    5. A consistent visual style description and mood.
    6. A recommended color palette (hex codes).
  `;

  const contents: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [{ text: prompt }];
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
            items: storyboardSceneSchema
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

export async function regenerateScene(
  blueprint: VideoBlueprint,
  scene: Scene,
  vibe: string,
  lyrics: string,
  profiles?: GenerationProfiles
): Promise<Scene> {
  const prompt = `
    Regenerate exactly one scene for this music video blueprint.
    Blueprint title: ${blueprint.title}
    Blueprint mood: ${blueprint.overallMood}
    Vibe: ${vibe}
    Lyrics: ${lyrics}

    Style Pack: ${profiles?.stylePackName || "Custom"}
    Camera Profile: ${profiles?.cameraProfile || "Creative cinematic"}
    Lighting Profile: ${profiles?.lightingProfile || "Motivated cinematic lighting"}
    Grade Profile: ${profiles?.gradeProfile || "Cinematic color grading"}

    Keep timestamp fixed at: ${scene.timestamp}
    Existing scene description: ${scene.description}
    Existing scene style: ${scene.visualStyle}

    Return one alternative scene that better fits the profile while preserving continuity with adjacent scenes.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: storyboardSceneSchema
    }
  });

  try {
    const parsed = JSON.parse(response.text || "{}") as Scene;
    return { ...parsed, timestamp: scene.timestamp, locked: false };
  } catch (e) {
    console.error("Failed to parse scene regeneration", e);
    throw new Error("Failed to regenerate scene");
  }
}
