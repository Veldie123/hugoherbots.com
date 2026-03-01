import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Check, X } from "lucide-react";

interface DebugData {
  // Voor AI Coach berichten (Customer/Klant)
  customerSignal?: "positief" | "neutraal" | "negatief";
  expectedTechnique?: string;
  persona?: {
    gedragsstijl: string;
    koopklok: string;
    moeilijkheid: string;
  };
  context?: {
    fase: number;
  };
  customerDynamics?: {
    rapport: string;
    valueTension: string;
    commitReadiness: string;
  };
  aiDecisions?: {
    epicFase: string;
    evaluatie: string;
  };
  
  // Voor Verkoper berichten
  sellerSignal?: "positief" | "neutraal" | "negatief";
  expectedTechniqueForSeller?: string;
  detectedTechnique?: string;
  score?: number;
}

interface SessionDebugPanelProps {
  lineIndex: number;
  speaker: string;
  debugData: DebugData;
  onValidate?: (lineIndex: number, isValid: boolean, feedback?: string) => void;
}

export function SessionDebugPanel({ lineIndex, speaker, debugData, onValidate }: SessionDebugPanelProps) {
  const [validation, setValidation] = useState<boolean | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  
  const isCoach = speaker === "AI Coach" || speaker.includes("Coach");
  
  const handleValidate = (isValid: boolean) => {
    setValidation(isValid);
    if (isValid) {
      setShowFeedbackInput(false);
      setFeedbackText("");
      onValidate?.(lineIndex, true);
    } else {
      setShowFeedbackInput(true);
    }
  };
  
  const handleSubmitFeedback = () => {
    if (feedbackText.trim()) {
      onValidate?.(lineIndex, false, feedbackText);
      setShowFeedbackInput(false);
      setFeedbackText("");
    }
  };

  if (isCoach) {
    // Debug info voor AI Coach (klant) berichten
    return (
      <Card className="mt-2 p-3 bg-slate-50 border-slate-200 text-[12px] leading-[16px] space-y-2">
        {debugData.customerSignal && (
          <div>
            <span className="font-medium text-slate-700">Klant Signaal:</span>{" "}
            <Badge
              className={`ml-1 ${
                debugData.customerSignal === "positief"
                  ? "bg-green-100 text-green-700"
                  : debugData.customerSignal === "negatief"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {debugData.customerSignal}
            </Badge>
          </div>
        )}

        {debugData.expectedTechnique && (
          <div>
            <span className="font-medium text-slate-700">Verwachte techniek:</span>{" "}
            <span className="text-slate-600">{debugData.expectedTechnique}</span>
          </div>
        )}

        {debugData.persona && (
          <div className="pt-2 border-t border-slate-200">
            <p className="font-medium text-slate-700 mb-1">Persona</p>
            <div className="pl-2 space-y-1 text-slate-600">
              <div>
                <span className="font-medium">Gedragsstijl:</span> {debugData.persona.gedragsstijl}
              </div>
              <div>
                <span className="font-medium">Koopklok:</span> {debugData.persona.koopklok}
              </div>
              <div>
                <span className="font-medium">Moeilijkheid:</span> {debugData.persona.moeilijkheid}
              </div>
            </div>
          </div>
        )}

        {debugData.context && (
          <div className="pt-2 border-t border-slate-200">
            <p className="font-medium text-slate-700 mb-1">Context</p>
            <div className="pl-2 text-slate-600">
              <div>
                <span className="font-medium">Fase:</span> {debugData.context.fase}
              </div>
            </div>
          </div>
        )}

        {debugData.customerDynamics && (
          <div className="pt-2 border-t border-slate-200">
            <p className="font-medium text-slate-700 mb-1">Customer Dynamics</p>
            <div className="pl-2 space-y-1 text-slate-600">
              <div>
                <span className="font-medium">Rapport:</span> {debugData.customerDynamics.rapport}
              </div>
              <div>
                <span className="font-medium">Value Tension:</span> {debugData.customerDynamics.valueTension}
              </div>
              <div>
                <span className="font-medium">Commit Readiness:</span> {debugData.customerDynamics.commitReadiness}
              </div>
            </div>
          </div>
        )}

        {debugData.aiDecisions && (
          <div className="pt-2 border-t border-slate-200">
            <p className="font-medium text-slate-700 mb-1">AI Beslissingen</p>
            <div className="pl-2 space-y-1 text-slate-600">
              <div>
                <span className="font-medium">E.P.I.C. TECHNIQUE Fase:</span> {debugData.aiDecisions.epicFase}
              </div>
              <div>
                <span className="font-medium">Evaluatie:</span> {debugData.aiDecisions.evaluatie}
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  } else {
    // Debug info voor Verkoper berichten
    return (
      <Card className="mt-2 p-3 bg-blue-50 border-blue-200 text-[12px] leading-[16px] space-y-2">
        {debugData.sellerSignal && (
          <div>
            <span className="font-medium text-blue-700">Signaal:</span>{" "}
            <Badge
              className={`ml-1 ${
                debugData.sellerSignal === "positief"
                  ? "bg-green-100 text-green-700"
                  : debugData.sellerSignal === "negatief"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {debugData.sellerSignal}
            </Badge>
          </div>
        )}

        {debugData.expectedTechniqueForSeller && (
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-blue-700">Verwachte techniek:</span>{" "}
              <span className="text-blue-600">{debugData.expectedTechniqueForSeller}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className={`h-6 w-6 ${
                  validation === true ? "bg-green-500 text-white hover:bg-green-600" : ""
                }`}
                onClick={() => handleValidate(true)}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={`h-6 w-6 ${
                  validation === false ? "bg-red-500 text-white hover:bg-red-600" : ""
                }`}
                onClick={() => handleValidate(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {debugData.detectedTechnique && (
          <div>
            <span className="font-medium text-blue-700">Gedetecteerde techniek:</span>{" "}
            <span className="text-blue-600">{debugData.detectedTechnique}</span>
            {debugData.score !== undefined && (
              <span className="ml-2 text-green-600 font-medium">(+{debugData.score})</span>
            )}
          </div>
        )}

        {showFeedbackInput && (
          <div className="pt-2 border-t border-blue-200 space-y-2">
            <Input
              placeholder="Geef feedback over waarom dit niet juist is..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="text-[12px] h-8"
            />
            <Button
              size="sm"
              className="w-full h-7 text-[11px] bg-red-600 hover:bg-red-700"
              onClick={handleSubmitFeedback}
            >
              Submit Feedback
            </Button>
          </div>
        )}
      </Card>
    );
  }
}
