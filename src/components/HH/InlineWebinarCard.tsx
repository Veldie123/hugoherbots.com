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
      className="rounded-xl border border-hh-border bg-card hover:bg-hh-ui-50 transition-colors p-3 flex items-center gap-3 text-left w-full group no-underline"
      style={{ maxWidth: 480 }}
    >
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ width: 48, height: 48, backgroundColor: webinar.isLive ? "var(--hh-warning-100)" : "var(--hh-primary-100)" }}
      >
        <Radio
          className="w-5 h-5"
          style={{ color: webinar.isLive ? "var(--hh-warning)" : "var(--hh-primary)" }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-hh-text truncate">{webinar.title}</p>
        {webinar.description && (
          <p className="text-xs text-hh-muted mt-0.5 line-clamp-2">{webinar.description}</p>
        )}
        {webinar.date && (
          <p className="text-xs text-hh-muted mt-0.5">{webinar.date}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {webinar.isLive && (
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-hh-warning/15 text-hh-warning">
            LIVE
          </span>
        )}
        <ExternalLink className="w-4 h-4 text-hh-muted group-hover:text-hh-text" />
      </div>
    </a>
  );
}
