import { ChevronRight } from "lucide-react";

interface ListItemProps {
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
}

export function ListItem({
  title,
  subtitle,
  meta,
  trailing,
  onClick,
  showChevron = false,
}: ListItemProps) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-[12px] border border-hh-border bg-hh-bg hover:bg-hh-ui-50 transition-colors ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-[16px] leading-[24px] font-medium text-hh-text">
            {title}
          </p>
          {meta && (
            <span className="text-[12px] leading-[16px] text-hh-muted">
              {meta}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[14px] leading-[20px] text-hh-muted">{subtitle}</p>
        )}
      </div>
      {trailing && <div className="ml-4">{trailing}</div>}
      {showChevron && <ChevronRight className="w-5 h-5 text-hh-muted ml-2" />}
    </div>
  );
}
