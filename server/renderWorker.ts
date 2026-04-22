import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Scene } from "../src/types";
import { createSignedToken } from "./renderSigner";

export type RenderStatus = "queued" | "processing" | "failed" | "complete";
export type RenderStage = "scene-plan" | "asset-generation" | "timeline-assembly" | "final-encode";

export interface RenderJob {
  id: string;
  userId: string;
  blueprintId: string;
  status: RenderStatus;
  stage: RenderStage;
  progress: number;
  storyboard: Scene[];
  trackPath: string;
  outputPath?: string;
  errorMessage?: string;
}

const RENDERS_ROOT = path.resolve(process.cwd(), "storage", "renders");
const TMP_ROOT = path.resolve(process.cwd(), ".tmp", "renders");

async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-1000)}`));
    });
  });
}

function parseTimestamp(ts: string) {
  const parts = ts.split(":").map((v) => Number(v.trim()));
  if (parts.some((v) => Number.isNaN(v))) return 0;
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return parts[0] ?? 0;
}

function getDurationForScene(scenes: Scene[], index: number) {
  const current = parseTimestamp(scenes[index]?.timestamp ?? "0");
  const next = parseTimestamp(scenes[index + 1]?.timestamp ?? "0");
  if (next > current) return Math.max(1, next - current);
  return 3;
}

async function downloadSceneImage(url: string, outPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download scene image: ${response.status}`);
  }
  const arr = await response.arrayBuffer();
  await fs.writeFile(outPath, Buffer.from(arr));
}

async function buildSceneClip(scene: Scene, duration: number, idx: number, jobTmpDir: string) {
  const clipPath = path.join(jobTmpDir, `scene-${idx}.mp4`);
  const imagePath = path.join(jobTmpDir, `scene-${idx}.jpg`);
  const drawText = (scene.description || "Scene").replace(/:/g, "\\:").replace(/'/g, "\\'").slice(0, 60);

  if (scene.thumbnailUrl) {
    await downloadSceneImage(scene.thumbnailUrl, imagePath);
    await runFfmpeg([
      "-y",
      "-loop", "1",
      "-i", imagePath,
      "-t", `${duration}`,
      "-vf", `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=0.35,fade=t=out:st=${Math.max(0.1, duration - 0.35)}:d=0.35,drawtext=text='${drawText}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-120`,
      "-pix_fmt", "yuv420p",
      clipPath,
    ]);
    return clipPath;
  }

  await runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", `color=c=#111111:s=1920x1080:d=${duration}`,
    "-vf", `fade=t=in:st=0:d=0.35,fade=t=out:st=${Math.max(0.1, duration - 0.35)}:d=0.35,drawtext=text='${drawText}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2`,
    "-pix_fmt", "yuv420p",
    clipPath,
  ]);

  return clipPath;
}

export async function processRenderJob(db: Firestore, job: RenderJob, apiBaseUrl: string) {
  const docRef = db.collection("renders").doc(job.id);
  const jobTmpDir = path.join(TMP_ROOT, randomUUID());
  await fs.mkdir(jobTmpDir, { recursive: true });
  await fs.mkdir(RENDERS_ROOT, { recursive: true });

  try {
    await docRef.update({ status: "processing", stage: "scene-plan", progress: 10, updatedAt: FieldValue.serverTimestamp() });

    const sceneClips: string[] = [];
    await docRef.update({ stage: "asset-generation", progress: 30, updatedAt: FieldValue.serverTimestamp() });
    for (let i = 0; i < job.storyboard.length; i += 1) {
      const duration = getDurationForScene(job.storyboard, i);
      const clip = await buildSceneClip(job.storyboard[i], duration, i, jobTmpDir);
      sceneClips.push(clip);
    }

    const concatPath = path.join(jobTmpDir, "timeline.txt");
    await fs.writeFile(concatPath, sceneClips.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join("\n"));

    const timelinePath = path.join(jobTmpDir, "timeline.mp4");
    await docRef.update({ stage: "timeline-assembly", progress: 65, updatedAt: FieldValue.serverTimestamp() });
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", timelinePath]);

    const outputPath = path.join(RENDERS_ROOT, `${job.id}.mp4`);
    await docRef.update({ stage: "final-encode", progress: 90, updatedAt: FieldValue.serverTimestamp() });
    await runFfmpeg([
      "-y",
      "-i", timelinePath,
      "-i", job.trackPath,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-c:a", "aac",
      "-shortest",
      outputPath,
    ]);

    const { exp, sig } = createSignedToken(job.id);
    const downloadUrl = `${apiBaseUrl.replace(/\/$/, "")}/api/renders/download/${job.id}?exp=${exp}&sig=${sig}`;

    await docRef.update({
      status: "complete",
      progress: 100,
      outputPath,
      downloadUrl,
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await docRef.update({
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown render error",
      updatedAt: FieldValue.serverTimestamp(),
    });
  } finally {
    await fs.rm(jobTmpDir, { recursive: true, force: true });
  }
}

export async function claimNextRender(db: Firestore): Promise<RenderJob | null> {
  const snapshot = await db.collection("renders")
    .where("status", "==", "queued")
    .orderBy("createdAt", "asc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  await doc.ref.update({ status: "processing", stage: "scene-plan", updatedAt: FieldValue.serverTimestamp() });

  return {
    id: doc.id,
    userId: data.userId,
    blueprintId: data.blueprintId,
    status: "processing",
    stage: data.stage,
    progress: data.progress ?? 0,
    storyboard: data.storyboard ?? [],
    trackPath: data.trackPath,
  } as RenderJob;
}
