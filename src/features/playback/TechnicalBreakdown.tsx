import { Camera, Lightbulb } from "lucide-react";

interface TechnicalBreakdownProps {
  cameraSupportItems: string[];
  lightingItems: string[];
}

export const TechnicalBreakdown = ({
  cameraSupportItems,
  lightingItems,
}: TechnicalBreakdownProps) => {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="glass p-8 rounded-[2rem] border-white/10 space-y-6">
        <h4 className="meta-label text-brand flex items-center gap-2">
          <Camera className="w-3 h-3" /> Camera & Support List
        </h4>
        <ul className="space-y-4">
          {cameraSupportItems.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-white/70">
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
          {lightingItems.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-white/70">
              <div className="w-1.5 h-1.5 rounded-full bg-brand/40" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
