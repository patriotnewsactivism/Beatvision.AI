import React from "react";
import { Camera, Layers, Lightbulb, Palette, Play } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Scene } from "../../types";

interface SceneCardProps {
  scene: Scene;
  index: number;
  isActive: boolean;
  onJump: () => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({ scene, index, isActive, onJump }) => {
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
      animate={{
        opacity: 1,
        x: 0,
        scale: isActive ? 1.02 : 1,
        borderColor: isActive ? "var(--color-brand)" : "rgba(255, 255, 255, 0.1)",
      }}
      transition={{ delay: index * 0.1 }}
      onClick={onJump}
      className={`glass p-8 rounded-[2rem] flex flex-col md:flex-row gap-8 group cursor-pointer transition-all relative overflow-hidden ${isActive ? "bg-brand/5 shadow-[0_0_30px_rgba(255,78,0,0.1)] ring-1 ring-brand/30" : "hover:bg-white/5"}`}
    >
      <div
        className={`absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 rounded-full transition-opacity ${isActive ? "bg-brand/10 opacity-100" : "bg-brand/5 opacity-0 group-hover:opacity-100"}`}
      />

      <div className="md:w-32 flex flex-col items-center justify-center border-r border-white/10 pr-8">
        <span className="meta-label mb-1">Time</span>
        <span className={`text-3xl mono-value transition-colors ${isActive ? "text-brand" : "text-white group-hover:text-brand"}`}>
          {scene.timestamp}
        </span>
        {isActive && (
          <motion.div layoutId="active-indicator" className="flex items-center gap-1 mt-2 text-brand">
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
            <p className={`font-light leading-relaxed transition-colors ${isActive ? "text-white" : "text-gray-400"}`}>
              {scene.description}
            </p>
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
              <span className="text-[10px] text-white/80 font-mono italic leading-tight">
                {scene.cameraMovement}
                <br />
                {scene.lensSuggestion}
              </span>
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
              <span className="text-[10px] text-white/80 font-mono italic leading-tight">
                {scene.lighting}
                <br />
                {scene.lightingEquipment}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
