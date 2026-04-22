/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Layers } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { generateMusicVideoBlueprint } from "./services/geminiService";
import { generateVisualSeed } from "./services/imageService";
import { VideoBlueprint } from "./types";
import { GenerationInput } from "./features/generation/GenerationInput";
import { LoadingView } from "./features/generation/LoadingView";
import { HistoryView } from "./features/history/HistoryView";
import { SceneCard } from "./features/playback/SceneCard";
import { TechnicalBreakdown } from "./features/playback/TechnicalBreakdown";
import { BlueprintActions } from "./features/sharing/BlueprintActions";
import { HeaderControls } from "./components/HeaderControls";
import { useAuth } from "./hooks/useAuth";
import { useBlueprints } from "./hooks/useBlueprints";
import { usePlaybackSync } from "./hooks/usePlaybackSync";

type ViewStep = "input" | "loading" | "result" | "history";
type ViewMode = "storyboard" | "tech";

const fileToBase64 = async (file: File): Promise<string> => {
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

export default function App() {
  const [step, setStep] = useState<ViewStep>("input");
  const [viewMode, setViewMode] = useState<ViewMode>("storyboard");
  const [vibe, setVibe] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [blueprint, setBlueprint] = useState<VideoBlueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [visualSeeds, setVisualSeeds] = useState<string[]>([]);
  const [isGeneratingSeeds, setIsGeneratingSeeds] = useState(false);

  const { user, login, logout } = useAuth();
  const { myBlueprints, isSaving, loadMyBlueprints, loadSharedBlueprint, saveBlueprint, deleteBlueprint } =
    useBlueprints();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isPlaying, setIsPlaying, activeSceneIndex, jumpToScene, togglePlayback } = usePlaybackSync({
    audioRef,
    blueprint,
    audioFile,
    currentTime,
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadMyBlueprints(user.uid).catch((loadError) => {
      console.error("Failed to load blueprints", loadError);
    });
  }, [loadMyBlueprints, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("id");

    if (!sharedId) {
      return;
    }

    setStep("loading");
    void loadSharedBlueprint(sharedId)
      .then((sharedBlueprint) => {
        if (!sharedBlueprint) {
          setStep("input");
          return;
        }

        setBlueprint(sharedBlueprint);
        setVibe(sharedBlueprint.vibe ?? "");
        setLyrics(sharedBlueprint.lyrics ?? "");
        setStep("result");
      })
      .catch((loadError) => {
        console.error("Failed to load shared blueprint", loadError);
        setStep("input");
      });
  }, [loadSharedBlueprint]);

  const handleGenerate = async () => {
    if (!vibe && !lyrics && !audioFile) {
      setError("Please provide at least a vibe, lyrics, or an audio file.");
      return;
    }

    setStep("loading");
    setError(null);

    try {
      let audioData: { data: string; mimeType: string } | undefined;
      if (audioFile) {
        const base64 = await fileToBase64(audioFile);
        audioData = { data: base64, mimeType: audioFile.type };
      }

      const result = await generateMusicVideoBlueprint(
        vibe,
        lyrics,
        audioRef.current?.duration || 180,
        audioData,
      );

      setBlueprint(result);
      setStep("result");
      setIsGeneratingSeeds(true);

      try {
        const structuralSeeds = await Promise.all([
          generateVisualSeed(`${vibe} ${result.title} visual 1`),
          generateVisualSeed(`${vibe} abstract lighting reference`),
        ]);
        setVisualSeeds(structuralSeeds);

        const sceneSeeds = await Promise.all(
          result.storyboard
            .slice(0, 6)
            .map((scene) =>
              generateVisualSeed(`${vibe} scene: ${scene.description.slice(0, 50)} style: ${scene.visualStyle}`),
            ),
        );

        const updatedStoryboard = result.storyboard.map((scene, index) => ({
          ...scene,
          thumbnailUrl: sceneSeeds[index] ?? undefined,
        }));

        setBlueprint({ ...result, storyboard: updatedStoryboard });
      } catch (seedError) {
        console.error("Seeds generation failed", seedError);
      } finally {
        setIsGeneratingSeeds(false);
      }
    } catch (generationError) {
      console.error(generationError);
      setError("Something went wrong while generating your blueprint. Please try again.");
      setStep("input");
    }
  };

  const handleSaveBlueprint = async () => {
    if (!user || !blueprint) {
      return;
    }

    try {
      const saved = await saveBlueprint({ user, blueprint, vibe, lyrics });
      setBlueprint(saved);
    } catch (saveError) {
      console.error("Save failed", saveError);
    }
  };

  const handleDeleteBlueprint = async (id: string) => {
    if (!user) {
      return;
    }

    try {
      await deleteBlueprint(user, id);
    } catch (deleteError) {
      console.error("Delete failed", deleteError);
    }
  };

  const handleDownloadBlueprint = () => {
    if (!blueprint) {
      return;
    }

    const content = `
# MUSIC VIDEO BLUEPRINT: ${blueprint.title}
**Mood**: ${blueprint.overallMood}
**Colors**: ${blueprint.colorPalette.join(", ")}
**Ratio**: ${blueprint.suggestedAspectRatio}

---

## PRODUCTION STORYBOARD
${blueprint.storyboard
  .map(
    (scene) => `
### [${scene.timestamp}] ${scene.shotType}
*   **Action**: ${scene.description}
*   **Style**: ${scene.visualStyle}
*   **Optics**: ${scene.lensSuggestion} on ${scene.cameraRig}
*   **Motion**: ${scene.cameraMovement}
*   **Light**: ${scene.lighting} (${scene.lightingEquipment})
`,
  )
  .join("\n")}

---

## TECHNICAL GEAR LIST
### Optics
${Array.from(new Set(blueprint.storyboard.map((scene) => scene.lensSuggestion)))
  .map((lens) => `- ${lens}`)
  .join("\n")}

### Support
${Array.from(new Set(blueprint.storyboard.map((scene) => scene.cameraRig)))
  .map((rig) => `- ${rig}`)
  .join("\n")}

### Lighting Notes
${Array.from(new Set(blueprint.storyboard.map((scene) => scene.lightingEquipment)))
  .map((equipment) => `- ${equipment}`)
  .join("\n")}
    `;

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${blueprint.title.replace(/\s+/g, "_")}_spec.md`;
    anchor.click();
  };

  const handleCopyShareLink = async () => {
    if (!blueprint?.id) {
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}?id=${blueprint.id}`;
    await navigator.clipboard.writeText(url);
    alert("Share link copied to clipboard!");
  };

  const cameraSupportItems = useMemo(() => {
    if (!blueprint) {
      return [];
    }

    return Array.from(new Set(blueprint.storyboard.map((scene) => `${scene.lensSuggestion} + ${scene.cameraRig}`)));
  }, [blueprint]);

  const lightingItems = useMemo(() => {
    if (!blueprint) {
      return [];
    }

    return Array.from(new Set(blueprint.storyboard.map((scene) => scene.lightingEquipment)));
  }, [blueprint]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 min-h-screen relative z-10">
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md mb-12 -mx-6 -mt-12 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-brand to-accent-pink rounded-lg flex items-center justify-center font-bold italic tracking-tighter shadow-lg shadow-brand/20">
            B
          </div>
          <h1 className="text-lg font-medium tracking-wide uppercase">
            BeatVision<span className="text-brand">.AI</span>
          </h1>
        </div>

        <HeaderControls
          user={user}
          onOpenHistory={() => setStep("history")}
          onLogin={() => void login().catch((loginError) => console.error("Login failed", loginError))}
          onLogout={() => void logout().catch((logoutError) => console.error("Logout failed", logoutError))}
        />

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
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="meta-label mb-2">
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
          <GenerationInput
            vibe={vibe}
            lyrics={lyrics}
            audioFile={audioFile}
            error={error}
            isPlaying={isPlaying}
            audioRef={audioRef}
            onVibeChange={setVibe}
            onLyricsChange={setLyrics}
            onAudioFileChange={setAudioFile}
            onGenerate={() => void handleGenerate()}
            onTogglePlayback={togglePlayback}
            onAudioEnded={() => setIsPlaying(false)}
            onAudioTimeUpdate={setCurrentTime}
          />
        )}

        {step === "loading" && <LoadingView />}

        {step === "history" && (
          <HistoryView
            myBlueprints={myBlueprints}
            onBack={() => setStep("input")}
            onView={(selectedBlueprint) => {
              setBlueprint(selectedBlueprint);
              setVibe(selectedBlueprint.vibe ?? "");
              setLyrics(selectedBlueprint.lyrics ?? "");
              setStep("result");
            }}
            onDelete={(id) => void handleDeleteBlueprint(id)}
          />
        )}

        {step === "result" && blueprint && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="space-y-12"
          >
            <div className="glass p-10 rounded-[3rem] border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 blur-[100px] -mr-32 -mt-32 rounded-full group-hover:bg-brand/20 transition-colors" />

              <div className="grid md:grid-cols-2 gap-12 items-end relative z-10">
                <div>
                  <div className="flex items-center gap-2 text-brand mb-4">
                    <div className="w-2 h-2 rounded-full bg-brand neon-glow" />
                    <span className="meta-label text-brand">Blueprint Finalized</span>
                  </div>
                  <h2 className="text-5xl font-serif font-bold mb-4 tracking-tighter">{blueprint.title}</h2>
                  <p className="text-xl text-white/50 font-light italic leading-relaxed">"{blueprint.overallMood}"</p>

                  <BlueprintActions
                    user={user}
                    blueprint={blueprint}
                    isSaving={isSaving}
                    onSave={() => void handleSaveBlueprint()}
                    onLogin={() => void login().catch((loginError) => console.error("Login failed", loginError))}
                    onDownload={handleDownloadBlueprint}
                    onCopyShareLink={() => void handleCopyShareLink()}
                  />
                </div>

                <div className="flex flex-wrap gap-8 justify-between md:justify-end">
                  <div className="text-right">
                    <span className="meta-label mb-3 block">Chromatic Profile</span>
                    <div className="flex gap-2 justify-end">
                      {blueprint.colorPalette.map((color) => (
                        <div
                          key={color}
                          className="w-10 h-10 rounded-xl border border-white/10 shadow-2xl"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="meta-label mb-3 block">Resolution Data</span>
                    <span className="px-4 py-2 rounded-xl bg-white/5 mono-value text-lg border border-white/10">
                      1080p | {blueprint.suggestedAspectRatio}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="meta-label mb-6 flex items-center gap-2">
                <ImageIcon className="w-3 h-3 text-brand" />
                {isGeneratingSeeds ? "Generating Visionary Seeds..." : "Visual Seeds"}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(visualSeeds.length > 0 ? visualSeeds : [1, 2, 3, 4]).map((src, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="aspect-video rounded-3xl overflow-hidden glass border-white/5 group relative"
                  >
                    <img
                      src={typeof src === "string" ? src : `https://picsum.photos/seed/${vibe}-${index}/1200/800`}
                      alt="Atmospheric Mood"
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-cover transition-all duration-700 hover:scale-110 ${typeof src === "string" ? "" : "grayscale opacity-50 contrast-125 group-hover:grayscale-0 group-hover:opacity-100"}`}
                    />
                    {isGeneratingSeeds && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 meta-label text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      Ref_{index + 1}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-serif italic flex items-center gap-3">
                  <Layers className={viewMode === "storyboard" ? "text-brand" : "text-white/20"} />
                  {viewMode === "storyboard" ? "Director's Treatment" : "Technical Breakdown"}
                </h3>
                <div className="flex gap-2 p-1 bg-white/5 rounded-full border border-white/10">
                  <button
                    onClick={() => setViewMode("storyboard")}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "storyboard" ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-white/40 hover:text-white"}`}
                  >
                    Creative
                  </button>
                  <button
                    onClick={() => setViewMode("tech")}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "tech" ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-white/40 hover:text-white"}`}
                  >
                    Technical
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {viewMode === "storyboard" ? (
                  blueprint.storyboard.map((scene, index) => (
                    <SceneCard
                      key={`${scene.timestamp}-${index}`}
                      scene={scene}
                      index={index}
                      isActive={activeSceneIndex === index}
                      onJump={() => jumpToScene(scene.timestamp)}
                    />
                  ))
                ) : (
                  <TechnicalBreakdown cameraSupportItems={cameraSupportItems} lightingItems={lightingItems} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:40px_40px]" />
    </div>
  );
}
