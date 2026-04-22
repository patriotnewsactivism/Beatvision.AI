import { VideoBlueprint } from "../types";

export async function generateMusicVideoBlueprint(
  vibe: string,
  lyrics: string = '',
  durationSeconds: number = 180,
  audioData?: AudioPayload
): Promise<VideoBlueprint> {
  const response = await fetch("/api/generate-blueprint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vibe,
      lyrics,
      durationSeconds,
      audioData,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to generate music video blueprint");
  }

  return response.json() as Promise<VideoBlueprint>;
}
