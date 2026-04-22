export async function generateVisualSeed(prompt: string): Promise<string> {
  const response = await fetch("/api/generate-visual-seed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to generate visual seed");
  }

  const data = (await response.json()) as { imageDataUrl?: string };
  if (!data.imageDataUrl) {
    throw new Error("Failed to generate visual seed");
  }

  return data.imageDataUrl;
}
