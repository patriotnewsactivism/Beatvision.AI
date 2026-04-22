import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { VideoBlueprint } from "../src/types";
import { claimNextRender, processRenderJob } from "./renderWorker";
import { verifySignedToken } from "./renderSigner";

const app = express();
const upload = multer({ dest: path.resolve(process.cwd(), ".tmp", "uploads") });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();
const PORT = Number(process.env.RENDER_API_PORT ?? 8787);
const APP_URL = process.env.APP_URL ?? `http://localhost:${PORT}`;

async function requireUser(req: express.Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new Error("Missing authorization token.");
  }
  const token = header.slice("Bearer ".length);
  return admin.auth().verifyIdToken(token);
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/renders", upload.single("track"), async (req, res) => {
  try {
    const user = await requireUser(req);
    const blueprintId = String(req.body.blueprintId || "").trim();
    const rawBlueprint = req.body.blueprint;

    if (!blueprintId || !rawBlueprint || !req.file) {
      res.status(400).json({ error: "blueprintId, blueprint, and track are required." });
      return;
    }

    const blueprint = JSON.parse(rawBlueprint) as VideoBlueprint;
    if (!Array.isArray(blueprint.storyboard) || blueprint.storyboard.length === 0) {
      res.status(400).json({ error: "Blueprint storyboard is required." });
      return;
    }

    const renderId = randomUUID();
    const renderTrackDir = path.resolve(process.cwd(), "storage", "tracks");
    await fs.mkdir(renderTrackDir, { recursive: true });

    const ext = path.extname(req.file.originalname || "") || ".mp3";
    const trackPath = path.join(renderTrackDir, `${renderId}${ext}`);
    await fs.copyFile(req.file.path, trackPath);
    await fs.rm(req.file.path, { force: true });

    const docRef = db.collection("renders").doc(renderId);
    await docRef.set({
      userId: user.uid,
      blueprintId,
      status: "queued",
      stage: "scene-plan",
      progress: 0,
      storyboard: blueprint.storyboard,
      trackPath,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(202).json({ renderId, status: "queued" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not queue render.";
    res.status(401).json({ error: message });
  }
});

app.get("/api/renders/:renderId", async (req, res) => {
  try {
    const user = await requireUser(req);
    const docSnap = await db.collection("renders").doc(req.params.renderId).get();
    if (!docSnap.exists) {
      res.status(404).json({ error: "Render not found." });
      return;
    }

    const data = docSnap.data();
    if (!data || data.userId !== user.uid) {
      res.status(403).json({ error: "Forbidden." });
      return;
    }

    res.json({ id: docSnap.id, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read render.";
    res.status(401).json({ error: message });
  }
});

app.get("/api/renders/download/:renderId", async (req, res) => {
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig || "");
  const renderId = req.params.renderId;

  if (!verifySignedToken(renderId, exp, sig)) {
    res.status(403).json({ error: "Invalid or expired signed URL." });
    return;
  }

  const filePath = path.resolve(process.cwd(), "storage", "renders", `${renderId}.mp4`);
  try {
    await fs.access(filePath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename=render-${renderId}.mp4`);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: "Rendered file not found." });
  }
});

let workerBusy = false;
setInterval(async () => {
  if (workerBusy) return;
  workerBusy = true;
  try {
    const job = await claimNextRender(db);
    if (job) {
      await processRenderJob(db, job, APP_URL);
    }
  } finally {
    workerBusy = false;
  }
}, 5000);

app.listen(PORT, () => {
  console.log(`Render API + worker listening on http://localhost:${PORT}`);
});
