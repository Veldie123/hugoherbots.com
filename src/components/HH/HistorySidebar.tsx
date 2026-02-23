import { useState } from "react";
import { MessageSquare, FileAudio, ChevronRight, BarChart3, Clock, TrendingUp, Mic, X } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface HistoryItem {
  id: string;
  techniqueNumber: string;
  title: string;
  score?: number;
  date: string;
  type?: "audio" | "video" | "chat";
  duration?: string;
}

interface HistorySidebarProps {
  type: "chat" | "analysis";
  items: HistoryItem[];
  onSelectItem: (id: string) => void;
  onOpenFullView: () => void;
}

export function HistorySidebar({ type, items, onSelectItem, onOpenFullView }: HistorySidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score?: number) => {
    if (!score) return "text-hh-muted";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-orange-500";
    return "text-red-500";
  };

  const recentItems = items.slice(0, 5);
  
  const totalItems = items.length;
  const avgScore = items.length > 0 
    ? Math.round(items.reduce((acc, item) => acc + (item.score || 0), 0) / items.length)
    : 0;
  const completedItems = items.filter(i => i.score && i.score > 0).length;

  return (
    <>
      <div className="hidden lg:flex flex-col items-center py-4 gap-2 w-14 border-r border-hh-border bg-white flex-shrink-0">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-10 h-10 rounded-lg bg-hh-ui-50 hover:bg-hh-primary/10 flex items-center justify-center transition-colors"
          title={type === "chat" ? "Recente sessies" : "Recente analyses"}
        >
          {type === "chat" ? (
            <MessageSquare className="w-5 h-5 text-hh-primary" />
          ) : (
            <FileAudio className="w-5 h-5 text-hh-primary" />
          )}
        </button>
        
        {recentItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectItem(item.id)}
            className="w-10 h-10 rounded-lg bg-hh-ui-50 hover:bg-hh-primary/10 flex items-center justify-center text-xs font-medium text-hh-ink transition-colors"
            title={item.title}
          >
            {item.techniqueNumber}
          </button>
        ))}
        
        <button
          onClick={onOpenFullView}
          className="w-10 h-10 rounded-lg hover:bg-hh-ui-100 flex items-center justify-center text-hh-muted mt-auto"
          title="Bekijk volledige historiek"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {isExpanded && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40 lg:block hidden"
            onClick={() => setIsExpanded(false)}
          />
          
          <div className="fixed left-16 top-16 bottom-0 w-[380px] bg-white shadow-xl z-50 hidden lg:flex flex-col border-r border-hh-border animate-in slide-in-from-left-2 duration-200">
            <div className="p-4 border-b border-hh-border bg-gradient-to-r from-hh-bg to-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-hh-ink">
                  {type === "chat" ? "Gesprekshistoriek" : "Gespreksanalyse"}
                </h3>
                <p className="text-sm text-hh-muted">
                  {type === "chat" ? "Recente chat sessies" : "Upload gesprekken voor AI-analyse"}
                </p>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="w-8 h-8 rounded-lg hover:bg-hh-ui-100 flex items-center justify-center text-hh-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 p-4 border-b border-hh-border bg-hh-bg/30">
              <Card className="p-3 bg-white border-hh-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-hh-primary/10 flex items-center justify-center">
                    <FileAudio className="w-4 h-4 text-hh-primary" />
                  </div>
                  <span className="text-xs text-hh-muted">Totaal</span>
                </div>
                <p className="text-xl font-semibold text-hh-ink">{totalItems}</p>
              </Card>
              
              <Card className="p-3 bg-white border-hh-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-xs text-hh-muted">Voltooid</span>
                </div>
                <p className="text-xl font-semibold text-hh-ink">{completedItems}</p>
              </Card>
              
              <Card className="p-3 bg-white border-hh-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-xs text-hh-muted">Deze week</span>
                </div>
                <p className="text-xl font-semibold text-orange-500">+{Math.min(totalItems, 3)}</p>
              </Card>
              
              <Card className="p-3 bg-white border-hh-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs text-hh-muted">Gem. Score</span>
                </div>
                <p className="text-xl font-semibold text-hh-ink">{avgScore}%</p>
              </Card>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-hh-border/50 bg-hh-ui-50/50">
                <span className="text-xs font-medium text-hh-muted uppercase tracking-wide">Recente items</span>
              </div>
              {recentItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectItem(item.id);
                    setIsExpanded(false);
                  }}
                  className="w-full p-3 text-left hover:bg-hh-ui-50 border-b border-hh-border/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center min-w-[42px] h-8 px-2 rounded-md bg-hh-primary/10 text-hh-primary text-sm font-semibold">
                      {item.techniqueNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-hh-ink truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-hh-muted">{item.date}</span>
                        {item.type && (
                          <span className="inline-flex items-center gap-1 text-xs text-hh-muted">
                            <Mic className="w-3 h-3" />
                            {item.type === "audio" ? "Audio" : item.type === "video" ? "Video" : "Chat"}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.score !== undefined && (
                      <span className={`text-sm font-semibold ${getScoreColor(item.score)}`}>
                        {item.score}%
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-hh-border bg-white">
              <Button 
                onClick={() => {
                  onOpenFullView();
                  setIsExpanded(false);
                }}
                className="w-full bg-hh-ink hover:bg-hh-ink/90 text-white"
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                Bekijk volledige historiek
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
