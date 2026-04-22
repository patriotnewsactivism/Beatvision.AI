import { History } from "lucide-react";
import { motion } from "motion/react";
import { VideoBlueprint } from "../../types";
import { HistoryCard } from "./HistoryCard";

interface HistoryViewProps {
  myBlueprints: VideoBlueprint[];
  onBack: () => void;
  onView: (blueprint: VideoBlueprint) => void;
  onDelete: (id: string) => void;
}

export const HistoryView = ({ myBlueprints, onBack, onView, onDelete }: HistoryViewProps) => {
  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-serif font-bold italic tracking-tighter">
          Your <span className="text-brand">Archive</span>
        </h2>
        <button onClick={onBack} className="meta-label hover:text-white transition-colors">
          Back to Dashboard
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myBlueprints.length > 0 ? (
          myBlueprints.map((blueprint) => (
            <HistoryCard
              key={blueprint.id ?? blueprint.title}
              blueprint={blueprint}
              onView={onView}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="col-span-full py-20 text-center glass rounded-[2rem]">
            <History className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 uppercase tracking-[0.2em] text-xs">No blueprints archived yet</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
