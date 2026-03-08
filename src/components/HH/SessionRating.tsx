import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { apiFetch } from "../../services/apiFetch";

interface SessionRatingProps {
  sessionId: string;
  onClose: () => void;
}

export function SessionRating({ sessionId, onClose }: SessionRatingProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/feedback/session-rating", {
        method: "POST",
        body: JSON.stringify({ sessionId, rating, comment: comment || undefined }),
      });
      toast.success("Bedankt voor je beoordeling!");
      onClose();
    } catch {
      toast.error("Kon beoordeling niet opslaan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-hh-ui-50 rounded-[16px] border border-hh-border">
      <p className="text-[14px] font-medium text-hh-text mb-3">Hoe nuttig was dit gesprek?</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(star)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`w-6 h-6 ${
                star <= (hover || rating)
                  ? "text-hh-warning fill-hh-warning"
                  : "text-hh-border"
              }`}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optioneel: vertel meer..."
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
            <Button size="sm" variant="ghost" className="text-[12px] text-hh-muted" onClick={onClose}>
              Overslaan
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
