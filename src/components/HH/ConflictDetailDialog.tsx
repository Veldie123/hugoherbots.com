import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import {
  Check,
  X,
  Clock,
  FileCode,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { cn } from "../ui/utils";

interface ConflictDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: {
    id: string;
    severity: "high" | "medium" | "low";
    type: string;
    techniqueNumber?: string;
    title: string;
    description: string;
    expertComment: string;
    suggestedFix: {
      type: "json" | "code" | "text";
      content: string;
    };
    affectedFile: string;
    timestamp: Date;
    sessionId?: string;
    transcriptExcerpt?: string;
    status: "open" | "accepted" | "rejected";
  } | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function ConflictDetailDialog({
  open,
  onOpenChange,
  conflict,
  onAccept,
  onReject,
}: ConflictDetailDialogProps) {
  if (!conflict) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-hh-error bg-hh-error/5 border-hh-error/20";
      case "medium":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "low":
        return "text-hh-muted bg-hh-ui-50 border-hh-border";
      default:
        return "";
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAcceptClick = () => {
    onAccept(conflict.id);
    onOpenChange(false);
  };

  const handleRejectClick = () => {
    onReject(conflict.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] uppercase font-semibold",
                    getSeverityColor(conflict.severity)
                  )}
                >
                  {conflict.severity}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[11px] bg-hh-ui-50 border-hh-border"
                >
                  {conflict.type}
                </Badge>
                {conflict.techniqueNumber && (
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-hh-primary/15 text-hh-primary border-hh-primary/20"
                  >
                    Techniek {conflict.techniqueNumber}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-[24px] leading-[32px] text-hh-ink">
                {conflict.title}
              </DialogTitle>
              <DialogDescription className="text-[14px] text-hh-muted">
                {conflict.description}
              </DialogDescription>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 text-[12px] text-hh-muted mb-1">
                <Clock className="w-3 h-3" />
                {formatTimestamp(conflict.timestamp)}
              </div>
              <div className="flex items-center gap-1 text-[12px] text-hh-muted">
                <FileCode className="w-3 h-3" />
                {conflict.affectedFile}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Expert Comment Section */}
          <Card className="p-5 bg-hh-primary/5 border-hh-primary/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-hh-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-[14px] font-semibold text-hh-ink mb-2">
                  Hugo's AI Expert Comment
                </h4>
                <p className="text-[14px] leading-[22px] text-hh-text">
                  {conflict.expertComment}
                </p>
              </div>
            </div>
          </Card>

          {/* Suggested Fix Section */}
          <div>
            <h4 className="text-[16px] font-semibold text-hh-ink mb-3">
              Voorgestelde aanpassing
            </h4>
            <div className="bg-hh-ui-50 border border-hh-border rounded-xl overflow-hidden">
              <div className="bg-hh-ui-100 border-b border-hh-border px-4 py-2 flex items-center justify-between">
                <span className="text-[12px] font-mono text-hh-muted">
                  {conflict.affectedFile}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase bg-white"
                >
                  {conflict.suggestedFix.type}
                </Badge>
              </div>
              <pre className="p-4 text-[13px] text-hh-text overflow-x-auto">
                <code>{conflict.suggestedFix.content}</code>
              </pre>
            </div>
          </div>

          {/* Transcript Section (if available) */}
          {conflict.transcriptExcerpt && (
            <div>
              <h4 className="text-[16px] font-semibold text-hh-ink mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Rollenspel Transcript
              </h4>
              <Card className="p-4 bg-hh-warning/5 border-hh-warning/20">
                <div className="space-y-2">
                  <div className="text-[12px] text-hh-warning font-medium">
                    Relevant fragment uit sessie {conflict.sessionId}:
                  </div>
                  <p className="text-[14px] leading-[22px] text-hh-text">
                    {conflict.transcriptExcerpt}
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* Impact Analysis */}
          <Card className="p-4 bg-hh-primary/5 border-hh-primary/20">
            <h4 className="text-[14px] font-semibold text-hh-ink mb-2">
              Impact van deze wijziging
            </h4>
            <ul className="space-y-1 text-[13px] text-hh-text">
              <li className="flex items-start gap-2">
                <span className="text-hh-primary shrink-0">•</span>
                <span>Config file wordt automatisch geüpdatet</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-hh-primary shrink-0">•</span>
                <span>Nieuwe detectie patterns worden actief bij volgende sessie</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-hh-primary shrink-0">•</span>
                <span>Rollback mogelijk via Config History</span>
              </li>
            </ul>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none"
          >
            Annuleren
          </Button>
          <Button
            variant="outline"
            onClick={handleRejectClick}
            className="flex-1 sm:flex-none gap-2 text-hh-error border-hh-error/30 hover:bg-hh-error/5"
          >
            <X className="w-4 h-4" />
            Wijs af
          </Button>
          <Button
            onClick={handleAcceptClick}
            className="flex-1 sm:flex-none gap-2 bg-hh-success hover:bg-hh-success/90"
          >
            <Check className="w-4 h-4" />
            Accepteer & Pas toe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
