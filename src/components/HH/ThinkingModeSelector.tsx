import React from "react";
import type { ThinkingMode } from "../../services/hugoApi";

interface Props {
  mode: ThinkingMode;
  onChange: (mode: ThinkingMode) => void;
  disabled?: boolean;
}

const OPTIONS: { id: ThinkingMode; label: string }[] = [
  { id: "fast", label: "Snel" },
  { id: "auto", label: "Auto" },
  { id: "deep", label: "Diep" },
];

export function ThinkingModeSelector({ mode, onChange, disabled }: Props) {
  return (
    <div className="inline-flex items-center bg-hh-ui-50 border border-hh-border rounded-full p-0.5 gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          disabled={disabled}
          className={`text-[12px] font-medium px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
            mode === opt.id
              ? "bg-hh-primary text-white shadow-sm"
              : "text-hh-muted hover:text-hh-text"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
