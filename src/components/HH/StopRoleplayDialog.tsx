import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Square } from "lucide-react";

interface StopRoleplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function StopRoleplayDialog({
  open,
  onOpenChange,
  onConfirm,
}: StopRoleplayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden border-hh-border">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100">
              <Square className="w-4 h-4 text-slate-600" />
            </div>
            <DialogTitle className="text-[18px] font-semibold text-hh-text">
              Sessie beëindigen?
            </DialogTitle>
          </div>
          <DialogDescription className="text-[14px] text-hh-muted leading-relaxed">
            Weet je zeker dat je deze oefensessie wilt stoppen? Je voortgang wordt niet opgeslagen.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="px-6 py-4 border-t border-hh-border bg-slate-50 flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-10 text-[14px]"
          >
            Annuleren
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="flex-1 h-10 text-[14px]"
            style={{ backgroundColor: '#1E2A3B' }}
          >
            Stoppen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
