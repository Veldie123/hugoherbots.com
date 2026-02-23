import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ArrowRight, Sparkles, Clock, CreditCard, X } from "lucide-react";

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
  onSignup: () => void;
  variant?: "first" | "reminder";
}

export function SignupModal({ open, onClose, onSignup, variant = "first" }: SignupModalProps) {
  console.log("SignupModal render - open:", open, "variant:", variant);
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[85vh] overflow-y-auto z-[9999]" aria-describedby={undefined}>
        <DialogHeader className="sr-only">
          <DialogTitle>
            {variant === "first" 
              ? "Klaar om echt te oefenen met Hugo?"
              : "Nog steeds aan het verkennen?"
            }
          </DialogTitle>
          <DialogDescription>
            {variant === "first"
              ? "Je bekijkt nu de preview. Maak gratis een account om je voortgang op te slaan en te beginnen trainen."
              : "Start vandaag nog gratis en krijg 14 dagen toegang tot alle features — zonder creditcard."
            }
          </DialogDescription>
        </DialogHeader>

        {/* Header met gradient */}
        <div className="bg-gradient-to-br from-hh-primary/10 to-hh-success/10 p-8 pb-6 relative">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-hh-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-hh-primary" />
            </div>
            <div>
              <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 mb-2">
                Preview mode actief
              </Badge>
              <h2 className="text-[24px] leading-[32px] text-hh-text mb-2">
                {variant === "first" 
                  ? "Klaar om echt te oefenen met Hugo?"
                  : "Nog steeds aan het verkennen?"
                }
              </h2>
              <p className="text-[16px] leading-[24px] text-hh-muted">
                {variant === "first"
                  ? "Je bekijkt nu de preview. Maak gratis een account om je voortgang op te slaan en te beginnen trainen."
                  : "Start vandaag nog gratis en krijg 14 dagen toegang tot alle features — zonder creditcard."
                }
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 space-y-6">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-hh-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="w-3 h-3 text-hh-success" />
              </div>
              <div>
                <p className="text-[16px] leading-[24px] text-hh-text">
                  <strong>14 dagen gratis</strong> — volledige toegang
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-hh-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CreditCard className="w-3 h-3 text-hh-success" />
              </div>
              <div>
                <p className="text-[16px] leading-[24px] text-hh-text">
                  <strong>Geen creditcard vereist</strong> — direct starten
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-hh-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-hh-success" />
              </div>
              <div>
                <p className="text-[16px] leading-[24px] text-hh-text">
                  <strong>Alle features unlocked</strong> — inclusief custom scenarios
                </p>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-3 pt-2">
            <Button 
              size="lg" 
              variant="ink" 
              className="w-full gap-2 h-12"
              onClick={onSignup}
            >
              Start gratis met Hugo <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              size="lg" 
              variant="ghost" 
              className="w-full"
              onClick={onClose}
            >
              Verken de preview verder
            </Button>
          </div>

          {/* Trust */}
          <p className="text-[14px] leading-[20px] text-hh-muted text-center">
            Al 20.000+ sales professionals getraind door Hugo
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}