import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function generateVisualSeed(prompt: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/generateSeed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth.currentUser?.uid ? { 'x-user-id': auth.currentUser.uid } : {}),
    },
    body: JSON.stringify({ prompt }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to generate visual seed');
  }

  const { imageBase64, mimeType } = data as { imageBase64?: string; mimeType?: string };
  if (!imageBase64) {
    throw new Error('No image returned by server');
  }

  return `data:${mimeType || 'image/png'};base64,${imageBase64}`;
}
