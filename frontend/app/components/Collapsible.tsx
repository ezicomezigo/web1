"use client";

import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  children: ReactNode;
}

export default function Collapsible({ title, open, onToggle, summary, children }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-3 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {!open && summary && (
          <span className="text-xs text-gray-400 truncate flex-1 text-left">— {summary}</span>
        )}
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  );
}
