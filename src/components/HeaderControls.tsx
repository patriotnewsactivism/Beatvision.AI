import { History, LogIn } from "lucide-react";
import { User } from "firebase/auth";

interface HeaderControlsProps {
  user: User | null;
  onOpenHistory: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export const HeaderControls = ({ user, onOpenHistory, onLogin, onLogout }: HeaderControlsProps) => {
  return (
    <div className="hidden md:flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
      {user ? (
        <>
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-2 hover:text-brand transition-colors text-xs uppercase tracking-widest font-bold"
          >
            <History className="w-3 h-3" /> History
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <img src={user.photoURL ?? ""} alt="" className="w-5 h-5 rounded-full" />
            <button onClick={onLogout} className="meta-label hover:text-brand transition-colors">
              Sign Out
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={onLogin}
          className="flex items-center gap-2 text-brand hover:brightness-110 transition-all text-xs uppercase tracking-widest font-bold"
        >
          <LogIn className="w-4 h-4" /> Link Google Account
        </button>
      )}
    </div>
  );
};
