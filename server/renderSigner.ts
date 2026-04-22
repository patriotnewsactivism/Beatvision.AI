import crypto from "node:crypto";

const DEFAULT_TTL_SECONDS = 60 * 60;

function getSigningSecret() {
  const secret = process.env.RENDER_SIGNING_SECRET;
  if (!secret) {
    throw new Error("Missing RENDER_SIGNING_SECRET environment variable.");
  }
  return secret;
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

export interface SignedRenderUrl {
  exp: number;
  sig: string;
}

export function createSignedToken(renderId: string, ttlSeconds = DEFAULT_TTL_SECONDS): SignedRenderUrl {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${renderId}:${exp}`;
  const sig = signPayload(payload);
  return { exp, sig };
}

export function verifySignedToken(renderId: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const payload = `${renderId}:${exp}`;
  const expected = signPayload(payload);

  const receivedBuffer = Buffer.from(sig, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}
