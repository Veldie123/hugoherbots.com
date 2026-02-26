import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Bot, User, Loader2, AlertTriangle, Info, ChevronUp, ChevronDown, Save, Play, ExternalLink, CheckCircle, Clock, BarChart3 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
  suggestions?: string[];
  urgencyFlags?: UrgencyFlag[];
}

interface ToolResult {
  tool: string;
  data: any;
  display_type: string;
  error?: string;
}

interface UrgencyFlag {
  type: "critical" | "warning" | "info";
  message: string;
}

interface Props {
  navigate?: (page: string, data?: any) => void;
  isSuperAdmin?: boolean;
}

const AGENT_BASE = "http://localhost:3002";

export function AdminHugoAgent({ navigate }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = useCallback(async (text: string, isFirstLoad = false) => {
    if (!text.trim() && !isFirstLoad) return;

    const userMessage: Message = { role: "user", content: text };
    if (!isFirstLoad) {
      setMessages(prev => [...prev, userMessage]);
    }
    setIsLoading(true);
    setInputValue("");

    const history = messages
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch(`${AGENT_BASE}/api/hugo-agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, isFirstLoad })
      });

      if (!response.ok) {
        throw new Error(`Server fout: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply || "",
        toolResults: data.tool_results || [],
        suggestions: data.suggestions || [],
        urgencyFlags: data.urgency_flags || []
      };

      setMessages(prev => isFirstLoad ? [assistantMessage] : [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Er ging iets mis: ${err.message}. Probeer opnieuw.`,
        suggestions: ["Probeer opnieuw", "Toon de webinars", "Toon de analytics"]
      };
      setMessages(prev => isFirstLoad ? [errorMessage] : [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  useEffect(() => {
    if (!hasLoaded) {
      setHasLoaded(true);
      sendMessage("dagelijkse briefing", true);
    }
  }, [hasLoaded, sendMessage]);

  const handleSubmit = () => {
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      sendMessage(suggestion);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#f8f9fa" }}>
      <div style={{
        padding: "20px 24px 16px",
        borderBottom: "1px solid #e5e7eb",
        backgroundColor: "white",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Bot size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Talk to Myself AI</h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Uw persoonlijke platformassistent</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {messages.length === 0 && isLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Loader2 size={26} color="white" style={{ animation: "spin 1s linear infinite" }} />
            </div>
            <p style={{ fontSize: 18, color: "#6b7280", fontWeight: 500 }}>Uw dagelijkse briefing wordt geladen...</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {message.urgencyFlags && message.urgencyFlags.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {message.urgencyFlags.map((flag, fi) => (
                  <UrgencyBanner key={fi} flag={flag} />
                ))}
              </div>
            )}

            <div style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              flexDirection: message.role === "user" ? "row-reverse" : "row"
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                flexShrink: 0,
                background: message.role === "user"
                  ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                  : "linear-gradient(135deg, #7c3aed, #5b21b6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {message.role === "user"
                  ? <User size={18} color="white" />
                  : <Bot size={18} color="white" />}
              </div>

              <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 8 }}>
                {message.content && (
                  <div style={{
                    backgroundColor: message.role === "user" ? "#3b82f6" : "white",
                    color: message.role === "user" ? "white" : "#111827",
                    borderRadius: message.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    padding: "14px 18px",
                    fontSize: 17,
                    lineHeight: 1.6,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    border: message.role === "assistant" ? "1px solid #f3f4f6" : "none",
                    whiteSpace: "pre-wrap"
                  }}>
                    {message.content}
                  </div>
                )}

                {message.toolResults && message.toolResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {message.toolResults.map((result, ri) => (
                      <ToolCard key={ri} result={result} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {message.suggestions && message.suggestions.length > 0 && (
              <div style={{ paddingLeft: 48, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {message.suggestions.map((s, si) => (
                  <button
                    key={si}
                    onClick={() => handleSuggestionClick(s)}
                    disabled={isLoading}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 24,
                      border: "1.5px solid #d1d5db",
                      backgroundColor: "white",
                      color: "#374151",
                      fontSize: 15,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                      fontWeight: 500,
                      opacity: isLoading ? 0.5 : 1
                    }}
                    onMouseEnter={e => {
                      if (!isLoading) {
                        (e.target as HTMLElement).style.backgroundColor = "#f3f4f6";
                        (e.target as HTMLElement).style.borderColor = "#9ca3af";
                      }
                    }}
                    onMouseLeave={e => {
                      (e.target as HTMLElement).style.backgroundColor = "white";
                      (e.target as HTMLElement).style.borderColor = "#d1d5db";
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && messages.length > 0 && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <Loader2 size={18} color="white" style={{ animation: "spin 1s linear infinite" }} />
            </div>
            <div style={{
              backgroundColor: "white", borderRadius: "18px 18px 18px 4px",
              padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid #f3f4f6", display: "flex", gap: 6, alignItems: "center"
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: "50%", backgroundColor: "#9ca3af",
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{
        padding: "16px 24px 20px",
        borderTop: "1px solid #e5e7eb",
        backgroundColor: "white",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Typ hier uw bericht... (bijv. 'Wanneer is het volgende webinar?' of 'Verander de volgorde van video 3 en 4')"
            disabled={isLoading}
            rows={2}
            style={{
              flex: 1,
              padding: "14px 18px",
              borderRadius: 16,
              border: "2px solid #e5e7eb",
              fontSize: 17,
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
              transition: "border-color 0.15s",
              backgroundColor: isLoading ? "#f9fafb" : "white",
              color: "#111827"
            }}
            onFocus={e => { e.target.style.borderColor = "#7c3aed"; }}
            onBlur={e => { e.target.style.borderColor = "#e5e7eb"; }}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !inputValue.trim()}
            style={{
              padding: "14px 24px",
              borderRadius: 16,
              border: "none",
              background: isLoading || !inputValue.trim()
                ? "#e5e7eb"
                : "linear-gradient(135deg, #7c3aed, #5b21b6)",
              color: isLoading || !inputValue.trim() ? "#9ca3af" : "white",
              fontSize: 16,
              fontWeight: 600,
              cursor: isLoading || !inputValue.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s",
              flexShrink: 0,
              height: 54
            }}
          >
            {isLoading ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={20} />}
            Versturen
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 8, marginBottom: 0 }}>
          Druk op Enter om te versturen, Shift+Enter voor een nieuwe regel
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

// ── Urgency Banner ────────────────────────────────────────────────────────────
function UrgencyBanner({ flag }: { flag: UrgencyFlag }) {
  const colors = {
    critical: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", icon: <AlertTriangle size={18} /> },
    warning: { bg: "#fffbeb", border: "#fcd34d", text: "#d97706", icon: <AlertTriangle size={18} /> },
    info: { bg: "#eff6ff", border: "#bfdbfe", text: "#2563eb", icon: <Info size={18} /> }
  };
  const style = colors[flag.type] || colors.info;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 16px", borderRadius: 12,
      backgroundColor: style.bg, border: `1.5px solid ${style.border}`,
      color: style.text, fontSize: 15, fontWeight: 500
    }}>
      {style.icon}
      {flag.message}
    </div>
  );
}

// ── Tool Result Card ───────────────────────────────────────────────────────────
function ToolCard({ result, navigate }: { result: ToolResult; navigate?: (page: string, data?: any) => void }) {
  if (result.error) {
    return (
      <div style={{
        padding: "12px 16px", borderRadius: 12,
        backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14
      }}>
        ⚠️ {result.error}
      </div>
    );
  }

  switch (result.display_type) {
    case "webinar_list":
      return <WebinarListCard data={result.data} />;
    case "video_order":
      return <VideoOrderCard data={result.data} />;
    case "analytics":
      return <AnalyticsCard data={result.data} tool={result.tool} />;
    case "start_button":
      return <StartWebinarCard data={result.data} navigate={navigate} />;
    case "config_proposal":
      return <ConfigProposalCard data={result.data} navigate={navigate} />;
    case "analysis_list":
      return <AnalysisListCard data={result.data} navigate={navigate} />;
    case "transcript":
      return <TranscriptCard data={result.data} />;
    case "rag_results":
      return <RagResultsCard data={result.data} tool={result.tool} />;
    case "user_list":
      return <UserListCard data={result.data} />;
    default:
      return null;
  }
}

// ── Webinar List Card ──────────────────────────────────────────────────────────
function WebinarListCard({ data }: { data: any[] }) {
  const [sessions, setSessions] = useState<any[]>(Array.isArray(data) ? data : []);
  const [editing, setEditing] = useState<{ [id: string]: { title?: string; scheduled_date?: string } }>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (!sessions.length) return (
    <div style={{ padding: "16px", backgroundColor: "white", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 16, color: "#6b7280" }}>
      Geen webinars gevonden.
    </div>
  );

  const handleEdit = (id: string, field: string, value: string) => {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (id: string) => {
    const patch = editing[id];
    if (!patch || !Object.keys(patch).length) return;
    setSaving(id);
    try {
      const res = await fetch(`http://localhost:3001/api/admin/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const result = await res.json();
      if (result.success && result.session) {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, ...result.session } : s));
      }
      setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
      setSaved(id);
      setTimeout(() => setSaved(null), 2000);
    } catch {
    }
    setSaving(null);
  };

  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontWeight: 700, fontSize: 17, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
        📅 Webinars ({sessions.length})
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f9fafb" }}>
              {["Titel", "Datum & Tijd", "Status", "Actie"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, i) => {
              const ed = editing[session.id] || {};
              const isSaving = saving === session.id;
              const isSaved = saved === session.id;
              const hasEdits = Object.keys(ed).length > 0;

              return (
                <tr key={session.id} style={{ borderBottom: i < sessions.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <input
                      value={ed.title ?? session.title ?? ""}
                      onChange={e => handleEdit(session.id, "title", e.target.value)}
                      style={{
                        width: "100%", padding: "6px 10px", fontSize: 16,
                        border: ed.title !== undefined ? "1.5px solid #7c3aed" : "1px solid transparent",
                        borderRadius: 8, outline: "none", backgroundColor: ed.title !== undefined ? "#faf5ff" : "transparent",
                        color: "#111827", fontFamily: "inherit"
                      }}
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <input
                      type="datetime-local"
                      value={(ed.scheduled_date ?? session.scheduled_date ?? "").replace("Z", "").slice(0, 16)}
                      onChange={e => handleEdit(session.id, "scheduled_date", e.target.value + ":00Z")}
                      style={{
                        padding: "6px 10px", fontSize: 15,
                        border: ed.scheduled_date !== undefined ? "1.5px solid #7c3aed" : "1px solid transparent",
                        borderRadius: 8, outline: "none", backgroundColor: ed.scheduled_date !== undefined ? "#faf5ff" : "transparent",
                        color: "#111827", fontFamily: "inherit"
                      }}
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                      backgroundColor: session.status === "live" ? "#dcfce7" : session.status === "scheduled" ? "#eff6ff" : "#f3f4f6",
                      color: session.status === "live" ? "#16a34a" : session.status === "scheduled" ? "#2563eb" : "#6b7280"
                    }}>
                      {session.status === "live" ? "Live" : session.status === "scheduled" ? "Gepland" : session.status || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {hasEdits && (
                      <button
                        onClick={() => handleSave(session.id)}
                        disabled={isSaving}
                        style={{
                          padding: "6px 14px", borderRadius: 8, border: "none",
                          backgroundColor: isSaved ? "#16a34a" : "#7c3aed", color: "white",
                          fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                        }}
                      >
                        {isSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : isSaved ? <CheckCircle size={14} /> : <Save size={14} />}
                        {isSaved ? "Opgeslagen!" : "Opslaan"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Video Order Card ───────────────────────────────────────────────────────────
function VideoOrderCard({ data }: { data: any[] }) {
  const [videos, setVideos] = useState<any[]>(
    (Array.isArray(data) ? data : []).slice(0, 20)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const move = (index: number, dir: -1 | 1) => {
    const newList = [...videos];
    const target = index + dir;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setVideos(newList);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = videos.map((v, i) => ({ id: v.id, playback_order: i + 1 }));
      await fetch("http://localhost:3001/api/videos/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: items })
      });
      setIsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (!videos.length) return null;

  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>🎬 Video-volgorde ({videos.length})</span>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 18px", borderRadius: 10, border: "none",
              backgroundColor: saved ? "#16a34a" : "#7c3aed", color: "white",
              fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? "Opgeslagen!" : "Volgorde opslaan"}
          </button>
        )}
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {videos.map((video, i) => (
          <div key={video.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 20px",
            borderBottom: i < videos.length - 1 ? "1px solid #f3f4f6" : "none",
            backgroundColor: "white"
          }}>
            <span style={{ width: 28, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#7c3aed" }}>{i + 1}</span>
            {video.thumbnail_url && (
              <img src={video.thumbnail_url} alt="" style={{ width: 48, height: 32, objectFit: "cover", borderRadius: 6 }} />
            )}
            <span style={{ flex: 1, fontSize: 16, color: "#374151", fontWeight: 500 }}>{video.title || video.display_title || "Ongetiteld"}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button onClick={() => move(i, -1)} disabled={i === 0}
                style={{ padding: "3px 8px", border: "1px solid #e5e7eb", borderRadius: 6, backgroundColor: i === 0 ? "#f9fafb" : "white", cursor: i === 0 ? "not-allowed" : "pointer", color: i === 0 ? "#d1d5db" : "#6b7280" }}>
                <ChevronUp size={14} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === videos.length - 1}
                style={{ padding: "3px 8px", border: "1px solid #e5e7eb", borderRadius: 6, backgroundColor: i === videos.length - 1 ? "#f9fafb" : "white", cursor: i === videos.length - 1 ? "not-allowed" : "pointer", color: i === videos.length - 1 ? "#d1d5db" : "#6b7280" }}>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Analytics Card ─────────────────────────────────────────────────────────────
function AnalyticsCard({ data, tool }: { data: any; tool: string }) {
  if (!data) return null;

  const isPipeline = tool === "get_webinar_pipeline_status";
  if (isPipeline) {
    return (
      <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: "#111827", marginBottom: 12 }}>📅 Webinar pipeline</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: data.warning ? "#d97706" : "#16a34a" }}>{data.upcoming_count}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>webinar(s) gepland</div>
            {data.warning && (
              <div style={{ fontSize: 15, color: "#d97706", fontWeight: 500, marginTop: 4 }}>⚠️ Plan meer webinars in!</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (Array.isArray(data) && data.length > 0 && data[0]?.technique) {
    return (
      <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: "#111827", marginBottom: 12 }}>📊 Lage techniek-scores</div>
        {data.map((row: any, i: number) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < data.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            <span style={{ fontSize: 16, color: "#374151" }}>{row.technique || "Onbekend"}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: Number(row.avg_score) < 40 ? "#dc2626" : "#d97706" }}>
              {Number(row.avg_score || 0).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    );
  }

  const kpis = typeof data === "object" && !Array.isArray(data) ? Object.entries(data).filter(([, v]) => typeof v === "number" || typeof v === "string").slice(0, 6) : [];

  if (!kpis.length) return null;

  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: "#111827", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <BarChart3 size={20} color="#7c3aed" /> Platform Analytics
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {kpis.map(([key, value]) => (
          <div key={key} style={{ backgroundColor: "#f9fafb", borderRadius: 12, padding: "14px 16px", border: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, textTransform: "capitalize", marginBottom: 4 }}>{key.replace(/_/g, " ")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>{String(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Start Webinar Card ─────────────────────────────────────────────────────────
function StartWebinarCard({ data, navigate }: { data: any; navigate?: (page: string, data?: any) => void }) {
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch(`http://localhost:3001/api/admin/sessions/${data.session_id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const result = await res.json();
      if (result.success) {
        setStarted(true);
        if (navigate) navigate("admin-live");
      }
    } catch {}
    setStarting(false);
  };

  return (
    <div style={{
      backgroundColor: started ? "#f0fdf4" : "#faf5ff",
      borderRadius: 16, border: `2px solid ${started ? "#86efac" : "#c4b5fd"}`,
      padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", textAlign: "center" }}>
        {started ? "✅ Webinar is gestart!" : `Klaar om te starten: "${data.session_title}"`}
      </div>
      {!started && (
        <button
          onClick={handleStart}
          disabled={starting}
          style={{
            padding: "16px 32px", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            color: "white", fontSize: 20, fontWeight: 700,
            cursor: starting ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 4px 14px rgba(22,163,74,0.3)"
          }}
        >
          {starting ? <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={22} fill="white" />}
          {starting ? "Starten..." : "▶ Start Webinar"}
        </button>
      )}
    </div>
  );
}

// ── Config Proposal Card ───────────────────────────────────────────────────────
function ConfigProposalCard({ data, navigate }: { data: any; navigate?: (page: string) => void }) {
  return (
    <div style={{
      backgroundColor: "#fffbeb", borderRadius: 16, border: "2px solid #fcd34d",
      padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
    }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: "#92400e", marginBottom: 12 }}>
        💡 Wijzigingsvoorstel aangemaakt
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
        <div><span style={{ fontWeight: 600, color: "#78350f" }}>Type:</span> <span style={{ color: "#374151" }}>{data.type}</span></div>
        {data.field && <div><span style={{ fontWeight: 600, color: "#78350f" }}>Onderdeel:</span> <span style={{ color: "#374151" }}>{data.field}</span></div>}
        {data.current_value && (
          <div style={{ backgroundColor: "#fef3c7", padding: "8px 12px", borderRadius: 8 }}>
            <span style={{ fontWeight: 600, color: "#78350f" }}>Huidig:</span> <span style={{ color: "#374151" }}>{data.current_value}</span>
          </div>
        )}
        <div style={{ backgroundColor: "#d1fae5", padding: "8px 12px", borderRadius: 8 }}>
          <span style={{ fontWeight: 600, color: "#065f46" }}>Nieuw:</span> <span style={{ color: "#374151" }}>{data.proposed_value}</span>
        </div>
        {data.reason && <div style={{ color: "#6b7280", fontStyle: "italic" }}>{data.reason}</div>}
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, color: "#d97706", fontSize: 14 }}>
        <Clock size={16} />
        Verzonden naar Stéphane ter goedkeuring
        {navigate && (
          <button
            onClick={() => navigate("admin-config-review")}
            style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 8, border: "1px solid #fcd34d", backgroundColor: "white", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4, color: "#374151" }}
          >
            <ExternalLink size={13} /> Config Review
          </button>
        )}
      </div>
    </div>
  );
}

// ── Analysis List Card ─────────────────────────────────────────────────────────
function AnalysisListCard({ data, navigate }: { data: any[]; navigate?: (page: string, d?: any) => void }) {
  if (!Array.isArray(data) || !data.length) return (
    <div style={{ padding: 16, backgroundColor: "white", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 16, color: "#6b7280" }}>
      Geen analyses gevonden.
    </div>
  );

  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontWeight: 700, fontSize: 17, color: "#111827" }}>
        🎙️ Gespreksanalyses ({data.length})
      </div>
      {data.map((analysis, i) => (
        <div key={analysis.id} style={{
          display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
          borderBottom: i < data.length - 1 ? "1px solid #f3f4f6" : "none",
          cursor: navigate ? "pointer" : "default"
        }}
          onClick={() => navigate && navigate("admin-analysis-results", { conversationId: analysis.id, fromAdmin: true })}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>{analysis.title || "Naamloze analyse"}</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
              {analysis.created_at ? new Date(analysis.created_at).toLocaleDateString("nl-BE") : "—"}
            </div>
          </div>
          {analysis.score && (
            <span style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 14, fontWeight: 700,
              backgroundColor: Number(analysis.score) >= 70 ? "#dcfce7" : Number(analysis.score) >= 50 ? "#fef9c3" : "#fef2f2",
              color: Number(analysis.score) >= 70 ? "#16a34a" : Number(analysis.score) >= 50 ? "#ca8a04" : "#dc2626"
            }}>
              {Number(analysis.score).toFixed(0)}%
            </span>
          )}
          {navigate && <ExternalLink size={16} color="#9ca3af" />}
        </div>
      ))}
    </div>
  );
}

// ── Transcript Card ────────────────────────────────────────────────────────────
function TranscriptCard({ data }: { data: any }) {
  if (!data) return null;
  const result = typeof data.result === "string" ? JSON.parse(data.result) : data.result;

  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: "#111827", marginBottom: 12 }}>
        📄 {data.title || "Analyse detail"}
      </div>
      {result?.overallScore && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, color: "#6b7280" }}>Score:</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: Number(result.overallScore) >= 70 ? "#16a34a" : "#d97706" }}>
            {result.overallScore}%
          </span>
        </div>
      )}
      {result?.summary && (
        <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.6, backgroundColor: "#f9fafb", padding: 14, borderRadius: 10 }}>
          {result.summary}
        </div>
      )}
    </div>
  );
}

// ── RAG Results Card ───────────────────────────────────────────────────────────
function RagResultsCard({ data, tool }: { data: any; tool: string }) {
  if (!data) return null;

  const items = Array.isArray(data) ? data : (data.results || data.techniques || []);
  if (!items.length) return null;

  const isTechnique = tool === "get_technique_details";

  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontWeight: 700, fontSize: 17, color: "#111827" }}>
        {isTechnique ? "🎯 EPIC Techniek" : "📚 Kennisbank resultaten"}
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {items.map((item: any, i: number) => (
          <div key={i} style={{ padding: "14px 20px", borderBottom: i < items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
              {item.naam || item.title || item.document_title || `Resultaat ${i + 1}`}
            </div>
            {(item.beschrijving || item.description || item.content) && (
              <div style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.5 }}>
                {(item.beschrijving || item.description || item.content || "").slice(0, 200)}...
              </div>
            )}
            {item.similarity && (
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                Relevantie: {(item.similarity * 100).toFixed(0)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── User List Card ─────────────────────────────────────────────────────────────
function UserListCard({ data }: { data: any[] }) {
  if (!Array.isArray(data) || !data.length) return (
    <div style={{ padding: 16, backgroundColor: "white", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 16, color: "#6b7280" }}>
      Geen gebruikers gevonden.
    </div>
  );

  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontWeight: 700, fontSize: 17, color: "#111827" }}>
        👥 Gebruikers ({data.length})
      </div>
      {data.map((user, i) => (
        <div key={user.id || i} style={{
          display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
          borderBottom: i < data.length - 1 ? "1px solid #f3f4f6" : "none"
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            backgroundColor: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#7c3aed", flexShrink: 0
          }}>
            {(user.full_name || user.email || "?")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>{user.full_name || user.email || "Onbekend"}</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              Laatste activiteit: {user.last_seen_at || user.updated_at
                ? new Date(user.last_seen_at || user.updated_at).toLocaleDateString("nl-BE")
                : "onbekend"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
