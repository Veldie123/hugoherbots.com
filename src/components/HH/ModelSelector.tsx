import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Sparkles, Cpu } from "lucide-react";
import { hugoApi } from "../../services/hugoApi";

// ── Types ───────────────────────────────────────────────────────────────────

export type EngineModel = "v2" | "v3";

type ViewMode = "admin" | "coaching";

interface ModelOption {
  id: EngineModel;
  name: string;
  version: string;
  description: string;
  icon: React.ReactNode;
}

interface Props {
  currentModel: EngineModel;
  onModelChange: (model: EngineModel) => void;
  viewMode?: ViewMode;
  disabled?: boolean;
}

// ── Model Options ───────────────────────────────────────────────────────────

const MODELS: ModelOption[] = [
  {
    id: "v2",
    name: "HugoGPT",
    version: "v1.0",
    description: "Multi-engine coaching (productie)",
    icon: <Cpu size={14} />,
  },
  {
    id: "v3",
    name: "HugoClaw",
    version: "V3",
    description: "Claude agent (experimenteel)",
    icon: <Sparkles size={14} />,
  },
];

// ── Component ───────────────────────────────────────────────────────────────

export function ModelSelector({ currentModel, onModelChange, viewMode = "coaching", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [hasV3Access, setHasV3Access] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = MODELS.find(m => m.id === currentModel) || MODELS[0];

  // Check V3 access on mount
  useEffect(() => {
    hugoApi.checkV3Access().then((access) => {
      const hasAccess = viewMode === "admin" ? access.admin_v3 : access.coaching_v3;
      setHasV3Access(hasAccess);
    });
  }, [viewMode]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // No V3 access AND not currently on V3: static label only
  if (!hasV3Access && currentModel !== "v3") {
    return (
      <span className="text-[13px] text-hh-muted font-medium whitespace-nowrap flex items-center gap-1">
        {current.name} <span className="text-[11px] text-hh-muted/60 font-normal">{current.version}</span>
      </span>
    );
  }

  // V3 access: interactive model selector
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(prev => !prev)}
        disabled={disabled}
        className="flex items-center gap-1.5 text-[13px] font-medium text-hh-primary bg-hh-ui-50 border border-hh-border rounded-full px-3 py-1 hover:bg-hh-primary/5 hover:border-hh-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {current.icon}
        {current.name}
        <span className="text-[11px] font-normal text-hh-muted">{current.version}</span>
        <ChevronDown size={12} className={`text-hh-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[240px] bg-hh-bg border border-hh-border rounded-[12px] shadow-lg z-50 overflow-hidden">
          {MODELS.map(model => (
            <button
              key={model.id}
              onClick={() => {
                if (model.id !== currentModel) {
                  onModelChange(model.id);
                }
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hh-ui-50 transition-colors ${
                model.id === currentModel ? "bg-hh-primary/5" : ""
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                model.id === currentModel ? "bg-hh-primary text-white" : "bg-hh-ui-50 text-hh-muted"
              }`}>
                {model.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium text-hh-text">{model.name}</span>
                  <span className="text-[11px] text-hh-muted">{model.version}</span>
                </div>
                <p className="text-[11px] text-hh-muted truncate">{model.description}</p>
              </div>
              {model.id === currentModel && (
                <Check size={14} className="text-hh-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
