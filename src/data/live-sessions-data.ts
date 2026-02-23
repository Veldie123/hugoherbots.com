export interface LiveSession {
  id: number;
  techniqueNumber: string;
  title: string;
  fase: string;
  date: string;
  time: string;
  duration: string;
  status: string;
  attendees: number;
  maxAttendees: number | null;
  platform: string;
  recording?: boolean;
  description?: string;
}

export const liveSessions: LiveSession[] = [
  {
    id: 1,
    techniqueNumber: "2.1.2",
    title: "Meningsgerichte vragen (open vragen)",
    fase: "Ontdekkingsfase",
    date: "2026-01-22",
    time: "14:00",
    duration: "60 min",
    status: "scheduled",
    attendees: 0,
    maxAttendees: null,
    platform: "Zoom",
  },
  {
    id: 2,
    techniqueNumber: "2.1.1",
    title: "Feitgerichte vragen",
    fase: "Ontdekkingsfase",
    date: "2026-01-26",
    time: "10:00",
    duration: "90 min",
    status: "scheduled",
    attendees: 0,
    maxAttendees: 50,
    platform: "Zoom",
  },
  {
    id: 3,
    techniqueNumber: "4.2.4",
    title: "Bezwaren behandelen",
    fase: "Beslissingsfase",
    date: "2026-01-15",
    time: "16:00",
    duration: "120 min",
    status: "completed",
    attendees: 42,
    maxAttendees: 50,
    platform: "Microsoft Teams",
  },
  {
    id: 4,
    techniqueNumber: "1.1",
    title: "Koopklimaat creëren",
    fase: "Openingsfase",
    date: "2026-01-08",
    time: "11:00",
    duration: "45 min",
    status: "completed",
    attendees: 28,
    maxAttendees: 30,
    platform: "Google Meet",
  },
  {
    id: 5,
    techniqueNumber: "4.1",
    title: "Proefafsluiting",
    fase: "Beslissingsfase",
    date: "2026-01-29",
    time: "13:00",
    duration: "90 min",
    status: "scheduled",
    attendees: 0,
    maxAttendees: 40,
    platform: "Zoom",
  },
];
