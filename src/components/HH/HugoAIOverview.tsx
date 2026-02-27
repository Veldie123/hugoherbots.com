import { useState, useEffect, useMemo } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Search,
  List,
  LayoutGrid,
  Mic,
  Video,
  MessageSquare,
  Clock,
  TrendingUp,
  MoreVertical,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Trash2,
  BarChart3,
} from "lucide-react";
import { getFaseNaam } from "../../data/technieken-service";
import { hideItem, getHiddenIds } from "../../utils/hiddenItems";
import { getCodeBadgeColors } from "../../utils/phaseColors";

interface HugoAIOverviewProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

type SessionType = "ai-audio" | "ai-video" | "ai-chat" | "upload-audio";

interface Session {
  id: string;
  nummer: string;
  naam: string;
  fase: string;
  type: SessionType;
  score: number;
  quality: "excellent" | "good" | "needs-improvement";
  duration: string;
  date: string;
  time?: string;
  transcript: Array<{ speaker: string; time: string; text: string }>;
}


const getTypeIcon = (type: SessionType) => {
  switch (type) {
    case "ai-audio":
      return <Mic className="w-4 h-4 text-[#4F7396]" />;
    case "ai-video":
      return <Video className="w-4 h-4 text-[#4F7396]" />;
    case "ai-chat":
      return <MessageSquare className="w-4 h-4 text-[#4F7396]" />;
    case "upload-audio":
      return <Upload className="w-4 h-4 text-[#4F7396]" />;
  }
};

const getTypeLabel = (type: SessionType) => {
  switch (type) {
    case "ai-audio":
      return "AI Audio";
    case "ai-video":
      return "AI Video";
    case "ai-chat":
      return "AI Chat";
    case "upload-audio":
      return "Rollenspel Upload (Audio)";
  }
};

const getQualityBadge = (quality: "excellent" | "good" | "needs-improvement") => {
  switch (quality) {
    case "excellent":
      return (
        <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 hover:bg-hh-success/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Excellent
        </Badge>
      );
    case "good":
      return (
        <Badge className="bg-hh-ink/10 text-hh-ink border-hh-ink/20 hover:bg-hh-ink/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Good
        </Badge>
      );
    case "needs-improvement":
      return (
        <Badge className="bg-hh-warning/10 text-hh-warning border-hh-warning/20 hover:bg-hh-warning/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Needs Improvement
        </Badge>
      );
  }
};

