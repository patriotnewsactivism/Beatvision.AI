export interface EnergyPoint {
  time: number;
  value: number;
}

export interface AnalysisSection {
  start: number;
  end: number;
  label: string;
  intensity: number;
}

export interface AudioAnalysisMetadata {
  bpm: number;
  beatGrid: number[];
  downbeats: number[];
  sections: AnalysisSection[];
  energyCurve: EnergyPoint[];
  confidence: number;
  peaks: number[];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function decode16BitPcmWav(buffer: Buffer): { sampleRate: number; samples: Float32Array } | null {
  if (buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") return null;

  let offset = 12;
  let fmtChunk: { channels: number; sampleRate: number; bitsPerSample: number; audioFormat: number } | null = null;
  let dataStart = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === "fmt ") {
      if (chunkSize < 16 || chunkDataStart + chunkSize > buffer.length) return null;
      fmtChunk = {
        audioFormat: buffer.readUInt16LE(chunkDataStart),
        channels: buffer.readUInt16LE(chunkDataStart + 2),
        sampleRate: buffer.readUInt32LE(chunkDataStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkDataStart + 14),
      };
    } else if (chunkId === "data") {
      dataStart = chunkDataStart;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (!fmtChunk || dataStart < 0) return null;
  if (fmtChunk.audioFormat !== 1 || fmtChunk.bitsPerSample !== 16) return null;
  if (fmtChunk.channels < 1 || fmtChunk.channels > 2) return null;

  const bytesPerSample = fmtChunk.bitsPerSample / 8;
  const frameSize = bytesPerSample * fmtChunk.channels;
  const frameCount = Math.floor(Math.min(dataSize, buffer.length - dataStart) / frameSize);
  const samples = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i += 1) {
    const frameOffset = dataStart + i * frameSize;
    let sum = 0;
    for (let ch = 0; ch < fmtChunk.channels; ch += 1) {
      const sample = buffer.readInt16LE(frameOffset + ch * bytesPerSample);
      sum += sample / 32768;
    }
    samples[i] = sum / fmtChunk.channels;
  }

  return { sampleRate: fmtChunk.sampleRate, samples };
}

function rmsEnvelope(samples: Float32Array, sampleRate: number, windowSize = 1024): EnergyPoint[] {
  const result: EnergyPoint[] = [];
  for (let i = 0; i + windowSize <= samples.length; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j += 1) {
      const s = samples[i + j];
      sum += s * s;
    }
    result.push({
      time: i / sampleRate,
      value: Math.sqrt(sum / windowSize),
    });
  }

  const max = result.reduce((acc, p) => Math.max(acc, p.value), 1e-8);
  return result.map((p) => ({ ...p, value: clamp(p.value / max, 0, 1) }));
}

function onsetEnvelope(energy: EnergyPoint[]): number[] {
  const onset = new Array<number>(energy.length).fill(0);
  for (let i = 1; i < energy.length; i += 1) {
    onset[i] = Math.max(0, energy[i].value - energy[i - 1].value);
  }
  const max = Math.max(...onset, 1e-8);
  return onset.map((v) => v / max);
}

function detectPeaks(energy: EnergyPoint[], minDistanceSeconds = 0.2, threshold = 0.62): number[] {
  const peaks: number[] = [];
  let lastPeak = -Infinity;

  for (let i = 1; i < energy.length - 1; i += 1) {
    const prev = energy[i - 1].value;
    const curr = energy[i].value;
    const next = energy[i + 1].value;

    if (curr > threshold && curr > prev && curr >= next && energy[i].time - lastPeak >= minDistanceSeconds) {
      peaks.push(energy[i].time);
      lastPeak = energy[i].time;
    }
  }

  return peaks;
}

