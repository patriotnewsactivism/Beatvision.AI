import { AlertCircle, ChevronRight, Music, Pause, Play, Sparkles, Upload } from "lucide-react";
import { motion } from "motion/react";
import { RefObject } from "react";

interface GenerationInputProps {
  vibe: string;
  lyrics: string;
  audioFile: File | null;
  error: string | null;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  onVibeChange: (value: string) => void;
  onLyricsChange: (value: string) => void;
  onAudioFileChange: (file: File | null) => void;
  onGenerate: () => void;
  onTogglePlayback: () => void;
  onAudioEnded: () => void;
  onAudioTimeUpdate: (time: number) => void;
}

export const GenerationInput = ({
  vibe,
  lyrics,
  audioFile,
  error,
  isPlaying,
  audioRef,
  onVibeChange,
  onLyricsChange,
  onAudioFileChange,
  onGenerate,
  onTogglePlayback,
  onAudioEnded,
  onAudioTimeUpdate,
}: GenerationInputProps) => {
  return (
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
              onChange={(e) => onAudioFileChange(e.target.files?.[0] ?? null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div
              className={`border-2 border-dashed rounded-2xl p-8 transition-colors flex flex-col items-center justify-center gap-4 ${audioFile ? "border-brand bg-brand/5" : "border-white/10 group-hover:border-brand/50"}`}
            >
              <div className="p-4 rounded-full bg-white/5">
                <Upload className={`w-8 h-8 ${audioFile ? "text-brand" : "text-gray-400"}`} />
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
                onClick={onTogglePlayback}
                className="p-2 rounded-full bg-brand text-white hover:scale-110 transition-transform"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <audio
                ref={audioRef}
                src={URL.createObjectURL(audioFile)}
                onEnded={onAudioEnded}
                onTimeUpdate={(event) => onAudioTimeUpdate(event.currentTarget.currentTime)}
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
              onChange={(e) => onVibeChange(e.target.value)}
              placeholder="e.g. Cinematic Ethereal, Cyber Glitch..."
              className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 focus:border-brand/50 focus:ring-1 focus:ring-brand/50 outline-none transition-all text-sm"
            />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="meta-label mb-2 block">Narrative Context</label>
            <textarea
              value={lyrics}
              onChange={(e) => onLyricsChange(e.target.value)}
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
            onClick={onGenerate}
            className="w-full bg-brand hover:brightness-110 text-white font-bold py-4 rounded-full flex items-center justify-center gap-3 transition-all neon-glow uppercase tracking-widest text-xs active:scale-[0.98]"
          >
            Confirm Vision
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
