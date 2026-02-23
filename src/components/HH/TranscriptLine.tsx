import { User, Bot } from "lucide-react";

interface TranscriptLineProps {
  speaker: "Coach" | "You";
  time: string;
  text: string;
}

export function TranscriptLine({ speaker, time, text }: TranscriptLineProps) {
  const isCoach = speaker === "Coach";

  return (
    <div className={`flex gap-3 p-3 rounded-[12px] ${isCoach ? "bg-hh-ui-50" : "bg-transparent"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isCoach ? "bg-hh-primary" : "bg-hh-ui-200"
      }`}>
        {isCoach ? (
          <Bot className="w-4 h-4 text-white" />
        ) : (
          <User className="w-4 h-4 text-hh-text" />
        )}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] leading-[20px] font-medium text-hh-text">
            {speaker}
          </span>
          <span className="text-[12px] leading-[16px] text-hh-muted">
            {time}
          </span>
        </div>
        <p className="text-[16px] leading-[24px] text-hh-text">{text}</p>
      </div>
    </div>
  );
}
