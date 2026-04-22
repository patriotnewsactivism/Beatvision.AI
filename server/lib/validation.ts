export interface BlueprintRequestBody {
  vibe?: unknown;
  lyrics?: unknown;
  durationSeconds?: unknown;
  sceneLimit?: unknown;
  audioData?: unknown;
}

export interface SeedRequestBody {
  prompt?: unknown;
}

export interface AudioInput {
  data: string;
  mimeType: string;
}

const MAX_VIBE_LENGTH = 250;
const MAX_LYRICS_LENGTH = 8000;
const MIN_DURATION_SECONDS = 15;
const MAX_DURATION_SECONDS = 900;
const MIN_SCENE_LIMIT = 6;
const MAX_SCENE_LIMIT = 12;
const MAX_PROMPT_LENGTH = 400;
const MAX_AUDIO_BASE64_LENGTH = 25 * 1024 * 1024; // ~25MB

function asString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return trimmed;
}

function asNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  return value;
}

export function validateBlueprintInput(body: BlueprintRequestBody) {
  const vibe = body.vibe === undefined ? '' : asString(body.vibe, 'vibe', MAX_VIBE_LENGTH);
  const lyrics = body.lyrics === undefined ? '' : asString(body.lyrics, 'lyrics', MAX_LYRICS_LENGTH);

  if (!vibe && !lyrics && !body.audioData) {
    throw new Error('At least one of vibe, lyrics, or audioData is required');
  }

  const duration = body.durationSeconds === undefined
    ? 180
    : asNumber(body.durationSeconds, 'durationSeconds');

  if (duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS) {
    throw new Error(`durationSeconds must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}`);
  }

  const sceneLimit = body.sceneLimit === undefined
    ? 10
    : asNumber(body.sceneLimit, 'sceneLimit');

  if (!Number.isInteger(sceneLimit) || sceneLimit < MIN_SCENE_LIMIT || sceneLimit > MAX_SCENE_LIMIT) {
    throw new Error(`sceneLimit must be an integer between ${MIN_SCENE_LIMIT} and ${MAX_SCENE_LIMIT}`);
  }

  let audioData: AudioInput | undefined;
  if (body.audioData !== undefined) {
    if (typeof body.audioData !== 'object' || body.audioData === null) {
      throw new Error('audioData must be an object when provided');
    }

    const rawAudio = body.audioData as { data?: unknown; mimeType?: unknown };
    const data = asString(rawAudio.data, 'audioData.data', MAX_AUDIO_BASE64_LENGTH);
    const mimeType = asString(rawAudio.mimeType, 'audioData.mimeType', 120);

    if (!mimeType.startsWith('audio/')) {
      throw new Error('audioData.mimeType must be an audio mime type');
    }

    audioData = { data, mimeType };
  }

  return {
    vibe,
    lyrics,
    durationSeconds: duration,
    sceneLimit,
    audioData,
  };
}

export function validateSeedInput(body: SeedRequestBody) {
  const prompt = asString(body.prompt, 'prompt', MAX_PROMPT_LENGTH);
  if (!prompt) {
    throw new Error('prompt is required');
  }

  return { prompt };
}