export function HugoAIOverview({ navigate, isAdmin }: HugoAIOverviewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterQuality, setFilterQuality] = useState<string>("all");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => getHiddenIds('user', 'chat'));

  const handleDeleteSession = (id: string) => {
    hideItem('user', 'chat', id);
    setHiddenIds(new Set(getHiddenIds('user', 'chat')));
  };

  const [analyzingSessionIds, setAnalyzingSessionIds] = useState<Set<string>>(new Set());

  const safeJsonParse = async (response: Response): Promise<any> => {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(text.startsWith('<!') ? 'Server niet bereikbaar, probeer opnieuw' : text.slice(0, 200));
    }
    return response.json();
  };

  const handleAnalyzeSession = async (session: Session) => {
    const sessionId = String(session.id);

    if (/^\d+$/.test(sessionId)) {
      alert('Dit is een demo-sessie en kan niet worden geanalyseerd.');
      return;
    }

    setAnalyzingSessionIds(prev => new Set(prev).add(sessionId));

    try {
      const response = await fetch('/api/v2/analysis/chat-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await safeJsonParse(response);

      if (data.status === 'completed') {
        setAnalyzingSessionIds(prev => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
        sessionStorage.setItem('analysisId', sessionId);
        sessionStorage.setItem('analysisFromHugo', 'true');
        if (navigate) navigate('analysis-results');
        return;
      }

      if (data.error) {
        setAnalyzingSessionIds(prev => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
        alert(`Analyse niet mogelijk: ${data.error}`);
        return;
      }

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/v2/analysis/status/${sessionId}`);
          const statusData = await safeJsonParse(statusRes);

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            setAnalyzingSessionIds(prev => {
              const next = new Set(prev);
              next.delete(sessionId);
              return next;
            });
            sessionStorage.setItem('analysisId', sessionId);
            sessionStorage.setItem('analysisFromHugo', 'true');
            if (navigate) navigate('analysis-results');
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setAnalyzingSessionIds(prev => {
              const next = new Set(prev);
              next.delete(sessionId);
              return next;
            });
            alert(`Analyse mislukt: ${statusData.error || 'Onbekende fout'}`);
          }
        } catch {
          clearInterval(pollInterval);
          setAnalyzingSessionIds(prev => {
            const next = new Set(prev);
            next.delete(sessionId);
            return next;
          });
        }
      }, 3000);
    } catch (err: any) {
      setAnalyzingSessionIds(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
      alert(`Fout bij starten analyse: ${err.message}`);
    }
  };
  
  const demoSessions: Session[] = useMemo(() => {
    const demoTranscript = [
      { speaker: "AI Coach", time: "00:00", text: "Goedemiddag! Vandaag gaan we oefenen met verkooptechnieken. Ben je er klaar voor?" },
      { speaker: "Verkoper", time: "00:05", text: "Ja, ik ben er klaar voor. Ik wil graag beter worden in het stellen van de juiste vragen." },
      { speaker: "AI Coach", time: "00:12", text: "Perfect! Stel je voor: je belt een prospect die interesse heeft getoond in jullie software. Begin maar met je opening." },
      { speaker: "Verkoper", time: "00:25", text: "Goedemiddag, u spreekt met Jan. Ik bel naar aanleiding van uw interesse in onze oplossing. Heeft u even tijd?" },
      { speaker: "AI Coach", time: "00:35", text: "Goede opening! Je hebt direct de reden van je call benoemd. Probeer nu een open vraag te stellen om de situatie te verkennen." },
    ];
    const today = new Date();
    return [
      { id: "1", nummer: "1.2", naam: "Gentleman's agreement", fase: "1", type: "ai-chat" as SessionType, score: 55, quality: "needs-improvement" as const, duration: "12:30", date: new Date(today.getTime() - 9 * 86400000).toISOString().split('T')[0], time: "14:30", transcript: demoTranscript },
      { id: "2", nummer: "1.4", naam: "Instapvraag", fase: "1", type: "ai-audio" as SessionType, score: 72, quality: "good" as const, duration: "8:45", date: new Date(today.getTime() - 10 * 86400000).toISOString().split('T')[0], time: "10:15", transcript: demoTranscript },
      { id: "3", nummer: "2.1.1", naam: "Koopstijl herkennen", fase: "2", type: "ai-chat" as SessionType, score: 88, quality: "excellent" as const, duration: "15:20", date: new Date(today.getTime() - 12 * 86400000).toISOString().split('T')[0], time: "09:00", transcript: demoTranscript },
      { id: "4", nummer: "2.1.2", naam: "Situatievragen stellen", fase: "2", type: "ai-video" as SessionType, score: 65, quality: "good" as const, duration: "10:10", date: new Date(today.getTime() - 15 * 86400000).toISOString().split('T')[0], time: "16:45", transcript: demoTranscript },
      { id: "5", nummer: "1.1", naam: "Opening & rapport", fase: "1", type: "ai-chat" as SessionType, score: 91, quality: "excellent" as const, duration: "18:00", date: new Date(today.getTime() - 20 * 86400000).toISOString().split('T')[0], time: "11:30", transcript: demoTranscript },
      { id: "6", nummer: "3.1", naam: "Oplossing presenteren", fase: "3", type: "upload-audio" as SessionType, score: 47, quality: "needs-improvement" as const, duration: "22:15", date: new Date(today.getTime() - 25 * 86400000).toISOString().split('T')[0], time: "13:00", transcript: demoTranscript },
    ];
  }, []);

  useEffect(() => {
    async function fetchSessions() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/user/sessions');
        if (!response.ok) throw new Error('Failed to fetch sessions');
        const data = await response.json();
        
        if (data.sessions && data.sessions.length > 0) {
          const mappedSessions: Session[] = data.sessions.map((s: any) => ({
            id: s.id,
            nummer: s.nummer || s.techniqueId || '1.1',
            naam: s.naam || s.techniqueName || 'Techniek',
            fase: String(s.fase || '1'),
            type: s.type || 'ai-chat' as SessionType,
            score: s.score || 0,
            quality: s.quality || 'needs-improvement',
            duration: s.duration || '0:00',
            date: s.date || new Date().toISOString().split('T')[0],
            time: s.time,
            transcript: s.transcript || []
          }));
          setSessions(mappedSessions);
        } else {
          setSessions(demoSessions);
        }
      } catch (err: any) {
        console.error('Error fetching sessions:', err);
        setSessions(demoSessions);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSessions();
  }, [demoSessions]);

  const openSessionAnalysis = async (session: Session) => {
    const sessionId = String(session.id);

    if (/^\d+$/.test(sessionId)) {
      alert('Dit is een demo-sessie. Start een echte sessie via "Talk to Hugo" om analyses te bekijken.');
      return;
    }

    try {
      const statusRes = await fetch(`/api/v2/analysis/status/${sessionId}`);
      const statusData = await safeJsonParse(statusRes);
      if (statusData.status === 'completed') {
        sessionStorage.setItem('analysisId', sessionId);
        sessionStorage.setItem('analysisFromHugo', 'true');
        if (navigate) navigate('analysis-results');
        return;
      }
      if (statusData.status === 'failed') {
        handleAnalyzeSession(session);
        return;
      }
      if (statusData.status === 'processing' || statusData.status === 'analyzing' || statusData.status === 'evaluating' || statusData.status === 'generating_report') {
        setAnalyzingSessionIds(prev => new Set(prev).add(sessionId));
        const pollInterval = setInterval(async () => {
          try {
            const res = await fetch(`/api/v2/analysis/status/${sessionId}`);
            const data = await safeJsonParse(res);
            if (data.status === 'completed') {
              clearInterval(pollInterval);
              setAnalyzingSessionIds(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
              sessionStorage.setItem('analysisId', sessionId);
              sessionStorage.setItem('analysisFromHugo', 'true');
              if (navigate) navigate('analysis-results');
            } else if (data.status === 'failed') {
              clearInterval(pollInterval);
              setAnalyzingSessionIds(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
              alert(`Analyse mislukt: ${data.error || 'Onbekende fout'}`);
            }
          } catch {
            clearInterval(pollInterval);
            setAnalyzingSessionIds(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
          }
        }, 3000);
        return;
      }
    } catch {}
    handleAnalyzeSession(session);
  };

  useEffect(() => {
    if (!loading && sessions.length > 0) {
      const openId = sessionStorage.getItem("openSessionId");
      if (openId) {
        sessionStorage.removeItem("openSessionId");
        const match = sessions.find(s => String(s.id) === openId);
        if (match) {
          openSessionAnalysis(match);
        } else {
          const idx = parseInt(openId, 10) - 1;
          if (idx >= 0 && idx < sessions.length) {
            openSessionAnalysis(sessions[idx]);
          }
        }
      }
    }
  }, [loading, sessions]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredSessions = sessions
    .filter((session) => !hiddenIds.has(session.id))
    .filter((session) => {
      const matchesSearch =
        searchQuery === "" ||
        session.naam.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.nummer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        filterType === "all" || session.type === filterType;
      const matchesQuality =
        filterQuality === "all" || session.quality === filterQuality;
      return matchesSearch && matchesType && matchesQuality;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      
      if (sortField === "score") {
        return sortDirection === "asc" ? a.score - b.score : b.score - a.score;
      }
      if (sortField === "date") {
        const dateA = new Date(`${a.date} ${a.time || "00:00"}`).getTime();
        const dateB = new Date(`${b.date} ${b.time || "00:00"}`).getTime();
        return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
      }
      if (sortField === "duration") {
        const durA = parseInt(a.duration.replace(":", "")) || 0;
        const durB = parseInt(b.duration.replace(":", "")) || 0;
        return sortDirection === "asc" ? durA - durB : durB - durA;
      }
      const valA = String((a as any)[sortField] || "").toLowerCase();
      const valB = String((b as any)[sortField] || "").toLowerCase();
      const cmp = valA.localeCompare(valB);
      return sortDirection === "asc" ? cmp : -cmp;
    });

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-hh-muted" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="w-3 h-3 ml-1 text-hh-ink" />
      : <ArrowDown className="w-3 h-3 ml-1 text-hh-ink" />;
  };

  // Always use AppLayout for user view - this is the USER overview page
  // Admin view has its own separate component (AdminSessions)
  const Layout = AppLayout;
  const layoutProps = { currentPage: "hugo-overview", navigate, isAdmin };

  if (loading) {
    return (
      <Layout {...layoutProps}>
        <div className="p-6 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4F7396] mx-auto mb-4"></div>
            <p className="text-hh-muted">Sessies laden...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout {...layoutProps}>
        <div className="p-6">
          <Card className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Fout bij laden</h2>
            <p className="text-hh-muted">{error}</p>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout {...layoutProps}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Talk to Hugo <sup className="text-[18px]">AI</sup>
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Alle training sessies: AI roleplay, uploads en live analyses
            </p>
          </div>
          <Button
            style={{ backgroundColor: '#3C9A6E', color: 'white' }}
            className="gap-2"
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#2D7F57')}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#3C9A6E')}
            onClick={() => navigate?.("talk-to-hugo")}
          >
            <MessageSquare className="w-4 h-4 text-white" />
            Talk to Hugo <sup>AI</sup>
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { name: 'Totaal Sessies', value: sessions.length, icon: MessageSquare, bgColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', badge: '+15%', badgePositive: true },
            { name: 'Uitstekende Kwaliteit', value: sessions.filter(s => s.quality === "excellent").length, icon: CheckCircle2, bgColor: 'rgba(5, 150, 105, 0.12)', color: '#059669', badge: '+8%', badgePositive: true },
            { name: 'Gem. Score', value: `${sessions.length > 0 ? Math.round(sessions.reduce((acc, s) => acc + s.score, 0) / sessions.length) : 0}%`, icon: TrendingUp, bgColor: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', badge: '+2.3%', badgePositive: true },
            { name: 'Verbetering Nodig', value: sessions.filter(s => s.quality === "needs-improvement").length, icon: AlertTriangle, bgColor: 'rgba(234, 88, 12, 0.12)', color: '#ea580c', badge: '-5%', badgePositive: false },
          ].map(stat => (
            <Card key={stat.name} className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: stat.bgColor, color: stat.color }}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full border" style={stat.badgePositive ? { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' } : { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                  {stat.badge}
                </span>
              </div>
              <p className="text-[13px] leading-[18px] text-hh-muted">{stat.name}</p>
              <p className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px]" style={{ color: '#7c3aed' }}>{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters & Search */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek sessies, technieken..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Alle Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Types</SelectItem>
                <SelectItem value="ai-audio">AI Audio</SelectItem>
                <SelectItem value="ai-video">AI Video</SelectItem>
                <SelectItem value="ai-chat">AI Chat</SelectItem>
                <SelectItem value="upload-audio">Upload Audio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterQuality} onValueChange={setFilterQuality}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Alle Kwaliteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kwaliteit</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="needs-improvement">Needs Improvement</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("list")}
                style={viewMode === "list" ? { backgroundColor: '#3C9A6E', color: 'white' } : {}}
                className={viewMode !== "list" ? "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50" : "hover:opacity-90"}
              >
                <List className="w-4 h-4 text-current" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("grid")}
                style={viewMode === "grid" ? { backgroundColor: '#3C9A6E', color: 'white' } : {}}
                className={viewMode !== "grid" ? "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50" : "hover:opacity-90"}
              >
                <LayoutGrid className="w-4 h-4 text-current" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Sessions Table */}
        {viewMode === "list" ? (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[70px] cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("nummer")}
                    >
                      <div className="flex items-center">
                        #
                        <SortIcon field="nummer" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("naam")}
                    >
                      <div className="flex items-center">
                        Techniek
                        <SortIcon field="naam" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[120px] cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("type")}
                    >
                      <div className="flex items-center">
                        Type
                        <SortIcon field="type" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[80px] cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("score")}
                    >
                      <div className="flex items-center">
                        Score
                        <SortIcon field="score" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[80px] cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("duration")}
                    >
                      <div className="flex items-center">
                        Duur
                        <SortIcon field="duration" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[110px] cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center">
                        Datum
                        <SortIcon field="date" />
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[60px]">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="border-b border-hh-border last:border-0 hover:bg-hh-ui-50/50 transition-colors cursor-pointer"
                      onClick={() => openSessionAnalysis(session)}
                    >
                      {/* Technique Number Badge - emerald circles */}
                      <td className="py-3 px-4">
                        <span 
                          style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[12px] font-semibold"
                        >
                          {session.nummer}
                        </span>
                      </td>
                      
                      {/* Technique Name + Fase */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[14px] text-hh-text font-medium truncate">
                            {session.naam}
                          </span>
                          <span className="text-[12px] text-hh-muted">
                            {getFaseNaam(session.fase)}
                          </span>
                        </div>
                      </td>
                      
                      {/* Type with Icon */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(session.type)}
                          <span className="text-[14px] text-hh-text">
                            {getTypeLabel(session.type)}
                          </span>
                        </div>
                      </td>
                      
                      {/* Score - colored */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-[14px] font-medium ${
                            session.score >= 80
                              ? "text-hh-success"
                              : session.score >= 70
                              ? "text-blue-600"
                              : "text-hh-warn"
                          }`}
                        >
                          {session.score}%
                        </span>
                      </td>
                      
                      {/* Duration */}
                      <td className="py-3 px-4">
                        <span className="text-[14px] text-hh-text">{session.duration}</span>
                      </td>
                      
                      {/* Date */}
                      <td className="py-3 px-4 text-[13px] text-hh-muted">
                        {session.date}
                      </td>
                      
                      {/* Actions */}
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4 text-hh-muted" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openSessionAnalysis(session)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleAnalyzeSession(session)}
                              disabled={analyzingSessionIds.has(String(session.id))}
                            >
                              <BarChart3 className="w-4 h-4 mr-2" />
                              {analyzingSessionIds.has(String(session.id)) ? 'Bezig met analyseren...' : 'Analyseer Sessie'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteSession(session.id)} className="text-red-600 focus:text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <Card
                key={session.id}
                className="p-5 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openSessionAnalysis(session)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span 
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[12px] font-semibold border-2 bg-hh-success/10 text-hh-success border-hh-success"
                    >
                      {session.nummer}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                      {getTypeIcon(session.type)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <MoreVertical className="w-4 h-4 text-hh-muted" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e: Event) => { e.stopPropagation(); openSessionAnalysis(session); }}>
                        <Eye className="w-4 h-4 mr-2" />
                        Bekijk details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e: Event) => { e.stopPropagation(); handleAnalyzeSession(session); }}
                        disabled={analyzingSessionIds.has(String(session.id))}
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        {analyzingSessionIds.has(String(session.id)) ? 'Bezig met analyseren...' : 'Analyseer Sessie'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteSession(session.id)} className="text-red-600 focus:text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Verwijderen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="text-[16px] font-medium text-hh-text mb-1">
                  {session.naam}
                </h3>
                <p className="text-[12px] text-hh-muted mb-3">
                  {getFaseNaam(session.fase)}
                </p>

                <div className="flex items-center gap-2 mb-4">
                  {getQualityBadge(session.quality)}
                  <Badge variant="outline" className="text-[11px]">
                    {getTypeLabel(session.type)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[13px] text-hh-muted">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#4F7396]" />
                    {session.duration}
                  </div>
                  <span
                    className={`font-medium ${
                      session.score >= 80
                        ? "text-hh-success"
                        : session.score >= 70
                        ? "text-blue-600"
                        : "text-hh-warn"
                    }`}
                  >
                    {session.score}%
                  </span>
                  <span>{session.date}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

    </Layout>
  );
}
