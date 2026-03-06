import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { getAuthHeaders } from "../../services/hugoApi";
import { X } from "lucide-react";

const NPS_STORAGE_KEY = "hh_last_nps_date";
const NPS_INTERVAL_DAYS = 28;

function shouldShowNPS(): boolean {
  try {
    const last = localStorage.getItem(NPS_STORAGE_KEY);
    if (!last) return true;
    const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= NPS_INTERVAL_DAYS;
  } catch {
    return false;
  }
}

export function NPSSurvey() {
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Show after 30s delay if eligible
    const timer = setTimeout(() => {
      if (shouldShowNPS()) setVisible(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    // Don't update storage on dismiss — will ask again next session
  };

  const handleSubmit = async () => {
    if (score === null) return;
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      await fetch("/api/feedback/nps", {
        method: "POST",
        headers,
        body: JSON.stringify({ score, comment: comment || undefined }),
      });
      localStorage.setItem(NPS_STORAGE_KEY, new Date().toISOString());
      toast.success("Bedankt voor je score!");
      setVisible(false);
    } catch {
      toast.error("Kon score niet opslaan");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 w-[340px] bg-white rounded-[16px] shadow-xl border border-hh-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[14px] font-semibold text-hh-text">Hoe waarschijnlijk beveel je Hugo aan?</h4>
        <button onClick={dismiss} className="text-hh-muted hover:text-hh-text">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[12px] text-hh-muted mb-3">0 = zeer onwaarschijnlijk, 10 = zeer waarschijnlijk</p>

      <div className="flex gap-1 mb-3 justify-between">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            onClick={() => setScore(i)}
            className={`w-7 h-7 rounded-md text-[12px] font-medium transition-colors ${
              score === i
                ? i <= 6
                  ? "bg-hh-error text-white"
                  : i <= 8
                  ? "bg-hh-warning text-white"
                  : "bg-hh-success text-white"
                : "bg-hh-ui-50 text-hh-text hover:bg-hh-ui-200"
            }`}
          >
            {i}
          </button>
        ))}
      </div>

      {score !== null && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optioneel: waarom deze score?"
            className="w-full h-16 p-2 text-[13px] border border-hh-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-hh-primary/30 mb-2"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-hh-success hover:bg-hh-success/90 text-white text-[12px]"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "..." : "Verstuur"}
            </Button>
            <Button size="sm" variant="ghost" className="text-[12px] text-hh-muted" onClick={dismiss}>
              Later
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
