import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

interface HintPanelProps {
  technique: string;
  doItems: string[];
  dontItems: string[];
  examples?: string[];
}

export function HintPanel({
  technique,
  doItems,
  dontItems,
  examples,
}: HintPanelProps) {
  return (
    <Card className="p-4 rounded-[16px] shadow-hh-md border-hh-border sticky top-4">
      <div className="space-y-4">
        <div>
          <Badge variant="outline" className="bg-hh-primary/10 text-hh-primary border-hh-primary/20">
            {technique}
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-hh-success" />
              <span className="text-[14px] leading-[20px] font-medium text-hh-text">
                Do
              </span>
            </div>
            <ul className="space-y-1.5 ml-6">
              {doItems.map((item, idx) => (
                <li
                  key={idx}
                  className="text-[14px] leading-[20px] text-hh-text"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="text-[14px] leading-[20px] font-medium text-hh-text">
                Don't
              </span>
            </div>
            <ul className="space-y-1.5 ml-6">
              {dontItems.map((item, idx) => (
                <li
                  key={idx}
                  className="text-[14px] leading-[20px] text-hh-text"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {examples && examples.length > 0 && (
            <div>
              <span className="text-[14px] leading-[20px] font-medium text-hh-text mb-2 block">
                Examples
              </span>
              <div className="space-y-2">
                {examples.map((example, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-hh-ui-50 text-[14px] leading-[20px] text-hh-text italic"
                  >
                    "{example}"
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
