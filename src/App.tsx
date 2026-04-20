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
  FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateMusicVideoBlueprint } from "./services/geminiService";
import { generateVisualSeed } from "./services/imageService";
import { VideoBlueprint, Scene } from "./types";
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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) loadMyBlueprints(u.uid);
    });

    // Check for shared ID in URL
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('id');
    if (sharedId) loadSharedBlueprint(sharedId);

    return () => unsubscribe();
  }, []);

  const loadSharedBlueprint = async (id: string) => {
    setStep("loading");
    try {
      const docSnap = await getDocs(query(collection(db, "blueprints"), where("__name__", "==", id)));
      if (!docSnap.empty) {
        const data = { id: docSnap.docs[0].id, ...docSnap.docs[0].data() } as VideoBlueprint;
        setBlueprint(data);
        setVibe(data.vibe || "");
        setLyrics(data.lyrics || "");
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
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VideoBlueprint));
      setMyBlueprints(docs);
    } catch (err) {
      console.error("Failed to load blueprints", err);
    }
  };

  const saveBlueprint = async () => {
    if (!user || !blueprint) return;
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, "blueprints"), {
        ...blueprint,
        userId: user.uid,
        vibe,
        lyrics,
        createdAt: serverTimestamp()
      });
      setBlueprint({ ...blueprint, id: docRef.id });
      loadMyBlueprints(user.uid);
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!blueprint || !audioFile) return;

    const parseTimestamp = (ts: string) => {
      const parts = ts.split(':').map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0];
    };

    const currentScene = blueprint.storyboard.reduce((acc, scene, idx) => {
      if (currentTime >= parseTimestamp(scene.timestamp)) return idx;
      return acc;
    }, -1);

    setActiveSceneIndex(currentScene);
  }, [currentTime, blueprint, audioFile]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  const handleGenerate = async () => {
    if (!vibe && !lyrics && !audioFile) {
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

      const result = await generateMusicVideoBlueprint(
        vibe, 
        lyrics, 
        audioRef.current?.duration || 180,
        audioData
      );
      setBlueprint(result);
      setStep("result");

      // Background generate visual seeds
      setIsGeneratingSeeds(true);
      try {
        const structuralSeeds = await Promise.all([
          generateVisualSeed(`${vibe} ${result.title} visual 1`),
          generateVisualSeed(`${vibe} abstract lighting reference`)
        ]);
        setVisualSeeds(structuralSeeds);

        // Generate seeds for first 6 scenes
        const sceneSeeds = await Promise.all(
          result.storyboard.slice(0, 6).map(s => 
            generateVisualSeed(`${vibe} scene: ${s.description.slice(0, 50)} style: ${s.visualStyle}`)
          )
        );
        
        const updatedStoryboard = result.storyboard.map((s, i) => ({
          ...s,
          thumbnailUrl: sceneSeeds[i] || undefined
        }));

        setBlueprint({ ...result, storyboard: updatedStoryboard });
      } catch (e) {
        console.error("Seeds generation failed", e);
      } finally {
        setIsGeneratingSeeds(false);
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong while generating your blueprint. Please try again.");
      setStep("input");
    }
  };

  const handleJumpToScene = (timestamp: string) => {
    if (!audioRef.current) return;
    const parts = timestamp.split(':').map(Number);
    const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
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
**Colors**: ${blueprint.colorPalette.join(", ")}
**Ratio**: ${blueprint.suggestedAspectRatio}

---

## PRODUCTION STORYBOARD
${blueprint.storyboard.map(s => `
### [${s.timestamp}] ${s.shotType}
*   **Action**: ${s.description}
*   **Style**: ${s.visualStyle}
*   **Optics**: ${s.lensSuggestion} on ${s.cameraRig}
*   **Motion**: ${s.cameraMovement}
*   **Light**: ${s.lighting} (${s.lightingEquipment})
`).join("\n")}

---

## TECHNICAL GEAR LIST
### Optics
${Array.from(new Set(blueprint.storyboard.map(s => s.lensSuggestion))).map(l => `- ${l}`).join("\n")}

### Support
${Array.from(new Set(blueprint.storyboard.map(s => s.cameraRig))).map(r => `- ${r}`).join("\n")}

### Lighting Notes
${Array.from(new Set(blueprint.storyboard.map(s => s.lightingEquipment))).map(e => `- ${e}`).join("\n")}
    `;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${blueprint.title.replace(/\s+/g, '_')}_spec.md`;
    a.click();
  };

  const copyShareLink = () => {
    if (!blueprint?.id) return;
    const url = `${window.location.origin}${window.location.pathname}?id=${blueprint.id}`;
    navigator.clipboard.writeText(url);
    alert("Share link copied to clipboard!");
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 min-h-screen relative z-10">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md mb-12 -mx-6 -mt-12 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-brand to-accent-pink rounded-lg flex items-center justify-center font-bold italic tracking-tighter shadow-lg shadow-brand/20">B</div>
          <h1 className="text-lg font-medium tracking-wide uppercase">BeatVision<span className="text-brand">.AI</span></h1>
        </div>

        <div className="hidden md:flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
          {user ? (
            <>
              <button 
                onClick={() => setStep("history")}
                className="flex items-center gap-2 hover:text-brand transition-colors text-xs uppercase tracking-widest font-bold"
              >
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

        <div className="flex items-center gap-4">
          {audioFile && (
            <div className="hidden lg:flex items-center gap-2 pr-4 border-r border-white/10">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Active:</span>
              <span className="text-[10px] text-white/60 font-mono truncate max-w-[100px]">{audioFile.name}</span>
            </div>
          )}
          <div className="w-2 h-2 rounded-full bg-brand pulse-neon neon-glow" />
        </div>
      </header>

      <div className="text-center mb-16">
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="meta-label mb-2"
        >
          Visual Storyboarding Engine
        </motion.p>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-7xl font-serif font-black tracking-tighter mb-4"
        >
          Automated <span className="text-brand italic">Symmetry</span>
        </motion.h1>
      </div>

      <AnimatePresence mode="wait">
        {step === "input" && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid md:grid-cols-2 gap-8"
          >
            <div className="glass p-8 rounded-3xl border-white/10">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <Music className="text-brand" /> 1. The Audio
              </h2>
              
              <div className="space-y-6">
                <div className="relative group">
                  <input 
                    type="file" 
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`border-2 border-dashed rounded-2xl p-8 transition-colors flex flex-col items-center justify-center gap-4 ${audioFile ? 'border-brand bg-brand/5' : 'border-white/10 group-hover:border-brand/50'}`}>
                    <div className="p-4 rounded-full bg-white/5">
                      <Upload className={`w-8 h-8 ${audioFile ? 'text-brand' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{audioFile ? audioFile.name : "Select your track"}</p>
                      <p className="text-sm text-gray-500">MP3, WAV or AAC supported</p>
                    </div>
                  </div>
                </div>

                {audioFile && (
                  <div className="p-4 rounded-xl bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-brand/20">
                        <Music className="w-4 h-4 text-brand" />
                      </div>
                      <span className="text-sm font-medium truncate max-w-[150px]">{audioFile.name}</span>
                    </div>
                    <button 
                      onClick={togglePlayback}
                      className="p-2 rounded-full bg-brand text-white hover:scale-110 transition-transform"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <audio 
                      ref={audioRef}
                      src={audioFile ? URL.createObjectURL(audioFile) : undefined} 
                      onEnded={() => setIsPlaying(false)}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      hidden 
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="glass p-8 rounded-[2rem] border-white/10 flex flex-col">
              <h2 className="meta-label mb-6 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-brand" /> Visual Directives
              </h2>
              
              <div className="space-y-6 flex-1">
                <div>
                  <label className="meta-label mb-2 block">Atmosphere Seed</label>
                  <input 
                    type="text"
                    value={vibe}
                    onChange={(e) => setVibe(e.target.value)}
                    placeholder="e.g. Cinematic Ethereal, Cyber Glitch..."
                    className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 focus:border-brand/50 focus:ring-1 focus:ring-brand/50 outline-none transition-all text-sm"
                  />
                </div>
                
                <div className="flex-1 flex flex-col">
                  <label className="meta-label mb-2 block">Narrative Context</label>
                  <textarea 
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="Input themes or story beats for deeper analysis..."
                    className="w-full h-40 bg-white/5 border border-white/5 rounded-xl px-4 py-3 focus:border-brand/50 focus:ring-1 focus:ring-brand/50 outline-none transition-all resize-none mb-6 text-sm"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button 
                  onClick={handleGenerate}
                  className="w-full bg-brand hover:brightness-110 text-white font-bold py-4 rounded-full flex items-center justify-center gap-3 transition-all neon-glow uppercase tracking-widest text-xs active:scale-[0.98]"
                >
                  Confirm Vision
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === "loading" && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="relative mb-8">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 rounded-full border-t-2 border-brand"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-brand pulse-neon" />
              </div>
            </div>
            <h2 className="text-3xl font-serif italic mb-4">Directing your masterpiece...</h2>
            <div className="flex flex-col gap-2">
              <LoadingText text="Analyzing sonic frequencies" delay={0} />
              <LoadingText text="Generating conceptual storyboards" delay={1.5} />
              <LoadingText text="Applying cinematic color theory" delay={3} />
            </div>
          </motion.div>
        )}

        {step === "history" && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-serif font-bold italic tracking-tighter">Your <span className="text-brand">Archive</span></h2>
              <button 
                onClick={() => setStep("input")}
                className="meta-label hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myBlueprints.length > 0 ? myBlueprints.map((bp) => (
                <div key={bp.id} className="glass p-6 rounded-[2rem] border-white/10 group hover:bg-white/5 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-1">
                      {bp.colorPalette.slice(0, 3).map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-white/30">{bp.createdAt ? new Date((bp.createdAt as any).seconds * 1000).toLocaleDateString() : 'Draft'}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-brand transition-colors truncate">{bp.title}</h3>
                  <p className="text-sm text-white/50 italic mb-6 line-clamp-2">"{bp.overallMood}"</p>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setBlueprint(bp);
                        setVibe(bp.vibe || "");
                        setLyrics(bp.lyrics || "");
                        setStep("result");
                      }}
                      className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-brand hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <FolderOpen className="w-3 h-3" /> View Spec
                    </button>
                    <button 
                      onClick={() => bp.id && deleteBlueprint(bp.id)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-all text-white/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-20 text-center glass rounded-[2rem]">
                  <History className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/40 uppercase tracking-[0.2em] text-xs">No blueprints archived yet</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === "result" && blueprint && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="space-y-12"
          >
            {/* Overview Card */}
            <div className="glass p-10 rounded-[3rem] border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 blur-[100px] -mr-32 -mt-32 rounded-full group-hover:bg-brand/20 transition-colors" />
              
              <div className="grid md:grid-cols-2 gap-12 items-end relative z-10">
                <div>
                  <div className="flex items-center gap-2 text-brand mb-4">
                    <div className="w-2 h-2 rounded-full bg-brand neon-glow" />
                    <span className="meta-label text-brand">Blueprint Finalized</span>
                  </div>
                  <h2 className="text-5xl font-serif font-bold mb-4 tracking-tighter">{blueprint.title}</h2>
                  <p className="text-xl text-white/50 font-light italic leading-relaxed">
                    "{blueprint.overallMood}"
                  </p>
                  
                  <div className="flex gap-4 mt-8">
                    {user ? (
                      <button 
                        onClick={saveBlueprint}
                        disabled={isSaving || !!blueprint.id}
                        className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all uppercase tracking-widest text-[10px] ${blueprint.id ? 'bg-green-500/20 text-green-500 border border-green-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
                      >
                        {isSaving ? "Saving..." : blueprint.id ? <><CheckCircle2 className="w-3 h-3" /> Saved to Library</> : <><Save className="w-3 h-3" /> Save to Library</>}
                      </button>
                    ) : (
                      <button 
                        onClick={login}
                        className="px-6 py-3 rounded-full bg-white/10 text-white/60 font-bold hover:bg-white/20 transition-all uppercase tracking-widest text-[10px]"
                      >
                        Sign in to Save
                      </button>
                    )}
                    <button 
                      onClick={downloadBlueprint}
                      className="px-6 py-3 rounded-full bg-brand font-bold text-white flex items-center gap-2 hover:brightness-110 transition-all neon-glow uppercase tracking-widest text-[10px]"
                    >
                      <Download className="w-4 h-4" /> Export Video Spec
                    </button>
                    {blueprint.id && (
                      <button 
                        onClick={copyShareLink}
                        className="px-6 py-3 rounded-full bg-white/10 text-white font-bold flex items-center gap-2 hover:bg-white/20 transition-all uppercase tracking-widest text-[10px]"
                      >
                        <FolderOpen className="w-4 h-4" /> Share Link
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-8 justify-between md:justify-end">
                  <div className="text-right">
                    <span className="meta-label mb-3 block">Chromatic Profile</span>
                    <div className="flex gap-2 justify-end">
                      {blueprint.colorPalette.map((color, i) => (
                        <div 
                          key={i} 
                          className="w-10 h-10 rounded-xl border border-white/10 shadow-2xl" 
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="meta-label mb-3 block">Resolution Data</span>
                    <span className="px-4 py-2 rounded-xl bg-white/5 mono-value text-lg border border-white/10">1080p | {blueprint.suggestedAspectRatio}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inspiration Grid */}
            <div>
              <h3 className="meta-label mb-6 flex items-center gap-2">
                <ImageIcon className="w-3 h-3 text-brand" /> {isGeneratingSeeds ? "Generating Visionary Seeds..." : "Visual Seeds"}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(visualSeeds.length > 0 ? visualSeeds : [1, 2, 3, 4]).map((src, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + (i * 0.1) }}
                    className="aspect-video rounded-3xl overflow-hidden glass border-white/5 group relative"
                  >
                    <img 
                      src={typeof src === 'string' ? src : `https://picsum.photos/seed/${vibe}-${i}/1200/800`} 
                      alt="Atmospheric Mood"
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-cover transition-all duration-700 hover:scale-110 ${typeof src === 'string' ? '' : 'grayscale opacity-50 contrast-125 group-hover:grayscale-0 group-hover:opacity-100'}`}
                    />
                    {isGeneratingSeeds && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 meta-label text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      Ref_{i + 1}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Timelines & Storyboard */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-serif italic flex items-center gap-3">
                  <Layers className={viewMode === "storyboard" ? "text-brand" : "text-white/20"} /> 
                  {viewMode === "storyboard" ? "Director's Treatment" : "Technical Breakdown"}
                </h3>
                <div className="flex gap-2 p-1 bg-white/5 rounded-full border border-white/10">
                  <button 
                    onClick={() => setViewMode("storyboard")}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "storyboard" ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-white/40 hover:text-white'}`}
                  >
                    Creative
                  </button>
                  <button 
                    onClick={() => setViewMode("tech")}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "tech" ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-white/40 hover:text-white'}`}
                  >
                    Technical
                  </button>
                </div>
              </div>
              
              <div className="space-y-6">
                {viewMode === "storyboard" ? (
                  blueprint.storyboard.map((scene, idx) => (
                    <SceneCard 
                      key={idx} 
                      scene={scene} 
                      index={idx} 
                      isActive={activeSceneIndex === idx}
                      onJump={() => handleJumpToScene(scene.timestamp)}
                    />
                  ))
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="glass p-8 rounded-[2rem] border-white/10 space-y-6">
                      <h4 className="meta-label text-brand flex items-center gap-2">
                        <Camera className="w-3 h-3" /> Camera & Support List
                      </h4>
                      <ul className="space-y-4">
                        {Array.from(new Set(blueprint.storyboard.map(s => `${s.lensSuggestion} + ${s.cameraRig}`))).map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-sm text-white/70">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand/40" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="glass p-8 rounded-[2rem] border-white/10 space-y-6">
                      <h4 className="meta-label text-brand flex items-center gap-2">
                        <Lightbulb className="w-3 h-3" /> Lighting & Gaffer Notes
                      </h4>
                      <ul className="space-y-4">
                        {Array.from(new Set(blueprint.storyboard.map(s => s.lightingEquipment))).map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-sm text-white/70">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand/40" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background purely decorative dots */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:40px_40px]" />
    </div>
  );
}

function LoadingText({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.p 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 1 }}
      className="text-gray-500 font-mono text-xs uppercase tracking-[0.3em]"
    >
      {text}...
    </motion.p>
  );
}

interface SceneCardProps {
  scene: Scene;
  index: number;
  isActive?: boolean;
  onJump?: () => void;
  key?: React.Key;
}

function SceneCard({ scene, index, isActive, onJump }: SceneCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive]);

  return (
    <motion.div 
      ref={cardRef}
      initial={{ opacity: 0, x: -20 }}
      animate={{ 
        opacity: 1, 
        x: 0,
        scale: isActive ? 1.02 : 1,
        borderColor: isActive ? "var(--color-brand)" : "rgba(255, 255, 255, 0.1)"
      }}
      transition={{ delay: index * 0.1 }}
      onClick={onJump}
      className={`glass p-8 rounded-[2rem] flex flex-col md:flex-row gap-8 group cursor-pointer transition-all relative overflow-hidden ${isActive ? 'bg-brand/5 shadow-[0_0_30px_rgba(255,78,0,0.1)] ring-1 ring-brand/30' : 'hover:bg-white/5'}`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 rounded-full transition-opacity ${isActive ? 'bg-brand/10 opacity-100' : 'bg-brand/5 opacity-0 group-hover:opacity-100'}`} />
      
      <div className="md:w-32 flex flex-col items-center justify-center border-r border-white/10 pr-8">
        <span className="meta-label mb-1">Time</span>
        <span className={`text-3xl mono-value transition-colors ${isActive ? 'text-brand' : 'text-white group-hover:text-brand'}`}>{scene.timestamp}</span>
        {isActive && (
          <motion.div 
            layoutId="active-indicator"
            className="flex items-center gap-1 mt-2 text-brand"
          >
            <Play className="w-3 h-3 fill-current" />
            <span className="text-[8px] font-bold uppercase tracking-widest">Live</span>
          </motion.div>
        )}
      </div>
      
      <div className="flex-1 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="meta-label text-brand mb-2 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-brand/10 text-[10px] border border-brand/20">{scene.shotType}</span>
              Storyboard Directive
            </h4>
            <p className={`font-light leading-relaxed transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`}>{scene.description}</p>
          </div>
          {scene.thumbnailUrl && (
            <div className="w-full md:w-48 aspect-video rounded-2xl overflow-hidden glass border-white/10 shrink-0">
              <img 
                src={scene.thumbnailUrl} 
                alt="Scene Reference" 
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6 pt-4 border-t border-white/5">
          <div className="flex items-start gap-2">
            <Palette className="w-3 h-3 text-brand mt-1 shrink-0" />
            <div>
              <span className="meta-label block mb-1">Style</span>
              <span className="text-xs text-brand/80 font-bold uppercase tracking-tight">{scene.visualStyle}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Camera className="w-3 h-3 text-brand mt-1 shrink-0" />
            <div>
              <span className="meta-label block mb-1">Optics</span>
              <span className="text-[10px] text-white/80 font-mono italic leading-tight">{scene.cameraMovement}<br/>{scene.lensSuggestion}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Layers className="w-3 h-3 text-brand mt-1 shrink-0" />
            <div>
              <span className="meta-label block mb-1">Rig</span>
              <span className="text-xs text-white/80 font-mono italic">{scene.cameraRig}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Lightbulb className="w-3 h-3 text-brand mt-1 shrink-0" />
            <div>
              <span className="meta-label block mb-1">Lighting</span>
              <span className="text-[10px] text-white/80 font-mono italic leading-tight">{scene.lighting}<br/>{scene.lightingEquipment}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
