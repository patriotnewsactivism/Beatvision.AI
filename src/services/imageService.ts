export async function generateVisualSeed(prompt: string, userId?: string): Promise<string> {
  const response = await fetch('/api/generate-seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: JSON.stringify({ prompt, userId }),
  });

  const data = (await response.json()) as { imageDataUrl?: string; error?: string };

  if (!response.ok || !data.imageDataUrl) {
    throw new Error(data.error || 'Failed to generate visual seed');
  }

  return data.imageDataUrl;
}
