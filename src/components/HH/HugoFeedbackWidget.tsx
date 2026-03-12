import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Flag, Crosshair, Send, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/services/apiFetch";
import { toCanvas } from "html-to-image";

// ── Types ────────────────────────────────────────────────────────────────────

interface ElementRef {
  selector: string;
  tagName: string;
  textContent: string;
}

interface HugoFeedbackWidgetProps {
  currentPage?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Build flag cursor SVG data URI with dynamic color */
function buildFlagCursor(hexColor: string): string {
  const encoded = hexColor.replace("#", "%23");
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='${encoded}' stroke='${encoded}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z'/%3E%3Cline x1='4' y1='22' x2='4' y2='15'/%3E%3C/svg%3E") 4 4, crosshair`;
}

/** Draw highlight rectangles on canvas for selected elements */
function drawElementHighlights(canvas: HTMLCanvasElement, elRefs: ElementRef[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx || elRefs.length === 0) return;
  for (const ref of elRefs) {
    try {
      const target = document.querySelector(ref.selector);
      if (!target) continue;
      const rect = (target as HTMLElement).getBoundingClientRect();
      // Canvas coordinates match viewport coordinates (html2canvas x/y = scrollX/Y)
      const x = rect.left;
      const y = rect.top;
      // Red dashed outline
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(x, y, rect.width, rect.height);
      // Label background
      const label = `\u{1F6A9} <${ref.tagName}>`;
      ctx.font = "bold 12px sans-serif";
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
      ctx.fillRect(x, y - 20, textW + 8, 18);
      // Label text
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(label, x + 4, y - 6);
      ctx.setLineDash([]);
    } catch { /* selector might not match */ }
  }
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

  // Detect admin context (portal exits .admin-session CSS scope)
  const [isAdminContext, setIsAdminContext] = useState(false);
  useEffect(() => {
    setIsAdminContext(!!document.querySelector(".admin-session"));
  }, []);

  // Resolve primary color dynamically (admin = purple, user = steel blue)
  const getPrimaryHex = useCallback(() => {
    const src = document.querySelector(".admin-session") || document.documentElement;
    return getComputedStyle(src).getPropertyValue("--hh-primary").trim() || "#4F7396";
  }, []);

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

  // ── Reposition popup when it overflows viewport ────────────────────────────

  useEffect(() => {
    if (!popupRef.current || !popupPosition) return;
    // Wait one frame for DOM to settle after element list change
    requestAnimationFrame(() => {
      if (!popupRef.current || !popupPosition) return;
      const rect = popupRef.current.getBoundingClientRect();
      const maxY = window.innerHeight - rect.height - 16;
      const maxX = window.innerWidth - rect.width - 16;
      if (popupPosition.y > maxY || popupPosition.x > maxX) {
        setPopupPosition({
          x: Math.max(16, Math.min(popupPosition.x, maxX)),
          y: Math.max(16, Math.min(popupPosition.y, maxY)),
        });
      }
    });
  }, [elements.length, popupPosition]);

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
      // Dynamic flag cursor color (purple in admin, steel blue in user view)
      document.body.style.cursor = buildFlagCursor(getPrimaryHex());
      return () => {
        document.removeEventListener("mousemove", handleMouseMove, true);
        document.removeEventListener("click", handleClick, true);
        document.removeEventListener("keydown", handleKeyDown, true);
        document.body.style.cursor = "";
      };
    }
  }, [selecting, handleMouseMove, handleClick, handleKeyDown, getPrimaryHex]);

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

      // Screenshot capture via html-to-image (supports modern CSS like oklab)
      let screenshotOk = false;
      try {
        const canvas = await Promise.race([
          toCanvas(document.body, {
            width: window.innerWidth,
            height: window.innerHeight,
            pixelRatio: 1,
            filter: (el: Node) => {
              if (el instanceof HTMLElement && el.hasAttribute("data-feedback-widget")) return false;
              return true;
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("screenshot timeout")), 10000)
          ),
        ]);

        // Draw element highlights on the captured canvas
        drawElementHighlights(canvas, elements);

        // Convert to JPEG blob with 5s timeout
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

      if (!screenshotOk) {
        toast.info("Screenshot kon niet gemaakt worden — feedback wordt zonder verzonden");
      }

      formData.append("description", description.trim());
      formData.append("pageUrl", currentPage || window.location.pathname);
      formData.append("elements", JSON.stringify(elements));

      const res = await apiFetch("/api/feedback/ui-change-request", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[Feedback] Server error:", res.status, text);
        throw new Error(`Server ${res.status}`);
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

  // ── Portal wrapper: inherits admin-session class for correct hh-primary ──

  const portalWrap = (children: React.ReactNode) => (
    <div className={isAdminContext ? "admin-session" : ""} data-feedback-widget="true">
      {children}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Selection mode banner — portal to body for z-index safety */}
      {selecting && createPortal(
        portalWrap(
          <div
            className="fixed left-1/2 -translate-x-1/2 top-16 text-white text-center py-2 px-6 text-[13px] font-medium z-[70] rounded-full shadow-lg bg-hh-primary"
          >
            Klik op een element — <span className="opacity-70">Esc = annuleren</span>
          </div>
        ),
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
            backgroundColor: (selecting || isPopupOpen)
              ? 'var(--hh-primary)'
              : 'color-mix(in srgb, var(--hh-primary) 12%, transparent)',
            color: (selecting || isPopupOpen) ? '#ffffff' : 'var(--hh-primary)',
          }}
          aria-label="Feedback geven"
          title="UI Feedback"
        >
          <Flag size={20} />
        </button>
      </div>

      {/* Popup — portal to body, wrapped in admin-session for correct tokens */}
      {isPopupOpen && !selecting && createPortal(
        portalWrap(
          <div
            ref={popupRef}
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

              {/* Selected elements — scrollable when many */}
              {elements.length > 0 && (
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
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
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {submitting ? "Verzenden..." : "Verstuur"}
                </Button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </>
  );
}
