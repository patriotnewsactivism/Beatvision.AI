import { VideoBlueprint } from '../types';

type AudioData = { data: string; mimeType: string };

export async function generateMusicVideoBlueprint(
  vibe: string,
  lyrics: string = '',
  durationSeconds: number = 180,
  audioData?: AudioData,
  userId?: string,
  sceneLimit: number = 8,
): Promise<VideoBlueprint> {
  const response = await fetch('/api/generate-blueprint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: JSON.stringify({
      vibe,
      lyrics,
      durationSeconds,
      sceneLimit,
      audioData,
      userId,
    }),
  });

  const data = (await response.json()) as VideoBlueprint | { error: string };

  if (!response.ok) {
    throw new Error('error' in data ? data.error : 'Failed to generate music video blueprint');
  }

  return data as VideoBlueprint;
}
