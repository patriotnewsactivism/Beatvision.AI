/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Music,
  Sparkles,
  ChevronRight,
  Play,
  Pause,
  Layers,
  Camera,
  Lightbulb,
  Palette,
  CheckCircle2,
  AlertCircle,
  Download,
  Image as ImageIcon,
  LogIn,
  LogOut,
  History,
  Save,
  Trash2,
  FolderOpen,
  Wand2,
  Lock,
  Unlock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateMusicVideoBlueprint, regenerateScene } from "./services/geminiService";
import { generateVisualSeed } from "./services/imageService";
import { VideoBlueprint, Scene, RenderJob } from "./types";
import { auth, db } from "./firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc
} from "firebase/firestore";
import { getStylePackById, mergeLockedScenes, parseTimestampToSeconds, STYLE_PACKS } from "./utils/sceneUtils";

export default function App() {
  const [step, setStep] = useState<"input" | "loading" | "result" | "history">("input");
  const [vibe, setVibe] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [blueprint, setBlueprint] = useState<VideoBlueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [myBlueprints, setMyBlueprints] = useState<VideoBlueprint[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(-1);
  const [visualSeeds, setVisualSeeds] = useState<string[]>([]);
  const [isGeneratingSeeds, setIsGeneratingSeeds] = useState(false);
  const [viewMode, setViewMode] = useState<"storyboard" | "tech">("storyboard");
  const [selectedStylePackId, setSelectedStylePackId] = useState(STYLE_PACKS[0].id);
  const [isQuickCreateMode, setIsQuickCreateMode] = useState(true);
  const [quickCreateStatus, setQuickCreateStatus] = useState<string | null>(null);
  const [isRenderingDraft, setIsRenderingDraft] = useState(false);
  const [regeneratingSceneIndex, setRegeneratingSceneIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const selectedStylePack = getStylePackById(selectedStylePackId);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) loadMyBlueprints(u.uid);
    });

    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("id");
    if (sharedId) loadSharedBlueprint(sharedId);

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isQuickCreateMode) return;
    if (!audioFile) return;
    if (step !== "input") return;

    runQuickCreate();
  }, [audioFile, isQuickCreateMode, step]);

  useEffect(() => {
    if (!blueprint || !audioFile) return;

    const currentScene = blueprint.storyboard.reduce((acc, scene, idx) => {
      if (currentTime >= parseTimestampToSeconds(scene.timestamp)) return idx;
      return acc;
    }, -1);

    setActiveSceneIndex(currentScene);
  }, [currentTime, blueprint, audioFile]);

  const getGenerationProfiles = () => ({
    stylePackName: selectedStylePack.name,
    cameraProfile: selectedStylePack.defaultCameraProfile,
    lightingProfile: selectedStylePack.defaultLightingProfile,
    gradeProfile: selectedStylePack.defaultGradeProfile
  });

  const loadSharedBlueprint = async (id: string) => {
    if (!id || id.includes("/")) {
      setStep("input");
      return;
    }
    setStep("loading");
    try {
      const docRef = doc(db, "blueprints", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as VideoBlueprint;
        setBlueprint(data);
        setVibe(data.vibe || "");
        setLyrics(data.lyrics || "");
        if (data.stylePackId) setSelectedStylePackId(data.stylePackId);
        setStep("result");
      }
    } catch (err) {
      console.error("Failed to load shared blueprint", err);
      setStep("input");
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const logout = () => signOut(auth);

  const loadMyBlueprints = async (uid: string) => {
    try {
      const q = query(
        collection(db, "blueprints"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as VideoBlueprint));
      setMyBlueprints(docs);
    } catch (err) {
      console.error("Failed to load blueprints", err);
    }
  };

  const saveBlueprint = async (): Promise<string | null> => {
    if (!user || !blueprint) return null;
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, "blueprints"), {
        ...blueprint,
        userId: user.uid,
        vibe,
        lyrics,
        stylePackId: selectedStylePackId,
        cameraProfile: selectedStylePack.defaultCameraProfile,
        lightingProfile: selectedStylePack.defaultLightingProfile,
        gradeProfile: selectedStylePack.defaultGradeProfile,
        createdAt: serverTimestamp()
      });
      setBlueprint({ ...blueprint, id: docRef.id });
      loadMyBlueprints(user.uid);
      return docRef.id;
    } catch (err) {
      console.error("Save failed", err);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(",")[1]);
      };
      reader.onerror = reject;
    });
  };

  const generateSeeds = async (result: VideoBlueprint, vibeValue: string) => {
    setIsGeneratingSeeds(true);
    try {
      const structuralSeeds = await Promise.all([
        generateVisualSeed(`${vibeValue} ${result.title} key visual`),
        generateVisualSeed(`${vibeValue} lighting concept ${selectedStylePack.name}`)
      ]);
      setVisualSeeds(structuralSeeds);

      const sceneSeeds = await Promise.all(
        result.storyboard.slice(0, 6).map((s) =>
          generateVisualSeed(`${vibeValue} scene: ${s.description.slice(0, 50)} style: ${s.visualStyle}`)
        )
      );

      const updatedStoryboard = result.storyboard.map((s, i) => ({
        ...s,
        thumbnailUrl: sceneSeeds[i] || s.thumbnailUrl,
        locked: s.locked || false
      }));

      setBlueprint((prev) => (prev ? { ...prev, storyboard: updatedStoryboard } : null));
    } catch (e) {
      console.error("Seeds generation failed", e);
    } finally {
      setIsGeneratingSeeds(false);
    }
  };

  const handleGenerate = async () => {
    const effectiveVibe = vibe || selectedStylePack.defaultVibe;
    if (!effectiveVibe && !lyrics && !audioFile) {
      setError("Please provide at least a vibe, lyrics, or an audio file.");
      return;
    }

    setStep("loading");
    setError(null);

    try {
      let audioData;
      if (audioFile) {
        const base64 = await fileToBase64(audioFile);
        audioData = { data: base64, mimeType: audioFile.type };
      }

      const generated = await generateMusicVideoBlueprint(
        effectiveVibe,
        lyrics,
        audioRef.current?.duration || 180,
        audioData,
        getGenerationProfiles()
      );

      const result = mergeLockedScenes(blueprint, {
        ...generated,
        vibe: effectiveVibe,
        lyrics,
        stylePackId: selectedStylePackId,
        cameraProfile: selectedStylePack.defaultCameraProfile,
        lightingProfile: selectedStylePack.defaultLightingProfile,
        gradeProfile: selectedStylePack.defaultGradeProfile,
        storyboard: generated.storyboard.map((scene) => ({ ...scene, locked: scene.locked || false }))
      });

      setBlueprint(result);
      setStep("result");
      generateSeeds(result, effectiveVibe);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while generating your blueprint. Please try again.");
      setStep("input");
    }
  };

  const runQuickCreate = async () => {
    if (!audioFile) return;
    setQuickCreateStatus("Uploading track...");
    setStep("loading");
    setError(null);

    try {
      const base64 = await fileToBase64(audioFile);
      setQuickCreateStatus("Analyzing track dynamics...");

      const generated = await generateMusicVideoBlueprint(
        vibe || selectedStylePack.defaultVibe,
        lyrics,
        audioRef.current?.duration || 180,
        { data: base64, mimeType: audioFile.type },
        getGenerationProfiles()
      );

      const result: VideoBlueprint = {
        ...generated,
        vibe: vibe || selectedStylePack.defaultVibe,
        lyrics,
        stylePackId: selectedStylePackId,
        cameraProfile: selectedStylePack.defaultCameraProfile,
        lightingProfile: selectedStylePack.defaultLightingProfile,
        gradeProfile: selectedStylePack.defaultGradeProfile,
        storyboard: generated.storyboard.map((scene) => ({ ...scene, locked: false }))
      };

      setQuickCreateStatus("Generating draft visuals...");
      setBlueprint(result);
      setStep("result");
      await generateSeeds(result, vibe || selectedStylePack.defaultVibe);

      setQuickCreateStatus("Auto-rendering draft...");
      setIsRenderingDraft(true);
      await new Promise((resolve) => setTimeout(resolve, 1600));
      setIsRenderingDraft(false);
      setQuickCreateStatus("Draft render ready. Open advanced edits to refine scenes.");
    } catch (err) {
      console.error(err);
      setError("Quick Create failed. You can switch to Advanced mode and retry.");
      setStep("input");
      setQuickCreateStatus(null);
    }
  };

  const toggleSceneLock = (index: number) => {
    setBlueprint((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        storyboard: prev.storyboard.map((scene, idx) =>
          idx === index ? { ...scene, locked: !scene.locked } : scene
        )
      };
    });
  };

  const handleRegenerateScene = async (index: number) => {
    if (!blueprint) return;
    const scene = blueprint.storyboard[index];
    if (scene.locked) return;

    setRegeneratingSceneIndex(index);
    try {
      const regenerated = await regenerateScene(
        blueprint,
        scene,
        vibe || selectedStylePack.defaultVibe,
        lyrics,
        getGenerationProfiles()
      );

      let nextThumbnail = scene.thumbnailUrl;
      try {
        nextThumbnail = await generateVisualSeed(
          `${vibe || selectedStylePack.defaultVibe} ${regenerated.description} ${regenerated.visualStyle}`
        );
      } catch (thumbErr) {
        console.error("Scene thumbnail regeneration failed", thumbErr);
      }

      setBlueprint((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          storyboard: prev.storyboard.map((item, idx) =>
            idx === index ? { ...regenerated, thumbnailUrl: nextThumbnail, locked: false } : item
          )
        };
      });
    } catch (err) {
      console.error("Scene regeneration failed", err);
      setError("Scene regeneration failed. Please retry.");
    } finally {
      setRegeneratingSceneIndex(null);
    }
  };

  const handleJumpToScene = (timestamp: string) => {
    if (!audioRef.current) return;
    const seconds = parseTimestampToSeconds(timestamp);
    audioRef.current.currentTime = seconds;
    if (!isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const deleteBlueprint = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "blueprints", id));
      loadMyBlueprints(user.uid);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const downloadBlueprint = () => {
    if (!blueprint) return;
    const content = `
# MUSIC VIDEO BLUEPRINT: ${blueprint.title}
**Mood**: ${blueprint.overallMood}
**Style Pack**: ${selectedStylePack.name}
**Camera Profile**: ${selectedStylePack.defaultCameraProfile}
**Lighting Profile**: ${selectedStylePack.defaultLightingProfile}
**Grade Profile**: ${selectedStylePack.defaultGradeProfile}
**Colors**: ${blueprint.colorPalette.join(", ")}
**Ratio**: ${blueprint.suggestedAspectRatio}

---

## PRODUCTION STORYBOARD
${blueprint.storyboard
  .map(
    (s) => `
### [${s.timestamp}] ${s.shotType}${s.locked ? " 🔒" : ""}
*   **Action**: ${s.description}
*   **Style**: ${s.visualStyle}
*   **Optics**: ${s.lensSuggestion} on ${s.cameraRig}
*   **Motion**: ${s.cameraMovement}
*   **Light**: ${s.lighting} (${s.lightingEquipment})
`
  )
  .join("\n")}
    `;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${blueprint.title.replace(/\s+/g, "_")}_spec.md`;
    a.click();
  };

  const copyShareLink = () => {
    if (!blueprint?.id) return;
    const url = `${window.location.origin}${window.location.pathname}?id=${blueprint.id}`;
    navigator.clipboard.writeText(url);
    alert("Share link copied to clipboard!");
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 min-h-screen relative z-10">
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md mb-12 -mx-6 -mt-12 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-brand to-accent-pink rounded-lg flex items-center justify-center font-bold italic tracking-tighter shadow-lg shadow-brand/20">B</div>
          <h1 className="text-lg font-medium tracking-wide uppercase">BeatVision<span className="text-brand">.AI</span></h1>
        </div>
        <div className="hidden md:flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
          {user ? (
            <>
              <button onClick={() => setStep("history")} className="flex items-center gap-2 hover:text-brand transition-colors text-xs uppercase tracking-widest font-bold">
                <History className="w-3 h-3" /> History
              </button>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <img src={user.photoURL || ""} alt="" className="w-5 h-5 rounded-full" />
                <button onClick={logout} className="meta-label hover:text-brand transition-colors">Sign Out</button>
              </div>
            </>
          ) : (
            <button onClick={login} className="flex items-center gap-2 text-brand hover:brightness-110 transition-all text-xs uppercase tracking-widest font-bold">
              <LogIn className="w-4 h-4" /> Link Google Account
            </button>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === "input" && (
          <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid md:grid-cols-2 gap-8">
            <div className="glass p-8 rounded-3xl border-white/10">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2"><Music className="text-brand" /> 1. The Audio</h2>
              <div className="space-y-6">
                <div className="flex gap-2 p-1 rounded-full bg-white/5 border border-white/10 w-fit">
                  <button onClick={() => setIsQuickCreateMode(true)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${isQuickCreateMode ? "bg-brand text-white" : "text-white/50"}`}>Quick Create</button>
                  <button onClick={() => setIsQuickCreateMode(false)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${!isQuickCreateMode ? "bg-brand text-white" : "text-white/50"}`}>Advanced</button>
                </div>

                <div className="relative group">
                  <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className={`border-2 border-dashed rounded-2xl p-8 transition-colors flex flex-col items-center justify-center gap-4 ${audioFile ? "border-brand bg-brand/5" : "border-white/10 group-hover:border-brand/50"}`}>
                    <Upload className={`w-8 h-8 ${audioFile ? "text-brand" : "text-gray-400"}`} />
                    <div className="text-center">
                      <p className="font-medium">{audioFile ? audioFile.name : "Upload your track"}</p>
                      <p className="text-sm text-gray-500">Quick Create auto-runs after upload</p>
                    </div>
                  </div>
                </div>

                {audioFile && (
                  <div className="p-4 rounded-xl bg-white/5 flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[150px]">{audioFile.name}</span>
                    <button onClick={togglePlayback} className="p-2 rounded-full bg-brand text-white hover:scale-110 transition-transform">
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <audio ref={audioRef} src={audioFile ? URL.createObjectURL(audioFile) : undefined} onEnded={() => setIsPlaying(false)} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} hidden />
                  </div>
                )}
              </div>
            </div>

            <div className="glass p-8 rounded-[2rem] border-white/10 flex flex-col gap-5">
              <h2 className="meta-label flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand" /> Visual Directives</h2>
              <label className="meta-label">Style Pack</label>
              <div className="grid gap-2">
                {STYLE_PACKS.map((pack) => (
                  <button key={pack.id} onClick={() => setSelectedStylePackId(pack.id)} className={`text-left p-3 rounded-xl border transition-colors ${selectedStylePackId === pack.id ? "border-brand bg-brand/10" : "border-white/10 bg-white/5"}`}>
                    <p className="text-sm font-semibold">{pack.name}</p>
                    <p className="text-xs text-white/50">{pack.description}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 text-xs text-white/70 bg-black/30 border border-white/10 rounded-xl p-3">
                <p><strong>Camera:</strong> {selectedStylePack.defaultCameraProfile}</p>
                <p><strong>Lighting:</strong> {selectedStylePack.defaultLightingProfile}</p>
                <p><strong>Grade:</strong> {selectedStylePack.defaultGradeProfile}</p>
              </div>

              <input type="text" value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder={selectedStylePack.defaultVibe} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3" />
              <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Optional narrative context" className="w-full h-32 bg-white/5 border border-white/5 rounded-xl px-4 py-3 resize-none" />

              {!isQuickCreateMode && (
                <button onClick={handleGenerate} className="w-full bg-brand text-white font-bold py-4 rounded-full flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                  Generate with Advanced Controls <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            </div>
          </motion.div>
        )}

        {step === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <Sparkles className="w-12 h-12 text-brand animate-pulse" />
            <h2 className="text-3xl font-serif italic">{isQuickCreateMode ? "Quick Create in progress" : "Directing your masterpiece"}</h2>
            <p className="meta-label">{quickCreateStatus || "Generating storyboard and technical treatment..."}</p>
          </motion.div>
        )}

        {step === "history" && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-serif font-bold italic tracking-tighter">Your <span className="text-brand">Archive</span></h2>
              <button onClick={() => setStep("input")} className="meta-label hover:text-white transition-colors">Back to Dashboard</button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myBlueprints.length > 0 ? myBlueprints.map((bp) => (
                <div key={bp.id} className="glass p-6 rounded-[2rem] border-white/10">
                  <h3 className="text-xl font-bold mb-2 truncate">{bp.title}</h3>
                  <p className="text-sm text-white/50 italic mb-6 line-clamp-2">"{bp.overallMood}"</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setBlueprint(bp); setVibe(bp.vibe || ""); setLyrics(bp.lyrics || ""); if (bp.stylePackId) setSelectedStylePackId(bp.stylePackId); setStep("result"); }} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-brand transition-all text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"><FolderOpen className="w-3 h-3" /> View Spec</button>
                    <button onClick={() => bp.id && deleteBlueprint(bp.id)} className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-all text-white/30"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )) : <div className="col-span-full py-20 text-center glass rounded-[2rem]"><History className="w-12 h-12 text-white/10 mx-auto mb-4" /><p className="text-white/40 uppercase tracking-[0.2em] text-xs">No blueprints archived yet</p></div>}
            </div>
          </motion.div>
        )}

        {step === "result" && blueprint && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            <div className="glass p-10 rounded-[3rem] border-white/10">
              <h2 className="text-5xl font-serif font-bold mb-4 tracking-tighter">{blueprint.title}</h2>
              <p className="text-xl text-white/50 font-light italic leading-relaxed">"{blueprint.overallMood}"</p>
              <div className="mt-4 text-sm text-white/70 grid md:grid-cols-3 gap-2">
                <p><strong>Style Pack:</strong> {selectedStylePack.name}</p>
                <p><strong>Camera:</strong> {selectedStylePack.defaultCameraProfile}</p>
                <p><strong>Lighting/Grade:</strong> {selectedStylePack.defaultLightingProfile} / {selectedStylePack.defaultGradeProfile}</p>
              </div>

              {isQuickCreateMode && (
                <div className="mt-5 p-3 rounded-xl border border-brand/30 bg-brand/10 text-sm text-brand flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  {isRenderingDraft ? "Auto-rendering draft..." : quickCreateStatus || "Quick Create draft generated."}
                </div>
              )}

              <div className="flex gap-3 mt-8 flex-wrap">
                {user ? (
                  <button onClick={saveBlueprint} disabled={isSaving || !!blueprint.id} className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 uppercase tracking-widest text-[10px] ${blueprint.id ? "bg-green-500/20 text-green-500" : "bg-white/10 text-white hover:bg-white/20"}`}>
                    {isSaving ? "Saving..." : blueprint.id ? <><CheckCircle2 className="w-3 h-3" /> Saved</> : <><Save className="w-3 h-3" /> Save</>}
                  </button>
                ) : <button onClick={login} className="px-6 py-3 rounded-full bg-white/10 text-white/60 font-bold">Sign in to Save</button>}
                <button onClick={downloadBlueprint} className="px-6 py-3 rounded-full bg-brand font-bold text-white flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>
                {blueprint.id && <button onClick={copyShareLink} className="px-6 py-3 rounded-full bg-white/10 text-white font-bold flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Share</button>}
                <button onClick={() => { setIsQuickCreateMode(false); setStep("input"); }} className="px-6 py-3 rounded-full bg-white/10 text-white font-bold">Advanced Edits</button>
              </div>
            </div>

            <div>
              <h3 className="meta-label mb-6 flex items-center gap-2"><ImageIcon className="w-3 h-3 text-brand" /> {isGeneratingSeeds ? "Generating Visionary Seeds..." : "Visual Seeds"}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(visualSeeds.length > 0 ? visualSeeds : [1, 2, 3, 4]).map((src, i) => (
                  <div key={i} className="aspect-video rounded-3xl overflow-hidden glass border-white/5 relative">
                    <img src={typeof src === "string" ? src : `https://picsum.photos/seed/${vibe}-${i}/1200/800`} alt="Atmospheric Mood" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-serif italic flex items-center gap-3"><Layers className={viewMode === "storyboard" ? "text-brand" : "text-white/20"} />{viewMode === "storyboard" ? "Director's Treatment" : "Technical Breakdown"}</h3>
                <div className="flex gap-2 p-1 bg-white/5 rounded-full border border-white/10">
                  <button onClick={() => setViewMode("storyboard")} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${viewMode === "storyboard" ? "bg-brand text-white" : "text-white/40"}`}>Creative</button>
                  <button onClick={() => setViewMode("tech")} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${viewMode === "tech" ? "bg-brand text-white" : "text-white/40"}`}>Technical</button>
                </div>
              </div>

              {viewMode === "storyboard" ? (
                <div className="space-y-6">
                  {blueprint.storyboard.map((scene, idx) => (
                    <SceneCard
                      key={`${scene.timestamp}-${idx}`}
                      scene={scene}
                      index={idx}
                      isActive={activeSceneIndex === idx}
                      isRegenerating={regeneratingSceneIndex === idx}
                      onJump={() => handleJumpToScene(scene.timestamp)}
                      onRegenerate={() => handleRegenerateScene(idx)}
                      onLockToggle={() => toggleSceneLock(idx)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="glass p-8 rounded-[2rem] border-white/10 space-y-6">
                    <h4 className="meta-label text-brand flex items-center gap-2"><Camera className="w-3 h-3" /> Camera & Support List</h4>
                    <ul className="space-y-4">
                      {Array.from(new Set(blueprint.storyboard.map((s) => `${s.lensSuggestion} + ${s.cameraRig}`))).map((item, i) => <li key={i} className="text-sm text-white/70">• {item}</li>)}
                    </ul>
                  </div>
                  <div className="glass p-8 rounded-[2rem] border-white/10 space-y-6">
                    <h4 className="meta-label text-brand flex items-center gap-2"><Lightbulb className="w-3 h-3" /> Lighting & Gaffer Notes</h4>
                    <ul className="space-y-4">
                      {Array.from(new Set(blueprint.storyboard.map((s) => s.lightingEquipment))).map((item, i) => <li key={i} className="text-sm text-white/70">• {item}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SceneCardProps {
  key?: React.Key;
  scene: Scene;
  index: number;
  isActive?: boolean;
  isRegenerating?: boolean;
  onJump?: () => void;
  onRegenerate?: () => void;
  onLockToggle?: () => void;
}

function SceneCard({ scene, index, isActive, isRegenerating, onJump, onRegenerate, onLockToggle }: SceneCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0, scale: isActive ? 1.02 : 1 }}
      transition={{ delay: index * 0.08 }}
      className={`glass p-8 rounded-[2rem] flex flex-col gap-6 ${isActive ? "bg-brand/5 ring-1 ring-brand/30" : "hover:bg-white/5"}`}
      onClick={onJump}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="meta-label">Time</span>
          <p className={`text-3xl mono-value ${isActive ? "text-brand" : "text-white"}`}>{scene.timestamp}</p>
          <p className="text-xs text-white/50 uppercase tracking-wider mt-1">{scene.shotType}</p>
        </div>
        <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <button
            onClick={onLockToggle}
            className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest border ${scene.locked ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-white/20 text-white/60 bg-white/5"}`}
          >
            {scene.locked ? <Lock className="w-3 h-3 inline mr-1" /> : <Unlock className="w-3 h-3 inline mr-1" />}
            {scene.locked ? "Locked" : "Lock Scene"}
          </button>
          <button
            onClick={onRegenerate}
            disabled={scene.locked || isRegenerating}
            className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest border border-brand/40 text-brand bg-brand/10 disabled:opacity-50"
          >
            <Wand2 className="w-3 h-3 inline mr-1" />
            {isRegenerating ? "Regenerating..." : "Regenerate Scene"}
          </button>
        </div>
      </div>

      <p className="text-gray-300">{scene.description}</p>

      {scene.thumbnailUrl && (
        <div className="w-full md:w-64 aspect-video rounded-2xl overflow-hidden glass border-white/10">
          <img src={scene.thumbnailUrl} alt="Scene Reference" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-white/5">
        <div><span className="meta-label block mb-1">Style</span><span className="text-xs text-brand/80 font-bold uppercase tracking-tight">{scene.visualStyle}</span></div>
        <div><span className="meta-label block mb-1">Camera</span><span className="text-[10px] text-white/80 font-mono italic leading-tight">{scene.cameraMovement}<br />{scene.lensSuggestion}</span></div>
        <div><span className="meta-label block mb-1">Rig</span><span className="text-xs text-white/80 font-mono italic">{scene.cameraRig}</span></div>
        <div><span className="meta-label block mb-1">Lighting</span><span className="text-[10px] text-white/80 font-mono italic leading-tight">{scene.lighting}<br />{scene.lightingEquipment}</span></div>
      </div>
    </motion.div>
  );
}
