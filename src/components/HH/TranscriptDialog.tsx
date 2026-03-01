/**
 * TranscriptDialog - Admin transcript review with Golden Standard integration
 * 
 * Features:
 *   - Collapsible debug info panel per message (signal, detected/expected technique, etc.)
 *   - Edit mode for correcting AI evaluations
 *   - Golden Standard validation buttons (✓/✗) for saving reference answers
 *   - Integration with save-reference and flag-customer-response APIs
 * 
 * Frontend koppeling: AdminSessions.tsx, HugoAIOverview.tsx transcript dialogs
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { getCodeBadgeColors } from "../../utils/phaseColors";
import { getAllTechnieken } from "../../data/technieken-service";

export interface TranscriptDebugInfo {
  signal?: "positief" | "neutraal" | "negatief";
  detectedTechnique?: string;
  expectedTechnique?: string;
  persona?: {
    gedragsstijl?: string;
    koopklok?: string;
    moeilijkheid?: string;
  };
  context?: {
    fase?: number;
    gathered?: {
      sector?: string | null;
      product?: string | null;
      klantType?: string | null;
      verkoopkanaal?: string | null;
    };
  };
  customerDynamics?: {
    rapport?: number;
    valueTension?: number;
    commitReadiness?: number;
  };
  aiDecision?: {
    epicFase?: string;
    evaluatie?: string;
  };
}

export interface TranscriptMessage {
  speaker: string;
  time: string;
  text: string;
  debugInfo?: TranscriptDebugInfo;
}

export interface TranscriptSession {
  id: number | string;
  sessionId?: string;
  userName?: string;
  userWorkspace?: string;
  techniqueNumber: string;
  techniqueName: string;
  type: string;
  date: string;
  time?: string;
  duration?: string;
  score?: number;
  quality: "excellent" | "good" | "needs-improvement" | "Excellent" | "Good" | "Needs Work";
  transcript: TranscriptMessage[];
  strengths?: string[];
  improvements?: string[];
}

interface EditState {
  lineId: string;
  lineIndex: number;
  signal: "positief" | "neutraal" | "negatief";
  expectedTechnique: string;
  detectedTechnique: string;
}

interface TranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: TranscriptSession | null;
  isAdmin?: boolean;
}

const getQualityBadge = (quality: string) => {
  const lowerQuality = quality.toLowerCase().replace(" ", "-");
  switch (lowerQuality) {
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
    case "needs-work":
      return (
        <Badge className="bg-hh-warning/10 text-hh-warning border-hh-warning/20 hover:bg-hh-warning/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Needs Improvement
        </Badge>
      );
    default:
      return null;
  }
};

export function TranscriptDialog({ open, onOpenChange, session, isAdmin = false }: TranscriptDialogProps) {
  const [expandedDebug, setExpandedDebug] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [validatedLines, setValidatedLines] = useState<Set<string>>(new Set());
  const [flaggedLines, setFlaggedLines] = useState<Set<string>>(new Set());
  const [showFeedbackInput, setShowFeedbackInput] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  
  const allTechnieken = getAllTechnieken();

  const toggleDebug = (lineId: string) => {
    setExpandedDebug(expandedDebug === lineId ? null : lineId);
  };

  const startEdit = (lineId: string, lineIndex: number, line: TranscriptMessage) => {
    setEditState({
      lineId,
      lineIndex,
      signal: line.debugInfo?.signal || "neutraal",
      expectedTechnique: line.debugInfo?.expectedTechnique || session?.techniqueNumber || "",
      detectedTechnique: line.debugInfo?.detectedTechnique || "",
    });
  };

  const cancelEdit = () => {
    setEditState(null);
  };

  const saveAsGoldenStandard = useCallback(async (line: TranscriptMessage, lineIndex: number) => {
    if (!session?.sessionId) {
      toast.error("Geen sessie ID beschikbaar");
      return;
    }

    const techniqueId = line.debugInfo?.expectedTechnique || session.techniqueNumber;
    const detectedTechnique = line.debugInfo?.detectedTechnique;
    const isCorrection = detectedTechnique && detectedTechnique !== techniqueId;

    try {
      const response = await fetch('/api/v2/session/save-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          techniqueId,
          message: line.text,
          context: line.debugInfo?.context?.gathered || {},
          matchStatus: isCorrection ? 'mismatch' : 'match',
          signal: line.debugInfo?.signal || 'neutraal',
          detectedTechnique: isCorrection ? detectedTechnique : undefined
        })
      });

      if (!response.ok) throw new Error('Failed to save reference');
      
      const lineId = `${session.id}-${lineIndex}`;
      setValidatedLines(prev => new Set(prev).add(lineId));
      toast.success(isCorrection ? 'Correctie opgeslagen als Golden Standard' : 'Opgeslagen als Golden Standard');
    } catch (error) {
      console.error('[Golden Standard] Error:', error);
      toast.error('Opslaan mislukt');
    }
  }, [session]);

  const flagAsIncorrect = useCallback(async (line: TranscriptMessage, lineIndex: number, expertComment: string) => {
    if (!session?.sessionId || !expertComment.trim()) {
      toast.error("Sessie ID en feedback zijn vereist");
      return;
    }

    try {
      const response = await fetch('/api/v2/session/flag-customer-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          turnNumber: lineIndex,
          customerMessage: line.text,
          customerSignal: line.debugInfo?.signal || 'neutraal',
          currentPhase: line.debugInfo?.context?.fase || 2,
          techniqueId: line.debugInfo?.expectedTechnique || session.techniqueNumber,
          expertComment,
          context: line.debugInfo?.context?.gathered || {},
          conversationHistory: session.transcript.map(t => ({
            role: t.speaker.includes('Coach') ? 'assistant' : 'user',
            content: t.text
          }))
        })
      });

      if (!response.ok) throw new Error('Failed to flag response');
      
      const result = await response.json();
      const lineId = `${session.id}-${lineIndex}`;
      setFlaggedLines(prev => new Set(prev).add(lineId));
      setShowFeedbackInput(null);
      setFeedbackText("");
      toast.success(`Feedback opgeslagen (${result.conflictsFound || 0} conflicts)`);
    } catch (error) {
      console.error('[Golden Standard] Error:', error);
      toast.error('Feedback opslaan mislukt');
    }
  }, [session]);

  const saveEdit = useCallback(async () => {
    if (!editState || !session?.sessionId) return;

    const line = session.transcript[editState.lineIndex];
    
    if (!line) {
      cancelEdit();
      return;
    }

    const originalSignal = line.debugInfo?.signal || "neutraal";
    const originalExpected = line.debugInfo?.expectedTechnique || session.techniqueNumber;
    const originalDetected = line.debugInfo?.detectedTechnique || "";
    
    const hasChanges = 
      editState.signal !== originalSignal ||
      editState.expectedTechnique !== originalExpected ||
      editState.detectedTechnique !== originalDetected;

    if (!hasChanges) {
      toast.info('Geen wijzigingen gedetecteerd');
      cancelEdit();
      return;
    }

    try {
      // Save the reference answer
      const response = await fetch('/api/v2/session/save-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          techniqueId: editState.expectedTechnique,
          message: line.text,
          context: line.debugInfo?.context?.gathered || {},
          matchStatus: editState.detectedTechnique !== editState.expectedTechnique ? 'mismatch' : 'match',
          signal: editState.signal,
          detectedTechnique: editState.detectedTechnique || undefined
        })
      });

      if (!response.ok) throw new Error('Failed to save edit');

      // Also create a config conflict for review
      const conflictDescription = [];
      if (editState.signal !== originalSignal) {
        conflictDescription.push(`Signaal: ${originalSignal} → ${editState.signal}`);
      }
      if (editState.expectedTechnique !== originalExpected) {
        conflictDescription.push(`Verwacht: ${originalExpected} → ${editState.expectedTechnique}`);
      }
      if (editState.detectedTechnique !== originalDetected) {
        conflictDescription.push(`Gedetecteerd: ${originalDetected || "geen"} → ${editState.detectedTechnique || "geen"}`);
      }

      // Submit to config review
      await fetch('/api/v2/config/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          techniqueNumber: editState.expectedTechnique,
          type: 'Manual Correction',
          severity: 'MEDIUM',
          description: `Admin correctie transcript: ${conflictDescription.join(', ')}`,
          source: 'transcript_dialog',
          sessionId: session.sessionId,
          originalValues: {
            signal: originalSignal,
            expectedTechnique: originalExpected,
            detectedTechnique: originalDetected
          },
          correctedValues: {
            signal: editState.signal,
            expectedTechnique: editState.expectedTechnique,
            detectedTechnique: editState.detectedTechnique
          }
        })
      });
      
      setValidatedLines(prev => new Set(prev).add(editState.lineId));
      toast.success('Bewerking opgeslagen en naar Config Review gestuurd');
      cancelEdit();
    } catch (error) {
      console.error('[Golden Standard] Edit error:', error);
      toast.error('Bewerking opslaan mislukt');
    }
  }, [editState, session]);

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span>{session.userName || session.techniqueName}</span>
            <Badge variant="outline" className={`${getCodeBadgeColors(session.techniqueNumber)} text-[11px]`}>
              {session.techniqueNumber} - {session.techniqueName}
            </Badge>
            {getQualityBadge(session.quality)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Bekijk de volledige transcript en details van de sessie
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Session Info */}
          <div className="flex items-center gap-4 text-[14px] leading-[20px] text-hh-muted flex-wrap">
            {session.userName && (
              <>
                <span>{session.userName}</span>
                <span>•</span>
              </>
            )}
            {session.userWorkspace && (
              <>
                <span>{session.userWorkspace}</span>
                <span>•</span>
              </>
            )}
            <span>{session.type}</span>
            <span>•</span>
            <span>{session.date} {session.time}</span>
          </div>

          {/* Transcript */}
          <Card className="p-4 rounded-[16px] border-hh-border">
            <h3 className="text-[16px] leading-[22px] text-hh-text font-medium mb-3">
              Transcript
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {session.transcript.map((line, index) => {
                const isAICoach = line.speaker === "AI Coach" || line.speaker.includes("Coach");
                const lineId = `${session.id}-${index}`;
                
                return (
                  <div key={index} className="space-y-2">
                    <div
                      className={`flex gap-3 p-3 rounded-lg ${
                        isAICoach 
                          ? "bg-cyan-50 border border-cyan-200" 
                          : isAdmin 
                            ? "bg-fuchsia-50 border border-fuchsia-200"
                            : "bg-slate-50 border border-slate-200"
                      } ${isAdmin && validatedLines.has(lineId) ? "ring-2 ring-green-400" : ""} ${isAdmin && flaggedLines.has(lineId) ? "ring-2 ring-red-400" : ""}`}
                    >
                      <div className="flex-shrink-0">
                        <Badge
                          className={`text-[10px] font-mono ${
                            isAdmin
                              ? "bg-purple-600 text-white border-purple-600"
                              : "bg-[#4F7396] text-white border-[#4F7396]"
                          }`}
                        >
                          {line.time}
                        </Badge>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] leading-[18px] font-medium text-hh-text mb-1">
                              {line.speaker}:
                            </p>
                            <p className="text-[14px] leading-[20px] text-hh-text">
                              {line.text}
                            </p>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 ${validatedLines.has(lineId) ? "bg-green-100 text-green-700" : "hover:bg-green-100 hover:text-green-700"}`}
                                onClick={() => saveAsGoldenStandard(line, index)}
                                disabled={validatedLines.has(lineId)}
                                title="Markeer als correct (Golden Standard)"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 ${flaggedLines.has(lineId) ? "bg-red-100 text-red-700" : "hover:bg-red-100 hover:text-red-700"}`}
                                onClick={() => setShowFeedbackInput(showFeedbackInput === lineId ? null : lineId)}
                                disabled={flaggedLines.has(lineId)}
                                title="Markeer als incorrect (+ feedback)"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-purple-100 hover:text-purple-700"
                                onClick={() => startEdit(lineId, index, line)}
                                title="Bewerk debug info"
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Feedback input for flagging - admin only */}
                    {isAdmin && showFeedbackInput === lineId && (
                      <div className="ml-11 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-[12px] text-red-700 mb-2 font-medium">Wat is er mis met dit antwoord?</p>
                        <Textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Beschrijf de fout of verbeterpunt..."
                          className="text-[13px] bg-white border-red-200 focus:border-red-400 min-h-[60px]"
                        />
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => flagAsIncorrect(line, index, feedbackText)}
                            disabled={!feedbackText.trim()}
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Verstuur Feedback
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setShowFeedbackInput(null); setFeedbackText(""); }}
                          >
                            Annuleren
                          </Button>
                        </div>
                      </div>
                    )}

                    {isAdmin && (
                    <div className="ml-11">
                      <button
                        onClick={() => toggleDebug(lineId)}
                        className="flex items-center gap-2 text-[12px] leading-[16px] text-hh-muted hover:text-hh-text transition-colors"
                      >
                        {expandedDebug === lineId ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        Debug Info
                      </button>

                      {expandedDebug === lineId && (
                        <Card className="mt-2 p-4 border-2 border-dashed border-hh-ink/20 bg-hh-ui-50/30 text-slate-800">
                          <div className="space-y-3 text-[13px] leading-[18px]">
                            {/* Signaal */}
                            <div className="flex items-center gap-2">
                              <span className="text-hh-muted">Signaal:</span>
                              <Badge className={`${
                                line.debugInfo?.signal === "positief" 
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : line.debugInfo?.signal === "negatief"
                                  ? "bg-red-100 text-red-700 border-red-300"
                                  : "bg-gray-100 text-gray-700 border-gray-300"
                              }`}>
                                {line.debugInfo?.signal || "neutraal"}
                              </Badge>
                            </div>
                            
                            {/* Gedetecteerde techniek */}
                            {line.debugInfo?.detectedTechnique && (
                              <div className="flex items-center gap-2">
                                <span className="text-hh-muted">Gedetecteerde techniek:</span>
                                <span className="font-medium">{line.debugInfo.detectedTechnique}</span>
                              </div>
                            )}
                            
                            {/* Verwachte techniek */}
                            {line.debugInfo?.expectedTechnique && (
                              <div className="flex items-center gap-2">
                                <span className="text-hh-muted">Verwachte techniek:</span>
                                <span className="font-medium">{line.debugInfo.expectedTechnique}</span>
                              </div>
                            )}
                            
                            {/* Persona info */}
                            {line.debugInfo?.persona && (
                              <div className="pt-2 border-t border-hh-border">
                                <p className="text-[11px] text-hh-muted mb-2">Persona</p>
                                <div className="grid grid-cols-3 gap-2 text-[12px]">
                                  {line.debugInfo.persona.gedragsstijl && (
                                    <div>
                                      <span className="text-hh-muted">Stijl:</span>
                                      <p className="font-medium">{line.debugInfo.persona.gedragsstijl}</p>
                                    </div>
                                  )}
                                  {line.debugInfo.persona.koopklok && (
                                    <div>
                                      <span className="text-hh-muted">Koopklok:</span>
                                      <p className="font-medium">{line.debugInfo.persona.koopklok}</p>
                                    </div>
                                  )}
                                  {line.debugInfo.persona.moeilijkheid && (
                                    <div>
                                      <span className="text-hh-muted">Niveau:</span>
                                      <p className="font-medium">{line.debugInfo.persona.moeilijkheid}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Customer Dynamics */}
                            {line.debugInfo?.customerDynamics && (
                              <div className="pt-2 border-t border-hh-border">
                                <p className="text-[11px] text-hh-muted mb-2">Klant Dynamiek</p>
                                <div className="grid grid-cols-3 gap-2 text-[12px]">
                                  <div>
                                    <span className="text-hh-muted">Rapport:</span>
                                    <p className="font-medium">{line.debugInfo.customerDynamics.rapport ?? "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-hh-muted">Waarde:</span>
                                    <p className="font-medium">{line.debugInfo.customerDynamics.valueTension ?? "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-hh-muted">Commit:</span>
                                    <p className="font-medium">{line.debugInfo.customerDynamics.commitReadiness ?? "-"}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* AI Decision */}
                            {line.debugInfo?.aiDecision && (
                              <div className="pt-2 border-t border-hh-border">
                                <p className="text-[11px] text-hh-muted mb-2">AI Beslissing</p>
                                <div className="flex items-center gap-4 text-[12px]">
                                  {line.debugInfo.aiDecision.epicFase && (
                                    <div>
                                      <span className="text-hh-muted">E.P.I.C. TECHNIQUE Fase:</span>
                                      <span className="font-medium ml-1">{line.debugInfo.aiDecision.epicFase}</span>
                                    </div>
                                  )}
                                  {line.debugInfo.aiDecision.evaluatie && (
                                    <div>
                                      <span className="text-hh-muted">Evaluatie:</span>
                                      <Badge className={`ml-1 text-[10px] ${
                                        line.debugInfo.aiDecision.evaluatie === "positief" || line.debugInfo.aiDecision.evaluatie === "perfect"
                                          ? "bg-green-100 text-green-700 border-green-300"
                                          : line.debugInfo.aiDecision.evaluatie === "gemist"
                                          ? "bg-red-100 text-red-700 border-red-300"
                                          : "bg-gray-100 text-gray-700 border-gray-300"
                                      }`}>
                                        {line.debugInfo.aiDecision.evaluatie}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Geen debug data */}
                            {!line.debugInfo && (
                              <p className="text-hh-muted italic">Geen debug data beschikbaar</p>
                            )}
                            
                            {/* Bewerken Button - visible in debug panel for admin */}
                            {isAdmin && editState?.lineId !== lineId && (
                              <div className="pt-3 mt-3 border-t border-hh-border">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400"
                                  onClick={() => startEdit(lineId, index, line)}
                                >
                                  <Pencil className="w-3 h-3 mr-2" />
                                  Bewerken
                                </Button>
                              </div>
                            )}
                            
                            {/* Edit Mode */}
                            {isAdmin && editState?.lineId === lineId && (
                              <div className="pt-3 mt-3 border-t-2 border-purple-300">
                                <p className="text-[11px] text-purple-700 mb-3 font-semibold">Bewerk Debug Info</p>
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-[11px] text-hh-muted block mb-1">Signaal</label>
                                    <Select
                                      value={editState.signal}
                                      onValueChange={(value: "positief" | "neutraal" | "negatief") => 
                                        setEditState({...editState, signal: value})
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-[12px] bg-white border-slate-300 text-slate-800 cursor-pointer hover:border-purple-400">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white border-slate-300">
                                        <SelectItem value="positief" className="cursor-pointer">Positief</SelectItem>
                                        <SelectItem value="neutraal" className="cursor-pointer">Neutraal</SelectItem>
                                        <SelectItem value="negatief" className="cursor-pointer">Negatief</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div>
                                    <label className="text-[11px] text-hh-muted block mb-1">Verwachte Techniek (Correct)</label>
                                    <Select
                                      value={editState.expectedTechnique}
                                      onValueChange={(value: string) => setEditState({...editState, expectedTechnique: value})}
                                    >
                                      <SelectTrigger className="h-8 text-[12px] bg-white border-slate-300 text-slate-800 cursor-pointer hover:border-purple-400">
                                        <SelectValue placeholder="Selecteer techniek" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white border-slate-300 max-h-[300px]">
                                        {allTechnieken.map((tech) => (
                                          <SelectItem key={tech.nummer} value={tech.nummer} className="cursor-pointer">
                                            {tech.nummer} - {tech.naam}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div>
                                    <label className="text-[11px] text-hh-muted block mb-1">AI Gedetecteerde Techniek (optioneel)</label>
                                    <Select
                                      value={editState.detectedTechnique || "none"}
                                      onValueChange={(value: string) => setEditState({...editState, detectedTechnique: value === "none" ? "" : value})}
                                    >
                                      <SelectTrigger className="h-8 text-[12px] bg-white border-slate-300 text-slate-800 cursor-pointer hover:border-purple-400">
                                        <SelectValue placeholder="Geen / Onbekend" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white border-slate-300 max-h-[300px]">
                                        <SelectItem value="none" className="cursor-pointer">Geen / Onbekend</SelectItem>
                                        {allTechnieken.map((tech) => (
                                          <SelectItem key={tech.nummer} value={tech.nummer} className="cursor-pointer">
                                            {tech.nummer} - {tech.naam}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      size="sm"
                                      className="bg-purple-600 hover:bg-purple-700 text-white"
                                      onClick={saveEdit}
                                    >
                                      <Check className="w-3 h-3 mr-1" />
                                      Opslaan
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={cancelEdit}
                                    >
                                      Annuleren
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* AI Feedback */}
          <Card className="p-4 rounded-[16px] border-hh-border bg-hh-ui-50/50">
            <h3 className="text-[16px] leading-[22px] text-hh-text font-medium mb-3">
              AI Feedback
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-[13px] font-medium text-hh-success mb-2">Sterke punten</h4>
                <ul className="space-y-1">
                  {(session.strengths || ["Goede opening", "Sterke feitgerichte vragen"]).map((strength, idx) => (
                    <li key={idx} className="text-[13px] text-hh-text flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-hh-success flex-shrink-0 mt-0.5" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[13px] font-medium text-hh-warning mb-2">Verbeterpunten</h4>
                <ul className="space-y-1">
                  {(session.improvements || ["Meer doorvragen na antwoord", "Pauzes inbouwen"]).map((improvement, idx) => (
                    <li key={idx} className="text-[13px] text-hh-text flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-hh-warning flex-shrink-0 mt-0.5" />
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
