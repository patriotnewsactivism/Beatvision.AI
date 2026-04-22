import { describe, expect, it } from "vitest";
import { analyzeAudio } from "./audioAnalysis";

function createKickPulseWavBase64(durationSeconds: number, bpm: number, sampleRate = 44100): string {
  const totalSamples = Math.floor(durationSeconds * sampleRate);
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = totalSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const beatIntervalSamples = Math.floor((60 / bpm) * sampleRate);
  for (let i = 0; i < totalSamples; i += 1) {
    const inBeat = i % beatIntervalSamples;
    const envelope = inBeat < 1400 ? 1 - inBeat / 1400 : 0;
    const sample = Math.sin((2 * Math.PI * 80 * i) / sampleRate) * envelope;
    const value = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.floor(value * 32767), 44 + i * 2);
  }

  return buffer.toString("base64");
}

describe("analyzeAudio", () => {
  it("extracts structural metadata from WAV data", () => {
    const wav = createKickPulseWavBase64(12, 120);
    const analysis = analyzeAudio(wav, "audio/wav", 12);

    expect(analysis.bpm).toBeGreaterThanOrEqual(70);
    expect(analysis.bpm).toBeLessThanOrEqual(180);
    expect(analysis.sections.length).toBeGreaterThan(0);
    expect(analysis.energyCurve.length).toBeGreaterThan(0);
    expect(analysis.downbeats.length).toBeLessThanOrEqual(analysis.beatGrid.length);
  });

  it("returns fallback analysis for non-wav content", () => {
    const analysis = analyzeAudio(Buffer.from("not a wav").toString("base64"), "audio/mp3", 30);

    expect(analysis.bpm).toBe(120);
    expect(analysis.confidence).toBeLessThanOrEqual(0.2);
    expect(analysis.sections.length).toBe(3);
  });
});
