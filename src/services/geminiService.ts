import { VideoBlueprint } from '../types';
import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface AudioPayload {
  data: string;
  mimeType: string;
}

interface BlueprintPayload {
  vibe: string;
  lyrics: string;
  durationSeconds: number;
  sceneLimit?: number;
  audioData?: AudioPayload;
}

export async function generateMusicVideoBlueprint(
  vibe: string,
  lyrics: string = '',
  durationSeconds: number = 180,
  audioData?: AudioPayload
): Promise<VideoBlueprint> {
  const payload: BlueprintPayload = {
    vibe,
    lyrics,
    durationSeconds,
    sceneLimit: 10,
    audioData,
  };

  const response = await fetch(`${API_BASE_URL}/api/generateBlueprint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth.currentUser?.uid ? { 'x-user-id': auth.currentUser.uid } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to generate music video blueprint');
  }

  return data as VideoBlueprint;
}