function estimateBpmAndGrid(
  energy: EnergyPoint[],
  onset: number[],
  durationSeconds: number,
): { bpm: number; beatGrid: number[]; confidence: number } {
  if (energy.length < 8) return { bpm: 120, beatGrid: [], confidence: 0 };

  const hop = energy[1].time - energy[0].time;
  let bestBpm = 120;
  let bestScore = -Infinity;

  for (let bpm = 70; bpm <= 180; bpm += 1) {
    const interval = (60 / bpm) / hop;
    let score = 0;

    for (let i = 0; i < onset.length; i += 1) {
      const candidate = Math.round(i + interval);
      if (candidate < onset.length) score += onset[i] * onset[candidate];
    }

    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  const firstOnsetIdx = onset.findIndex((v) => v > 0.6);
  const anchor = firstOnsetIdx >= 0 ? energy[firstOnsetIdx].time : 0;
  const beatInterval = 60 / bestBpm;
  const beatGrid: number[] = [];

  for (let t = anchor; t <= durationSeconds + 1e-6; t += beatInterval) {
    beatGrid.push(Number(t.toFixed(3)));
  }

  const normalizedScore = clamp(bestScore / Math.max(energy.length, 1), 0, 1);
  return {
    bpm: bestBpm,
    beatGrid,
    confidence: normalizedScore,
  };
}

function computeSections(energy: EnergyPoint[], durationSeconds: number): AnalysisSection[] {
  if (energy.length === 0) return [{ start: 0, end: durationSeconds, label: "Main", intensity: 0.5 }];

  const sections: AnalysisSection[] = [];
  let sectionStartIdx = 0;
  let lastCutTime = 0;

  for (let i = 8; i < energy.length - 8; i += 1) {
    const prevMean = energy.slice(i - 8, i).reduce((a, p) => a + p.value, 0) / 8;
    const nextMean = energy.slice(i, i + 8).reduce((a, p) => a + p.value, 0) / 8;
    const delta = Math.abs(nextMean - prevMean);
    const cutTime = energy[i].time;

    if (delta > 0.18 && cutTime - lastCutTime >= 6) {
      const window = energy.slice(sectionStartIdx, i);
      const intensity = window.reduce((a, p) => a + p.value, 0) / Math.max(window.length, 1);
      sections.push({
        start: Number(lastCutTime.toFixed(3)),
        end: Number(cutTime.toFixed(3)),
        label: intensity > 0.7 ? "Chorus/Drop" : intensity > 0.45 ? "Verse" : "Breakdown",
        intensity: Number(clamp(intensity, 0, 1).toFixed(3)),
      });
      sectionStartIdx = i;
      lastCutTime = cutTime;
    }
  }

  const tailWindow = energy.slice(sectionStartIdx);
  const tailIntensity = tailWindow.reduce((a, p) => a + p.value, 0) / Math.max(tailWindow.length, 1);
  sections.push({
    start: Number(lastCutTime.toFixed(3)),
    end: Number(durationSeconds.toFixed(3)),
    label: tailIntensity > 0.7 ? "Final Chorus" : tailIntensity > 0.45 ? "Verse/Bridge" : "Outro",
    intensity: Number(clamp(tailIntensity, 0, 1).toFixed(3)),
  });

  return sections;
}

export function analyzeAudio(base64Data: string, mimeType: string, fallbackDurationSeconds: number): AudioAnalysisMetadata {
  const raw = Buffer.from(base64Data, "base64");
  const decoded = decode16BitPcmWav(raw);

  if (!decoded) {
    const safeDuration = Math.max(10, fallbackDurationSeconds);
    const sections: AnalysisSection[] = [
      { start: 0, end: Number((safeDuration * 0.33).toFixed(3)), label: "Intro/Verse", intensity: 0.35 },
      { start: Number((safeDuration * 0.33).toFixed(3)), end: Number((safeDuration * 0.66).toFixed(3)), label: "Build", intensity: 0.6 },
      { start: Number((safeDuration * 0.66).toFixed(3)), end: Number(safeDuration.toFixed(3)), label: "Chorus/Drop", intensity: 0.85 },
    ];

    return {
      bpm: 120,
      beatGrid: [],
      downbeats: [],
      sections,
      energyCurve: sections.map((s) => ({ time: s.start, value: s.intensity })),
      confidence: mimeType.includes("wav") ? 0.3 : 0.1,
      peaks: [],
    };
  }

  const durationSeconds = decoded.samples.length / decoded.sampleRate;
  const energyCurve = rmsEnvelope(decoded.samples, decoded.sampleRate);
  const onset = onsetEnvelope(energyCurve);
  const { bpm, beatGrid, confidence } = estimateBpmAndGrid(energyCurve, onset, durationSeconds);
  const downbeats = beatGrid.filter((_, idx) => idx % 4 === 0);
  const peaks = detectPeaks(energyCurve);
  const sections = computeSections(energyCurve, durationSeconds);

  return {
    bpm,
    beatGrid,
    downbeats,
    sections,
    energyCurve: energyCurve.map((point) => ({ time: Number(point.time.toFixed(3)), value: Number(point.value.toFixed(3)) })),
    confidence: Number(confidence.toFixed(3)),
    peaks: peaks.map((t) => Number(t.toFixed(3))),
  };
}
