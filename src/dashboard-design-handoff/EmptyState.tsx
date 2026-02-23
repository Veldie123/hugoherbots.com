import { LucideIcon } from "lucide-react";
import { Button } from "../ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  primaryCta?: {
    label: string;
    onClick: () => void;
  };
  secondaryCta?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  primaryCta,
  secondaryCta,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-hh-ui-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-hh-muted" />
      </div>
      <h3 className="text-[24px] leading-[32px] font-semibold text-hh-text mb-2">
        {title}
      </h3>
      <p className="text-[16px] leading-[24px] text-hh-muted mb-6">{body}</p>
      {(primaryCta || secondaryCta) && (
        <div className="flex gap-3">
          {primaryCta && (
            <Button onClick={primaryCta.onClick}>{primaryCta.label}</Button>
          )}
          {secondaryCta && (
            <Button variant="outline" onClick={secondaryCta.onClick}>
              {secondaryCta.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
