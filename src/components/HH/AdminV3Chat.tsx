import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Bug,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  Hash,
  Wrench,
} from "lucide-react";
import { getAuthHeaders } from "../../services/hugoApi";
import { AdminLayout } from "./AdminLayout";

// ── Types ───────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  usage?: { inputTokens: number; outputTokens: number };
  model?: string;
  timestamp: number;
}

interface Props {
  navigate?: (page: string, data?: any) => void;
  isSuperAdmin?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export function AdminV3Chat({ navigate, isSuperAdmin }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(true);
  const [totalTokens, setTotalTokens] = useState({ input: 0, output: 0 });
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Start V3 session on mount ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/v3/session", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({ userProfile: {} }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;

        setSessionId(data.sessionId);

        if (data.opening?.text) {
          const msg: Message = {
            role: "assistant",
            content: data.opening.text,
            toolsUsed: data.opening.toolsUsed || [],
            usage: data.usage,
            model: data.opening.model,
            timestamp: Date.now(),
          };
          setMessages([msg]);
          setTotalTokens({
            input: data.usage?.inputTokens || 0,
            output: data.usage?.outputTokens || 0,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Kon V3 sessie niet starten.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    startSession();
    return () => { cancelled = true; };
  }, []);

  // ── Send message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !sessionId || isLoading) return;

    const userMsg: Message = {
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v3/session/${sessionId}/message`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMsg: Message = {
        role: "assistant",
        content: data.response?.text || "",
        toolsUsed: data.response?.toolsUsed || [],
        usage: data.usage,
        model: data.response?.model,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      setTotalTokens(prev => ({
        input: prev.input + (data.usage?.inputTokens || 0),
        output: prev.output + (data.usage?.outputTokens || 0),
      }));
    } catch (err: any) {
      setError(err.message || "Fout bij verwerken van bericht.");
      const errorMsg: Message = {
        role: "assistant",
        content: `Fout: ${err.message}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [sessionId, isLoading]);

  // ── Handlers ───────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <AdminLayout currentPage="admin-v3-chat" navigate={navigate} isSuperAdmin={isSuperAdmin}>
    <div className="admin-session flex h-full bg-hh-bg">
      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hh-border bg-hh-bg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-hh-primary flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-hh-text leading-tight">
                HugoClaw <span className="text-[12px] text-hh-muted font-normal">V3</span>
              </h1>
              <p className="text-[12px] text-hh-muted">
                Admin Agent — Claude-powered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessionId && (
              <span className="text-[11px] text-hh-muted font-mono bg-hh-ui-50 px-2 py-1 rounded">
                {sessionId.slice(0, 12)}...
              </span>
            )}
            <button
              onClick={() => setDebugOpen(prev => !prev)}
              className="flex items-center gap-1 text-[12px] text-hh-muted hover:text-hh-primary px-3 py-1.5 rounded-lg hover:bg-hh-ui-50 transition-colors"
            >
              <Bug size={14} />
              Debug
              {debugOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Initial loading state */}
          {messages.length === 0 && isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-14 h-14 rounded-full bg-hh-primary flex items-center justify-center">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
              <p className="text-[16px] text-hh-muted font-medium">
                V3 sessie wordt gestart...
              </p>
            </div>
          )}

