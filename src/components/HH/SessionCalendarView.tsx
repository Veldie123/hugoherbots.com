import { useState } from "react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Edit,
  Bell,
  BellOff,
  Download,
  Radio,
  CheckCircle,
  Play,
} from "lucide-react";
import type { LiveSession } from "@/types/liveCoaching";
import { downloadIcsFile } from "@/services/liveCoachingApi";

interface SessionCalendarViewProps {
  sessions: LiveSession[];
  isAdmin?: boolean;
  onEditSession?: (session: LiveSession) => void;
  onToggleReminder?: (sessionId: string) => void;
  onSessionClick?: (session: LiveSession) => void;
  reminderSessionIds?: Set<string>;
}

const DAY_NAMES_SHORT = ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"];
const DAY_NAMES_FULL = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(monday: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function getStatusColor(status: string): { bg: string; text: string; border: string; label: string } {
  switch (status?.toLowerCase()) {
    case "live":
      return { bg: "bg-red-50", text: "text-red-700", border: "border-l-red-500", label: "Live" };
    case "ended":
    case "completed":
      return { bg: "bg-slate-50", text: "text-slate-600", border: "border-l-slate-400", label: "Voltooid" };
    default:
      return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-l-emerald-500", label: "Gepland" };
  }
}

function getStatusBadge(status: string) {
  const { bg, text, label } = getStatusColor(status);
  return (
    <Badge className={`${bg} ${text} border-0 text-[11px] font-medium px-2 py-0.5`}>
      {status?.toLowerCase() === "live" && <Radio className="w-3 h-3 mr-1 animate-pulse" />}
      {status?.toLowerCase() === "ended" && <CheckCircle className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}

export function SessionCalendarView({
  sessions,
  isAdmin = false,
  onEditSession,
  onToggleReminder,
  onSessionClick,
  reminderSessionIds = new Set(),
}: SessionCalendarViewProps) {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const weekDays = getWeekDays(currentMonday);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekEnd = new Date(currentMonday);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekSessions = sessions
    .filter((s) => {
      const d = new Date(s.scheduledDate || "");
      return d >= currentMonday && d <= weekEnd;
    })
    .sort((a, b) => new Date(a.scheduledDate || "").getTime() - new Date(b.scheduledDate || "").getTime());

  const sessionsByDay: Record<string, LiveSession[]> = {};
  weekSessions.forEach((s) => {
    const key = new Date(s.scheduledDate || "").toDateString();
    if (!sessionsByDay[key]) sessionsByDay[key] = [];
    sessionsByDay[key].push(s);
  });

  const sessionDatesSet = new Set(
    sessions.map((s) => new Date(s.scheduledDate || "").toDateString())
  );

  const goToPrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(prev.getDate() - 7);
    setCurrentMonday(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(next.getDate() + 7);
    setCurrentMonday(next);
  };

  const goToToday = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  const monthLabel = (() => {
    const firstMonth = currentMonday.toLocaleDateString("nl-NL", { month: "long" });
    const lastDay = weekDays[6];
    const lastMonth = lastDay.toLocaleDateString("nl-NL", { month: "long" });
    const year = currentMonday.getFullYear();
    if (firstMonth === lastMonth) {
      return `${firstMonth.charAt(0).toUpperCase() + firstMonth.slice(1)} ${year}`;
    }
    return `${firstMonth.charAt(0).toUpperCase() + firstMonth.slice(1)} - ${lastMonth} ${year}`;
  })();

  const isCurrentWeek = getMonday(new Date()).toDateString() === currentMonday.toDateString();

  return (
    <div className="space-y-4">
      <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-hh-border bg-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-[15px] sm:text-[16px] font-semibold text-hh-text min-w-[140px] sm:min-w-[180px] text-center">
              {monthLabel}
            </h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {!isCurrentWeek && (
            <Button variant="outline" size="sm" className="text-[12px] h-7 px-3" onClick={goToToday}>
              Vandaag
            </Button>
          )}
        </div>

        <div className="grid border-b border-hh-border bg-slate-50/50" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weekDays.map((day, idx) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const hasSessions = sessionDatesSet.has(day.toDateString());
            return (
              <button
                key={idx}
                className={`flex flex-col items-center py-2.5 sm:py-3 transition-colors hover:bg-slate-100 relative ${
                  isToday ? "bg-hh-primary/5" : ""
                }`}
                onClick={() => {
                  const targetMonday = getMonday(day);
                  if (targetMonday.toDateString() !== currentMonday.toDateString()) {
                    setCurrentMonday(targetMonday);
                  }
                }}
              >
                <span className={`text-[11px] sm:text-[12px] font-medium tracking-wide ${
                  isToday ? "text-hh-primary" : "text-hh-muted"
                }`}>
                  {DAY_NAMES_SHORT[idx]}
                </span>
                <span className={`text-[14px] sm:text-[16px] font-semibold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${
                  isToday
                    ? "bg-hh-primary text-white"
                    : "text-hh-text"
                }`}>
                  {day.getDate()}
                </span>
                {hasSessions && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 ${
                    isToday ? "bg-white" : "bg-hh-primary"
                  }`} />
                )}
                {!hasSessions && <div className="w-1.5 h-1.5 mt-1" />}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5">
          {weekSessions.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <CalendarIcon className="w-10 h-10 text-hh-muted/40 mx-auto mb-3" />
              <p className="text-[14px] text-hh-muted">Geen sessies deze week</p>
              <p className="text-[12px] text-hh-muted/70 mt-1">Navigeer naar een andere week om sessies te bekijken</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {weekDays.map((day, idx) => {
                const dayKey = day.toDateString();
                const daySessions = sessionsByDay[dayKey];
                if (!daySessions || daySessions.length === 0) return null;

                const isToday = day.toDateString() === new Date().toDateString();

                return (
                  <div key={dayKey}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className={`text-[13px] font-bold uppercase tracking-wider ${
                        isToday ? "text-hh-primary" : "text-hh-muted"
                      }`}>
                        {DAY_NAMES_SHORT[idx]}
                      </span>
                      <span className={`text-[13px] font-semibold ${
                        isToday ? "text-hh-primary" : "text-hh-text"
                      }`}>
                        {day.getDate()}
                      </span>
                      {isToday && (
                        <Badge className="bg-hh-primary/10 text-hh-primary border-0 text-[10px] px-1.5 py-0">
                          Vandaag
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {daySessions.map((session) => {
                        const statusInfo = getStatusColor(session.status || "upcoming");
                        const isExpanded = expandedSessionId === session.id;
                        const hasReminder = reminderSessionIds.has(session.id);
                        const sessionTime = new Date(session.scheduledDate || "").toLocaleTimeString("nl-NL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div
                            key={session.id}
                            className={`rounded-xl border border-hh-border border-l-[3px] ${statusInfo.border} bg-white hover:shadow-sm transition-all overflow-hidden`}
                          >
                            <div
                              className="flex items-center gap-3 p-3 sm:p-3.5 cursor-pointer"
                              onClick={() => {
                                if (onSessionClick) {
                                  onSessionClick(session);
                                } else {
                                  setExpandedSessionId(isExpanded ? null : session.id);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 text-[13px] text-hh-muted font-medium min-w-[52px]">
                                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                {sessionTime}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className="text-[14px] sm:text-[15px] font-medium text-hh-text truncate">
                                  {session.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {getStatusBadge(session.status || "upcoming")}
                                <span className="text-[12px] text-hh-muted hidden sm:inline">
                                  {session.durationMinutes || 60} min
                                </span>
                                {isAdmin && onEditSession && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[12px] hidden sm:flex"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditSession(session);
                                    }}
                                  >
                                    <Edit className="w-3.5 h-3.5 mr-1" />
                                    Edit
                                  </Button>
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-3 sm:px-3.5 pb-3 sm:pb-3.5 pt-0 border-t border-hh-border/50">
                                <div className="pt-3 space-y-3">
                                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-hh-muted">
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5" />
                                      {sessionTime} · {session.durationMinutes || 60} min
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                      <CalendarIcon className="w-3.5 h-3.5" />
                                      {new Date(session.scheduledDate || "").toLocaleDateString("nl-NL", {
                                        weekday: "long",
                                        day: "numeric",
                                        month: "long",
                                      })}
                                    </span>
                                  </div>

                                  {session.description && (
                                    <p className="text-[13px] text-hh-muted leading-relaxed">
                                      {session.description}
                                    </p>
                                  )}

                                  <div className="flex flex-wrap gap-2 pt-1">
                                    {session.status === "live" && (
                                      <Button
                                        size="sm"
                                        className="h-8 text-[12px] text-white gap-1.5"
                                        style={{ backgroundColor: "#dc2626" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSessionClick?.(session);
                                        }}
                                      >
                                        <Play className="w-3.5 h-3.5" />
                                        Deelnemen
                                      </Button>
                                    )}
                                    {session.status === "ended" && session.recordingUrl && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-[12px] gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSessionClick?.(session);
                                        }}
                                      >
                                        <Play className="w-3.5 h-3.5" />
                                        Opname bekijken
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-[12px] gap-1.5"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadIcsFile(session);
                                      }}
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      Agenda
                                    </Button>
                                    {onToggleReminder && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={`h-8 text-[12px] gap-1.5 ${
                                          hasReminder ? "border-amber-300 text-amber-600 bg-amber-50" : ""
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onToggleReminder(session.id);
                                        }}
                                      >
                                        {hasReminder ? (
                                          <BellOff className="w-3.5 h-3.5" />
                                        ) : (
                                          <Bell className="w-3.5 h-3.5" />
                                        )}
                                        {hasReminder ? "Uit" : "Herinner mij"}
                                      </Button>
                                    )}
                                    {isAdmin && onEditSession && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-[12px] gap-1.5 sm:hidden"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onEditSession(session);
                                        }}
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                        Bewerken
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
