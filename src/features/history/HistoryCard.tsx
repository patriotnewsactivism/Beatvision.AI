import React from "react";
import { FolderOpen, Trash2 } from "lucide-react";
import { VideoBlueprint } from "../../types";
import { formatCreatedAt } from "./historyUtils";

interface HistoryCardProps {
  blueprint: VideoBlueprint;
  onView: (blueprint: VideoBlueprint) => void;
  onDelete: (id: string) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({ blueprint, onView, onDelete }) => {
  return (
    <div className="glass p-6 rounded-[2rem] border-white/10 group hover:bg-white/5 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {blueprint.colorPalette.slice(0, 3).map((color, index) => (
            <div
              key={`${blueprint.id ?? "draft"}-color-${index}`}
              className="w-3 h-3 rounded-full border border-white/10"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono text-white/30">{formatCreatedAt(blueprint.createdAt)}</span>
      </div>
      <h3 className="text-xl font-bold mb-2 group-hover:text-brand transition-colors truncate">{blueprint.title}</h3>
      <p className="text-sm text-white/50 italic mb-6 line-clamp-2">"{blueprint.overallMood}"</p>

      <div className="flex gap-2">
        <button
          onClick={() => onView(blueprint)}
          className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-brand hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <FolderOpen className="w-3 h-3" /> View Spec
        </button>
        <button
          onClick={() => blueprint.id && onDelete(blueprint.id)}
          className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-all text-white/30"
          aria-label="Delete blueprint"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
