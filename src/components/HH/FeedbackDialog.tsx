import { useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "sonner";
import { apiFetch } from "../../services/apiFetch";

const feedbackTypes = [
  { value: "bug_report", label: "Bug", icon: Bug, color: "text-hh-error" },
  { value: "suggestion", label: "Suggestie", icon: Lightbulb, color: "text-hh-warning" },
  { value: "general", label: "Algemeen", icon: MessageSquarePlus, color: "text-hh-primary" },
] as const;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [type, setType] = useState<string>("bug_report");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const response = await apiFetch("/api/feedback/report", {
        method: "POST",
        body: JSON.stringify({ type, description }),
      });
      if (!response.ok) throw new Error("Feedback verzenden mislukt");
      toast.success("Bedankt voor je feedback!");
      onOpenChange(false);
      setDescription("");
    } catch {
      toast.error("Kon feedback niet verzenden");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-[16px] text-hh-text">Feedback</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mt-2">
          {feedbackTypes.map((ft) => {
            const Icon = ft.icon;
            return (
              <Badge
                key={ft.value}
                variant="outline"
                className={`cursor-pointer px-3 py-1 text-[12px] ${
                  type === ft.value
                    ? "bg-hh-primary/10 text-hh-primary border-hh-primary/30"
                    : "hover:bg-hh-ui-50"
                }`}
                onClick={() => setType(ft.value)}
              >
                <Icon className={`w-3 h-3 mr-1 ${type === ft.value ? "text-hh-primary" : ft.color}`} />
                {ft.label}
              </Badge>
            );
          })}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            type === "bug_report"
              ? "Beschrijf het probleem..."
              : type === "suggestion"
              ? "Wat zou je graag zien?"
              : "Vertel ons wat je denkt..."
          }
          className="w-full h-24 p-3 mt-2 text-[13px] bg-hh-bg text-hh-text border border-hh-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-hh-primary/30 focus:border-hh-primary/50 placeholder:text-hh-muted"
        />

        <Button
          className="w-full mt-1 gap-2 bg-hh-primary hover:bg-hh-primary/90 text-white"
          onClick={handleSubmit}
          disabled={!description.trim() || submitting}
        >
          <Send className="w-3.5 h-3.5" />
          {submitting ? "Verzenden..." : "Verstuur"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
