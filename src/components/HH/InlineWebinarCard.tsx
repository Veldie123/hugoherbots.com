import { ExternalLink, Radio } from "lucide-react";
import type { WebinarLink } from "@/types/crossPlatform";

interface InlineWebinarCardProps {
  webinar: WebinarLink;
}

export function InlineWebinarCard({ webinar }: InlineWebinarCardProps) {
  return (
    <a
      href={webinar.url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors p-3 flex items-center gap-3 text-left w-full group no-underline"
      style={{ maxWidth: 480 }}
    >
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ width: 48, height: 48, backgroundColor: webinar.isLive ? "#FEF3C7" : "#EDE9FE" }}
      >
        <Radio
          className="w-5 h-5"
          style={{ color: webinar.isLive ? "#D97706" : "#7C3AED" }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-slate-800 truncate">{webinar.title}</p>
        {webinar.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{webinar.description}</p>
        )}
        {webinar.date && (
          <p className="text-xs text-slate-400 mt-0.5">{webinar.date}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {webinar.isLive && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            LIVE
          </span>
        )}
        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
      </div>
    </a>
  );
}
