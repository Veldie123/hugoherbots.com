import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Card } from "../ui/card";

type DeltaType = "up" | "down" | "neutral";

interface KPITileProps {
  metric: string;
  value: string | number;
  delta?: {
    value: string;
    type: DeltaType;
  };
  label?: string;
}

export function KPITile({ metric, value, delta, label }: KPITileProps) {
  const deltaColors = {
    up: "text-hh-success",
    down: "text-destructive",
    neutral: "text-hh-muted",
  };

  const DeltaIcon = {
    up: ArrowUp,
    down: ArrowDown,
    neutral: Minus,
  };

  const Icon = delta ? DeltaIcon[delta.type] : null;

  return (
    <Card className="p-4 rounded-[16px] shadow-hh-md border-hh-border">
      <div className="flex flex-col gap-2">
        <p className="text-hh-muted text-[14px] leading-[20px]">{metric}</p>
        <div className="flex items-end justify-between">
          <p className="text-[32px] leading-[40px] font-bold text-hh-text">
            {value}
          </p>
          {delta && (
            <div className={`flex items-center gap-1 ${deltaColors[delta.type]}`}>
              {Icon && (
                <Icon className="w-4 h-4" />
              )}
              <span className="text-[14px] leading-[20px] font-medium">
                {delta.value}
              </span>
            </div>
          )}
        </div>
        {label && (
          <p className="text-[12px] leading-[16px] text-hh-muted mt-1">
            {label}
          </p>
        )}
      </div>
    </Card>
  );
}
