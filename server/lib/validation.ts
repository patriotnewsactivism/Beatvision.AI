export const BLUEPRINT_LIMITS = {
  vibeMaxLength: 240,
  lyricsMaxLength: 12000,
  durationMinSeconds: 15,
  durationMaxSeconds: 900,
  sceneLimitMin: 6,
  sceneLimitMax: 12,
  audioBase64MaxLength: 30_000_000,
} as const;

export const SEED_LIMITS = {
  promptMinLength: 3,
  promptMaxLength: 400,
} as const;

export type AudioDataInput = {
  data: string;
  mimeType: string;
};

export type BlueprintRequestInput = {
  vibe?: unknown;
  lyrics?: unknown;
  durationSeconds?: unknown;
  sceneLimit?: unknown;
  audioData?: unknown;
  userId?: unknown;
};

export type SeedRequestInput = {
  prompt?: unknown;
  userId?: unknown;
};

export type SanitizedBlueprintInput = {
  vibe: string;
  lyrics: string;
  durationSeconds: number;
  sceneLimit: number;
  userId: string;
  audioData?: AudioDataInput;
};

export type SanitizedSeedInput = {
  prompt: string;
  userId: string;
};

const sanitizeUserId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return 'anonymous';
  }

  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 128) {
    return 'anonymous';
  }

  return trimmed;
};

const parseNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

export function validateBlueprintRequest(input: BlueprintRequestInput): SanitizedBlueprintInput {
  const vibe = typeof input.vibe === 'string' ? input.vibe.trim() : '';
  const lyrics = typeof input.lyrics === 'string' ? input.lyrics.trim() : '';

  if (!vibe && !lyrics && !input.audioData) {
    throw new Error('Provide at least one of: vibe, lyrics, or audioData.');
  }

  if (vibe.length > BLUEPRINT_LIMITS.vibeMaxLength) {
    throw new Error(`vibe exceeds ${BLUEPRINT_LIMITS.vibeMaxLength} characters.`);
  }

  if (lyrics.length > BLUEPRINT_LIMITS.lyricsMaxLength) {
    throw new Error(`lyrics exceed ${BLUEPRINT_LIMITS.lyricsMaxLength} characters.`);
  }

  const durationSeconds = Math.round(parseNumber(input.durationSeconds, 180));
  if (
    durationSeconds < BLUEPRINT_LIMITS.durationMinSeconds ||
    durationSeconds > BLUEPRINT_LIMITS.durationMaxSeconds
  ) {
    throw new Error(
      `durationSeconds must be between ${BLUEPRINT_LIMITS.durationMinSeconds} and ${BLUEPRINT_LIMITS.durationMaxSeconds}.`,
    );
  }

  const sceneLimit = Math.round(parseNumber(input.sceneLimit, 8));
  if (sceneLimit < BLUEPRINT_LIMITS.sceneLimitMin || sceneLimit > BLUEPRINT_LIMITS.sceneLimitMax) {
    throw new Error(
      `sceneLimit must be between ${BLUEPRINT_LIMITS.sceneLimitMin} and ${BLUEPRINT_LIMITS.sceneLimitMax}.`,
    );
  }

  let audioData: AudioDataInput | undefined;
  if (input.audioData !== undefined) {
    if (typeof input.audioData !== 'object' || input.audioData === null) {
      throw new Error('audioData must be an object when provided.');
    }

    const maybeAudioData = input.audioData as Partial<AudioDataInput>;
    const data = typeof maybeAudioData.data === 'string' ? maybeAudioData.data.trim() : '';
    const mimeType = typeof maybeAudioData.mimeType === 'string' ? maybeAudioData.mimeType.trim() : '';

    if (!data || !mimeType) {
      throw new Error('audioData.data and audioData.mimeType are required when audioData is provided.');
    }

    if (data.length > BLUEPRINT_LIMITS.audioBase64MaxLength) {
      throw new Error('audioData is too large.');
    }

    audioData = { data, mimeType };
  }

  return {
    vibe,
    lyrics,
    durationSeconds,
    sceneLimit,
    userId: sanitizeUserId(input.userId),
    ...(audioData ? { audioData } : {}),
  };
}

export function validateSeedRequest(input: SeedRequestInput): SanitizedSeedInput {
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';

  if (!prompt) {
    throw new Error('prompt is required.');
  }

  if (prompt.length < SEED_LIMITS.promptMinLength) {
    throw new Error(`prompt must be at least ${SEED_LIMITS.promptMinLength} characters.`);
  }

  if (prompt.length > SEED_LIMITS.promptMaxLength) {
    throw new Error(`prompt exceeds ${SEED_LIMITS.promptMaxLength} characters.`);
  }

  return {
    prompt,
    userId: sanitizeUserId(input.userId),
  };
}
