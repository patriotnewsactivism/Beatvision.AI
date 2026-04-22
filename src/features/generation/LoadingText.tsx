import { motion } from "motion/react";

interface LoadingTextProps {
  text: string;
  delay: number;
}

export const LoadingText = ({ text, delay }: LoadingTextProps) => {
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
};
