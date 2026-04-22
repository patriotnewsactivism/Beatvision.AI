import { CheckCircle2, Download, FolderOpen, Save } from "lucide-react";
import { User } from "firebase/auth";
import { VideoBlueprint } from "../../types";

interface BlueprintActionsProps {
  user: User | null;
  blueprint: VideoBlueprint;
  isSaving: boolean;
  onSave: () => void;
  onLogin: () => void;
  onDownload: () => void;
  onCopyShareLink: () => void;
}

export const BlueprintActions = ({
  user,
  blueprint,
  isSaving,
  onSave,
  onLogin,
  onDownload,
  onCopyShareLink,
}: BlueprintActionsProps) => {
  return (
    <div className="flex gap-4 mt-8">
      {user ? (
        <button
          onClick={onSave}
          disabled={isSaving || Boolean(blueprint.id)}
          className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all uppercase tracking-widest text-[10px] ${blueprint.id ? "bg-green-500/20 text-green-500 border border-green-500/20" : "bg-white/10 text-white hover:bg-white/20"}`}
        >
          {isSaving ? (
            "Saving..."
          ) : blueprint.id ? (
            <>
              <CheckCircle2 className="w-3 h-3" /> Saved to Library
            </>
          ) : (
            <>
              <Save className="w-3 h-3" /> Save to Library
            </>
          )}
        </button>
      ) : (
        <button
          onClick={onLogin}
          className="px-6 py-3 rounded-full bg-white/10 text-white/60 font-bold hover:bg-white/20 transition-all uppercase tracking-widest text-[10px]"
        >
          Sign in to Save
        </button>
      )}
      <button
        onClick={onDownload}
        className="px-6 py-3 rounded-full bg-brand font-bold text-white flex items-center gap-2 hover:brightness-110 transition-all neon-glow uppercase tracking-widest text-[10px]"
      >
        <Download className="w-4 h-4" /> Export Video Spec
      </button>
      {blueprint.id && (
        <button
          onClick={onCopyShareLink}
          className="px-6 py-3 rounded-full bg-white/10 text-white font-bold flex items-center gap-2 hover:bg-white/20 transition-all uppercase tracking-widest text-[10px]"
        >
          <FolderOpen className="w-4 h-4" /> Share Link
        </button>
      )}
    </div>
  );
};
