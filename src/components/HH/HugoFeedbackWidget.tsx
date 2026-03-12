import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Flag, Crosshair, Send, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";

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
  const [description, setDescription] = useState("");
  const [elements, setElements] = useState<ElementRef[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isPopupOpen = popupPosition !== null;

  // Focus textarea when popup opens
  useEffect(() => {
    if (isPopupOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isPopupOpen]);

  // Close popup on click outside
  useEffect(() => {
    if (!isPopupOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-feedback-widget]")) return;
        setPopupPosition(null);
        setDescription("");
        setElements([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPopupOpen]);

  // ── Element selection handlers ───────────────────────────────────────────

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
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

      // Position popup at click location with viewport boundary check
      const x = Math.min(e.clientX, window.innerWidth - 340);
      const y = Math.min(e.clientY, window.innerHeight - 300);
      setPopupPosition({ x: Math.max(16, x), y: Math.max(16, y) });
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
      document.body.style.cursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%234F7396' stroke='%234F7396' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z'/%3E%3Cline x1='4' y1='22' x2='4' y2='15'/%3E%3C/svg%3E") 4 4, crosshair`;
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
      hoveredEl.style.outline = "2px solid var(--hh-primary)";
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
      const formData = new FormData();
      formData.append("viewportWidth", String(window.innerWidth));
      formData.append("viewportHeight", String(window.innerHeight));

      // Hide popup via CSS for clean screenshot (faster than React state)
      if (popupRef.current) popupRef.current.style.display = "none";

      let screenshotOk = false;
      try {
        const canvas = await html2canvas(document.body, {
          scale: 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: window.innerWidth,
          height: window.innerHeight,
          x: window.scrollX,
          y: window.scrollY,
          ignoreElements: (el) => el.hasAttribute("data-feedback-widget"),
        });

        // Try toBlob with 5s timeout
        let blob: Blob | null = null;
        try {
          blob = await new Promise<Blob | null>((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5000);
            canvas.toBlob(
              (b) => { clearTimeout(timeout); resolve(b); },
              "image/jpeg", 0.8
            );
          });
        } catch {
          // SecurityError on tainted canvas — fallback to dataURL
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            const dataRes = await fetch(dataUrl);
            blob = await dataRes.blob();
          } catch {
            // Canvas completely unusable
          }
        }

        if (blob && blob.size > 0) {
          formData.append("screenshot", blob, "feedback-screenshot.jpg");
          screenshotOk = true;
        }
      } catch (screenshotErr) {
        console.warn("[Feedback] Screenshot failed:", screenshotErr);
      }

      // Restore popup visibility
      if (popupRef.current) popupRef.current.style.display = "";

      if (!screenshotOk) {
        toast.info("Screenshot kon niet gemaakt worden — feedback wordt zonder verzonden");
      }

      formData.append("description", description.trim());
      formData.append("pageUrl", currentPage || window.location.pathname);
      formData.append("elements", JSON.stringify(elements));

      const res = await fetch("/api/feedback/ui-change-request", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[Feedback] Server error:", res.status, text);
        throw new Error("Verzenden mislukt");
      }
      toast.success("Feedback verzonden! Plan wordt automatisch gegenereerd.");
      setDescription("");
      setElements([]);
      setPopupPosition(null);
    } catch (err) {
      console.error("[Feedback] Submit error:", err);
      toast.error("Kon feedback niet verzenden");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Selection mode banner — portal to body for z-index safety */}
      {selecting && createPortal(
        <div
          data-feedback-widget="true"
          className="fixed left-1/2 -translate-x-1/2 top-16 text-white text-center py-2 px-6 text-[13px] font-medium z-[70] rounded-full shadow-lg"
          style={{ backgroundColor: 'var(--hh-primary)' }}
        >
          Klik op een element — <span className="opacity-70">Esc = annuleren</span>
        </div>,
        document.body
      )}

      <div data-feedback-widget="true" className="relative">
        {/* Header button — clicking starts crosshair mode directly */}
        <button
          onClick={() => {
            if (isPopupOpen) {
              setPopupPosition(null);
              setDescription("");
              setElements([]);
            } else if (selecting) {
              setSelecting(false);
              setHoveredEl(null);
            } else {
              setSelecting(true);
            }
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{
            backgroundColor: (selecting || isPopupOpen) ? 'var(--hh-primary)' : 'transparent',
            color: (selecting || isPopupOpen) ? '#ffffff' : 'var(--hh-primary)',
          }}
          aria-label="Feedback geven"
          title="UI Feedback"
        >
          <Flag size={20} />
        </button>
      </div>

      {/* Popup — portal to body to avoid stacking context issues */}
      {isPopupOpen && !selecting && createPortal(
        <div
          ref={popupRef}
          data-feedback-widget="true"
          className="fixed w-[calc(100vw-32px)] sm:w-80 bg-popover text-popover-foreground rounded-xl shadow-xl border border-hh-border z-[60] overflow-hidden flex flex-col"
          style={{
            top: `${popupPosition.y}px`,
            left: `${popupPosition.x}px`,
          }}
        >
          <div className="p-4 space-y-3">
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschrijf je suggestie..."
              rows={2}
              className="w-full resize-none rounded-lg border border-hh-border bg-popover text-popover-foreground text-[13px] px-3 py-2 placeholder:text-hh-muted focus:outline-none focus:ring-1 focus:ring-hh-primary/30 focus:border-hh-primary/50"
            />

            {/* Selected elements */}
            {elements.length > 0 && (
              <div className="space-y-1">
                {elements.map((el, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-hh-primary/8 border border-hh-primary/15 rounded-lg px-2.5 py-1.5 text-[11px]"
                  >
                    <Crosshair size={10} className="text-hh-primary flex-shrink-0" />
                    <span className="text-hh-text truncate flex-1">
                      <span className="font-mono text-hh-primary">{`<${el.tagName}>`}</span>{" "}
                      {el.textContent && (
                        <span className="text-hh-muted">"{el.textContent}"</span>
                      )}
                    </span>
                    <button
                      onClick={() =>
                        setElements((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-hh-muted hover:text-hh-error flex-shrink-0"
                      aria-label="Verwijderen"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setSelecting(true); setPopupPosition(null); }}
                className="rounded-full text-[13px] text-hh-primary border-hh-primary hover:bg-hh-primary/10"
              >
                <Plus size={13} />
                Nog een element
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                className="rounded-full text-[13px] bg-hh-primary hover:bg-hh-primary/90 text-white"
              >
                <Send size={13} />
                {submitting ? "..." : "Verstuur"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
