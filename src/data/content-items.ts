import { Video, Target, Radio, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ContentItem {
  id: number;
  type: "video" | "scenario" | "live" | "document";
  techniqueNumber?: string;
  title: string;
  fase: string;
  status: string;
  views: number;
  engagement: number;
  uploadDate: string;
  icon: LucideIcon;
}

export const allContent: ContentItem[] = [
  {
    id: 1,
    type: "video",
    techniqueNumber: "2.1.5",
    title: "Pingpong techniek",
    fase: "Ontdekkingsfase",
    status: "Gepubliceerd",
    views: 847,
    engagement: 92,
    uploadDate: "12 jan 2025",
    icon: Video,
  },
  {
    id: 2,
    type: "scenario",
    techniqueNumber: "2.1",
    title: "Explore - Volledige discovery",
    fase: "Ontdekkingsfase",
    status: "Gepubliceerd",
    views: 423,
    engagement: 88,
    uploadDate: "10 jan 2025",
    icon: Target,
  },
  {
    id: 3,
    type: "live",
    techniqueNumber: "4.2.4",
    title: "Bezwaren behandelen",
    fase: "Beslissingsfase",
    status: "Afgelopen",
    views: 234,
    engagement: 78,
    uploadDate: "8 jan 2025",
    icon: Radio,
  },
  {
    id: 4,
    type: "video",
    title: "E.P.I.C Framework Deep Dive",
    fase: "Ontdekkingsfase",
    status: "Gepubliceerd",
    views: 389,
    engagement: 85,
    uploadDate: "7 jan 2025",
    icon: Video,
  },
  {
    id: 5,
    type: "document",
    techniqueNumber: "2.1.1",
    title: "Feitgerichte vragen - Template",
    fase: "Ontdekkingsfase",
    status: "Gepubliceerd",
    views: 512,
    engagement: 94,
    uploadDate: "5 jan 2025",
    icon: FileText,
  },
  {
    id: 6,
    type: "scenario",
    title: "Cold Calling Roleplay",
    fase: "Openingsfase",
    status: "Gepubliceerd",
    views: 198,
    engagement: 82,
    uploadDate: "3 jan 2025",
    icon: Target,
  },
];
