"use client";

import { Eye, EyeOff } from "lucide-react";
import { useDashboard } from "./DashboardContext";

export default function AvatarToggle() {
  const { showAvatar, setShowAvatar } = useDashboard();

  const toggleAvatar = () => {
    setShowAvatar(!showAvatar);
  };

  return (
    <button
      onClick={toggleAvatar}
      className="flex items-center gap-2 px-4 py-2 sm:py-2.5 h-[38px] sm:h-[44px] bg-white/60 hover:bg-white text-stone-600 hover:text-stone-900 transition-colors border border-stone-200/60 shadow-sm rounded-full backdrop-blur-sm text-sm font-semibold cursor-pointer shrink-0 overflow-hidden"
    >
      {showAvatar ? (
        <EyeOff className="w-4 h-4 shrink-0" />
      ) : (
        <Eye className="w-4 h-4 shrink-0" />
      )}
      <span className="inline-block tracking-wide min-w-max">
        {showAvatar ? "Ẩn ảnh" : "Hiện ảnh"}
      </span>
    </button>
  );
}
