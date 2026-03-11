import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, Crosshair, X, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../../services/apiFetch";

// ── Types ────────────────────────────────────────────────────────────────────

interface ElementRef {
  selector: string;
  tagName: string;
  textContent: string;
}

interface HugoFeedbackWidgetProps {
  currentPage?: string | null;
}

// ── CSS path generator ───────────────────────────────────────────────────────

function getCSSPath(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }
    if (current.className && typeof current.className === "string") {
      const cls = current.className
        .split(" ")
        .filter((c) => c && !c.startsWith("hover:") && !c.startsWith("focus:"))[0];
      if (cls) selector += `.${cls}`;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const idx = Array.from(parent.children).indexOf(current) + 1;
        selector += `:nth-child(${idx})`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function getTextPreview(el: HTMLElement): string {
  const text = (el.textContent || "").trim().replace(/\s+/g, " ");
  return text.length > 60 ? text.slice(0, 57) + "..." : text;
}

// ── Component ────────────────────────────────────────────────────────────────

export function HugoFeedbackWidget({ currentPage }: HugoFeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [elements, setElements] = useState<ElementRef[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  // ── Element selection handlers ───────────────────────────────────────────

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't select the widget itself or its children
    if (target.closest("[data-feedback-widget]")) return;
    setHoveredEl(target);
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as HTMLElement;
      if (target.closest("[data-feedback-widget]")) return;

      const ref: ElementRef = {
        selector: getCSSPath(target),
        tagName: target.tagName.toLowerCase(),
        textContent: getTextPreview(target),
      };
      setElements((prev) => [...prev, ref]);
      setSelecting(false);
      setHoveredEl(null);
    },
    []
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelecting(false);
      setHoveredEl(null);
    }
  }, []);

  // Attach/detach selection listeners
  useEffect(() => {
    if (selecting) {
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener("click", handleClick, true);
      document.addEventListener("keydown", handleKeyDown, true);
      document.body.style.cursor = "crosshair";
      return () => {
        document.removeEventListener("mousemove", handleMouseMove, true);
        document.removeEventListener("click", handleClick, true);
        document.removeEventListener("keydown", handleKeyDown, true);
        document.body.style.cursor = "";
      };
    }
  }, [selecting, handleMouseMove, handleClick, handleKeyDown]);

  // Highlight hovered element
  useEffect(() => {
    if (hoveredEl) {
      hoveredEl.style.outline = "2px solid #8B5CF6";
      hoveredEl.style.outlineOffset = "2px";
      return () => {
        hoveredEl.style.outline = "";
        hoveredEl.style.outlineOffset = "";
      };
    }
  }, [hoveredEl]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Schrijf eerst een beschrijving");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/feedback/ui-change-request", {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          pageUrl: currentPage || window.location.pathname,
          elements,
        }),
      });
      if (!res.ok) throw new Error("Verzenden mislukt");
      toast.success("Feedback verzonden!");
      setDescription("");
      setElements([]);
      setOpen(false);
    } catch {
      toast.error("Kon feedback niet verzenden");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div data-feedback-widget="true" className="fixed bottom-6 right-6 z-[60]">
      {/* Selection mode banner */}
      {selecting && (
        <div className="fixed top-0 left-0 right-0 bg-[#8B5CF6] text-white text-center py-2 text-[13px] font-medium z-[70]">
          Klik op een element om het aan te duiden — <span className="opacity-70">Esc om te annuleren</span>
        </div>
      )}

      {/* Panel */}
      {open && !selecting && (
        <div
          ref={panelRef}
          className="absolute bottom-14 right-0 w-[320px] bg-hh-bg border border-hh-border rounded-[16px] shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-hh-border">
            <span className="text-[14px] font-semibold text-hh-text">
              Feedback
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-hh-muted hover:text-hh-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschrijf je suggestie..."
              rows={3}
              className="w-full resize-none rounded-lg border border-hh-border bg-hh-bg text-hh-text text-[14px] px-3 py-2 placeholder:text-hh-muted focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6]"
            />

            {/* Selected elements */}
            {elements.length > 0 && (
              <div className="space-y-1.5">
                {elements.map((el, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-lg px-2.5 py-1.5 text-[12px]"
                  >
                    <Crosshair size={12} className="text-[#8B5CF6] flex-shrink-0" />
                    <span className="text-hh-text truncate flex-1">
                      <span className="font-mono text-[#8B5CF6]">{`<${el.tagName}>`}</span>{" "}
                      {el.textContent && (
                        <span className="text-hh-muted">"{el.textContent}"</span>
                      )}
                    </span>
                    <button
                      onClick={() =>
                        setElements((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-hh-muted hover:text-hh-error flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelecting(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hh-border text-[13px] text-hh-muted hover:text-[#8B5CF6] hover:border-[#8B5CF6]/30 transition-colors"
              >
                <Crosshair size={14} />
                Aanduiden
              </button>
              <div className="flex-1" />
              <button
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-[13px] font-medium hover:bg-[#7C3AED] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={14} />
                {submitting ? "..." : "Verstuur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      {!selecting && (
        <button
          onClick={() => setOpen((prev) => !prev)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
            open
              ? "bg-hh-bg border border-hh-border text-hh-muted hover:text-hh-text"
              : "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] hover:scale-105"
          }`}
          aria-label="Feedback geven"
        >
          {open ? <X size={20} /> : <MessageSquare size={20} />}
        </button>
      )}
    </div>
  );
}
