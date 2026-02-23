// Live Coaching Widget voor Dashboard
// Toont 3 opkomende sessies met calendar export functionaliteit

import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Radio, Calendar, Bell } from "lucide-react";

interface DashboardLiveCoachingWidgetProps {
  navigate?: (page: string) => void;
}

export function DashboardLiveCoachingWidget({ navigate }: DashboardLiveCoachingWidgetProps) {
  // Mock data - vervang dit met echte data van je API
  const upcomingSessions = [
    {
      id: "1",
      title: "Live Q&A: Discovery Technieken",
      date: "Woensdag 22 jan",
      time: "14:00 - 15:00",
      duration: 60,
      topic: "Fase 2 • Ontdekkingsfase",
      scheduledDate: new Date("2025-01-22T14:00:00"),
    },
    {
      id: "2",
      title: "Live Coaching: Closing Mastery",
      date: "Woensdag 29 jan",
      time: "14:00 - 15:00",
      duration: 60,
      topic: "Fase 4 • Afsluittechnieken",
      scheduledDate: new Date("2025-01-29T14:00:00"),
    },
    {
      id: "3",
      title: "Live Coaching: Value Selling",
      date: "Woensdag 5 feb",
      time: "14:00 - 15:00",
      duration: 60,
      topic: "Fase 3 • Aanbevelingsfase",
      scheduledDate: new Date("2025-02-05T14:00:00"),
    },
  ];

  const handleAddToCalendar = (session: typeof upcomingSessions[0]) => {
    const event = {
      title: session.title,
      start: session.scheduledDate,
      end: new Date(session.scheduledDate.getTime() + session.duration * 60000),
      description: `Live coaching sessie met Hugo Herbots - ${session.topic}`,
      location: "HugoHerbots.ai Live Coaching",
    };

    // Create ICS file content
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//HugoHerbots.ai//Live Coaching//NL",
      "BEGIN:VEVENT",
      `DTSTART:${event.start.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTEND:${event.end.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description}`,
      `LOCATION:${event.location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    // Download ICS file
    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `live-coaching-${session.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[20px] leading-[28px] text-hh-text">
            Opkomende Live Coaching
          </h3>
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1.5 px-2 py-0.5">
            <Radio className="w-3 h-3" />
            <span>Elke woensdag</span>
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate?.("live")}>
          Bekijk alles
        </Button>
      </div>

      {/* Sessions Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {upcomingSessions.map((session, index) => (
          <Card
            key={session.id}
            className="p-4 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-all relative overflow-hidden"
          >
            {/* Highlight border for next session (eerste sessie) */}
            {index === 0 && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hh-primary to-hh-accent" />
            )}

            {/* Header: Topic badge + Calendar button */}
            <div className="flex items-start justify-between mb-3">
              <Badge variant="outline" className="text-[12px]">
                {session.topic}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mt-1 -mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCalendar(session);
                }}
              >
                <Calendar className="w-4 h-4" />
              </Button>
            </div>

            {/* Title */}
            <h4 className="text-[16px] leading-[24px] text-hh-text mb-2">
              {session.title}
            </h4>

            {/* Date & Time */}
            <div className="space-y-1.5 text-[14px] leading-[20px] text-hh-muted mb-4">
              <p className="flex items-center gap-2">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                {session.date}
              </p>
              <p className="flex items-center gap-2">
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  ⏰
                </span>
                {session.time} ({session.duration} min)
              </p>
            </div>

            {/* CTA Button */}
            <Button
              size="sm"
              variant={index === 0 ? "default" : "outline"}
              className="w-full gap-2"
              onClick={() => navigate?.("live")}
            >
              <Bell className="w-4 h-4" />
              Herinner me
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
