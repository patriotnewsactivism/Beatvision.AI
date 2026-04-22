import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { LoadingText } from "./LoadingText";

export const LoadingView = () => {
  return (
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
  );
};