          {/* Error state */}
          {error && messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="bg-hh-error/10 text-hh-error px-4 py-3 rounded-lg text-[14px]">
                {error}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-[13px] text-hh-primary hover:underline"
              >
                Herlaad pagina
              </button>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                msg.role === "user" ? "bg-hh-primary/20" : "bg-hh-primary"
              }`}>
                {msg.role === "user"
                  ? <User size={16} className="text-hh-primary" />
                  : <Bot size={16} className="text-white" />
                }
              </div>

              {/* Bubble */}
              <div className={`max-w-[75%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-hh-primary text-white rounded-[16px] rounded-br-sm"
                    : "bg-hh-ui-50 text-hh-text border border-hh-border rounded-[16px] rounded-bl-sm"
                }`}>
                  {msg.content}
                </div>

                {/* Inline tool badges */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.toolsUsed.map((tool, ti) => (
                      <span key={ti} className="text-[10px] font-mono bg-hh-primary/10 text-hh-primary px-2 py-0.5 rounded-full border border-hh-primary/20">
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && messages.length > 0 && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-hh-primary flex-shrink-0 flex items-center justify-center">
                <Loader2 size={16} className="text-white animate-spin" />
              </div>
              <div className="bg-hh-ui-50 border border-hh-border rounded-[16px] rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-hh-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-hh-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-hh-muted animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-hh-border bg-hh-bg px-6 py-4">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionId ? "Typ je bericht..." : "Sessie wordt gestart..."}
              disabled={isLoading || !sessionId}
              rows={2}
              className="flex-1 px-4 py-3 rounded-[12px] border-2 border-hh-border text-[14px] text-hh-text bg-hh-bg resize-none outline-none transition-colors focus:border-hh-primary disabled:opacity-50 disabled:bg-hh-ui-50"
              style={{ fontFamily: "inherit" }}
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading || !inputValue.trim() || !sessionId}
              className="h-[48px] px-5 rounded-[12px] bg-hh-primary text-white font-semibold text-[14px] flex items-center gap-2 transition-colors hover:bg-hh-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isLoading
                ? <Loader2 size={18} className="animate-spin" />
                : <Send size={18} />
              }
            </button>
          </div>
          <p className="text-[11px] text-hh-muted mt-2">
            Enter = versturen · Shift+Enter = nieuwe regel
          </p>
        </div>
      </div>

      {/* Debug Panel */}
      {debugOpen && (
        <div className="w-[320px] border-l border-hh-border bg-hh-ui-50 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b border-hh-border bg-hh-bg">
            <h2 className="text-[14px] font-semibold text-hh-text flex items-center gap-2">
              <Bug size={14} className="text-hh-primary" />
              Debug Panel
            </h2>
          </div>

          {/* Session Info */}
          <div className="px-4 py-3 border-b border-hh-border space-y-2">
            <div className="text-[11px] text-hh-muted uppercase font-semibold tracking-wider">Sessie</div>
            <div className="space-y-1.5">
              <DebugRow icon={<Hash size={12} />} label="Session ID" value={sessionId ? sessionId.slice(3, 15) : "—"} />
              <DebugRow icon={<Zap size={12} />} label="Engine" value="V3 Claude Agent" />
              <DebugRow icon={<Clock size={12} />} label="Berichten" value={String(messages.length)} />
            </div>
          </div>

          {/* Token Usage */}
          <div className="px-4 py-3 border-b border-hh-border space-y-2">
            <div className="text-[11px] text-hh-muted uppercase font-semibold tracking-wider">Token Usage</div>
            <div className="space-y-1.5">
              <DebugRow label="Input tokens" value={totalTokens.input.toLocaleString()} />
              <DebugRow label="Output tokens" value={totalTokens.output.toLocaleString()} />
              <DebugRow label="Totaal" value={(totalTokens.input + totalTokens.output).toLocaleString()} highlight />
            </div>
          </div>

          {/* Tool Usage Log */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="text-[11px] text-hh-muted uppercase font-semibold tracking-wider mb-2">Tool Calls</div>
            <div className="space-y-2">
              {messages
                .filter(m => m.toolsUsed && m.toolsUsed.length > 0)
                .flatMap((m, mi) =>
                  (m.toolsUsed || []).map((tool, ti) => (
                    <div key={`${mi}-${ti}`} className="flex items-center gap-2 text-[12px]">
                      <Wrench size={11} className="text-hh-primary flex-shrink-0" />
                      <span className="font-mono text-hh-text truncate">{tool}</span>
                    </div>
                  ))
                )
              }
              {messages.every(m => !m.toolsUsed || m.toolsUsed.length === 0) && (
                <p className="text-[12px] text-hh-muted italic">Nog geen tool calls</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}

// ── Debug Row Helper ────────────────────────────────────────────────────────

function DebugRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-hh-muted flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`text-[12px] font-mono ${highlight ? "text-hh-primary font-semibold" : "text-hh-text"}`}>
        {value}
      </span>
    </div>
  );
}
