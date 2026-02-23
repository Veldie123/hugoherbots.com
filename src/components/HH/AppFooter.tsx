import { Link2, HelpCircle, Shield, FileText } from "lucide-react";
import { Separator } from "../ui/separator";

interface AppFooterProps {
  navigate?: (page: string) => void;
}

export function AppFooter({ navigate }: AppFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto pt-12 pb-6 px-4 sm:px-6 lg:px-8">
      <Separator className="mb-6" />
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[14px] leading-[20px] text-hh-muted">
          {/* Left: Copyright */}
          <div className="flex items-center gap-2">
            <span>© {currentYear} Hugo Herbots.ai</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-[12px] leading-[16px] text-hh-ui-300">v1.0.2</span>
          </div>

          {/* Right: Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate?.("settings")}
              className="flex items-center gap-1.5 hover:text-hh-primary transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Help & Support</span>
            </button>
            
            <a
              href="https://hugoherbots.ai/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-hh-primary transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Privacy</span>
            </a>
            
            <a
              href="https://hugoherbots.ai/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-hh-primary transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms</span>
            </a>
          </div>
        </div>

        {/* Subtle end indicator */}
        <div className="mt-6 flex items-center justify-center">
          <div className="h-1 w-12 bg-hh-ui-200 rounded-full" />
        </div>
      </div>
    </footer>
  );
}
