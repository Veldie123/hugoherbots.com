import { useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, Send, X } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { apiFetch } from "../../services/apiFetch";

const feedbackTypes = [
  { value: "bug_report", label: "Bug", icon: Bug, color: "text-hh-error" },
  { value: "suggestion", label: "Suggestie", icon: Lightbulb, color: "text-hh-warning" },
  { value: "general", label: "Algemeen", icon: MessageSquarePlus, color: "text-hh-primary" },
] as const;

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      setDescription("");
    } catch {
      toast.error("Kon feedback niet verzenden");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-hh-primary text-white shadow-lg hover:bg-hh-primary/90 transition-colors flex items-center justify-center"
        title="Feedback geven"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[320px] bg-white rounded-[16px] shadow-xl border border-hh-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[14px] font-semibold text-hh-text">Feedback</h4>
        <button onClick={() => setOpen(false)} className="text-hh-muted hover:text-hh-text">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mb-3">
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
        className="w-full h-24 p-3 text-[13px] border border-hh-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-hh-primary/30 focus:border-hh-primary/50"
      />

      <Button
        className="w-full mt-2 gap-2 bg-hh-primary hover:bg-hh-primary/90 text-white"
        onClick={handleSubmit}
        disabled={!description.trim() || submitting}
      >
        <Send className="w-3.5 h-3.5" />
        {submitting ? "Verzenden..." : "Verstuur"}
      </Button>
    </div>
  );
}
