import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Logo } from "./Logo";
import { ArrowRight, ArrowLeft, Check, Mic, AlertCircle, Target, Radio, Video, MessageSquare, TrendingUp, Clock } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

type OnboardingStep = 1 | 2 | 3 | 4;

interface OnboardingProps {
  navigate?: (page: string) => void;
}

export function Onboarding({ navigate }: OnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>(1);
  
  console.log('🎯 Onboarding component rendered, step:', step);
  
  // Step 1: Sales profiel
  const [salesType, setSalesType] = useState(""); // B2B of B2C
  const [experience, setExperience] = useState("");
  const [role, setRole] = useState("");
  const [sector, setSector] = useState("");
  
  // Step 2: Focus areas (wat willen ze verbeteren) + duur
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [sessionDuration, setSessionDuration] = useState("");
  
  // Step 3: Primaire doel (waarom zijn ze hier)
  const [primaryGoal, setPrimaryGoal] = useState("");
  
  // Step 4: Mic permission
  const [micPermission, setMicPermission] = useState<
    "pending" | "granted" | "denied"
  >("pending");

  const toggleFocusArea = (area: string) => {
    if (focusAreas.includes(area)) {
      setFocusAreas(focusAreas.filter((a) => a !== area));
    } else {
      // Maximum 2 selecties
      if (focusAreas.length < 2) {
        setFocusAreas([...focusAreas, area]);
      }
    }
  };

  const requestMicPermission = async () => {
    try {
      console.log("🎤 Vraag microfoon toegang aan...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log("✅ Microfoon toegang verkregen");
      setMicPermission("granted");
      
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error: any) {
      console.warn("⚠️ Microfoon toegang geweigerd door gebruiker");
      console.log("Details:", error.name, "-", error.message);
      
      setMicPermission("denied");
    }
  };

  useEffect(() => {
    if (step === 4) {
      setMicPermission("pending");
      console.log("🎤 Stap 4 bereikt - wacht op gebruiker actie voor microfoon");
    }
  }, [step]);

  const handleFinish = () => {
    if (!navigate) return;
    
    // Navigate based on primary goal
    switch (primaryGoal) {
      case "live-training":
        navigate("live");
        break;
      case "video-course":
        navigate("videos");
        break;
      case "conversation-analysis":
        navigate("analytics");
        break;
      case "ai-roleplay":
        navigate("roleplay");
        break;
      default:
        navigate("dashboard");
    }
  };

  const progress = (step / 4) * 100;

  return (
    <div className="min-h-screen bg-hh-bg flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <Logo variant="vertical" className="text-hh-ink" />
          </div>
          <p className="text-[16px] leading-[24px] text-hh-muted">
            Laten we de app afstemmen op jouw doelen
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] leading-[20px] text-hh-muted">
              Stap {step} van 4
            </span>
            <span className="text-[14px] leading-[20px] font-medium text-hh-text">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step 1: Sales profiel */}
        {step === 1 && (
          <Card className="p-8 rounded-[16px] shadow-hh-lg border-hh-border">
            <div className="space-y-6">
              <div>
                <h2 className="text-[24px] leading-[32px] mb-2">
                  Jouw salesprofiel
                </h2>
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  Vertel iets over je ervaring, zodat Hugo je trainingen kan afstemmen
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="salesType">Sales type</Label>
                  <Select value={salesType} onValueChange={setSalesType}>
                    <SelectTrigger id="salesType" className="bg-hh-ui-50">
                      <SelectValue placeholder="Kies je sales type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="b2b">B2B</SelectItem>
                      <SelectItem value="b2c">B2C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience">Ervaring in sales</Label>
                  <Select value={experience} onValueChange={setExperience}>
                    <SelectTrigger id="experience" className="bg-hh-ui-50">
                      <SelectValue placeholder="Kies je ervaringsniveau" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner (0-2 jaar)</SelectItem>
                      <SelectItem value="intermediate">Gevorderd (2-5 jaar)</SelectItem>
                      <SelectItem value="expert">Expert (5+ jaar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Huidige rol</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="role" className="bg-hh-ui-50">
                      <SelectValue placeholder="Kies je rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sdr">SDR / BDR</SelectItem>
                      <SelectItem value="ae">Account Executive</SelectItem>
                      <SelectItem value="manager">Sales Manager</SelectItem>
                      <SelectItem value="bd">Business Developer</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="other">Anders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">Sector</Label>
                  <Select value={sector} onValueChange={setSector}>
                    <SelectTrigger id="sector" className="bg-hh-ui-50">
                      <SelectValue placeholder="Kies je sector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saas">SaaS</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="real-estate">Real Estate</SelectItem>
                      <SelectItem value="other">Anders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ink"
                  onClick={() => setStep(2)}
                  disabled={!experience || !role || !sector}
                  className="gap-2"
                >
                  Volgende <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Focus areas */}
        {step === 2 && (
          <Card className="p-8 rounded-[16px] shadow-hh-lg border-hh-border">
            <div className="space-y-6">
              <div>
                <h2 className="text-[24px] leading-[32px] mb-2">
                  Wat wil je verbeteren?
                </h2>
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  Selecteer 1-2 focusgebieden waar je mee wilt starten
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "opening", label: "Opening & eerste contact", desc: "Gesprekken starten en aandacht krijgen", icon: Target },
                  { id: "discovery", label: "Discovery & luisteren", desc: "De juiste vragen stellen en behoeften ontdekken", icon: MessageSquare },
                  { id: "value", label: "Waarde presenteren", desc: "Oplossingen pitchen en impact tonen", icon: TrendingUp },
                  { id: "objections", label: "Bezwaren hanteren", desc: "Weerstand ombuigen en doorpakken", icon: AlertCircle },
                  { id: "closing", label: "Closing & commitment", desc: "De deal binnenhalen en de knoop doorhakken", icon: Check },
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = focusAreas.includes(option.id);
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggleFocusArea(option.id)}
                      className={`p-4 rounded-[12px] border-2 transition-all text-left ${
                        isSelected
                          ? "border-hh-primary bg-hh-primary/5"
                          : "border-hh-border hover:border-hh-ui-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? "bg-hh-primary/10" : "bg-hh-ui-100"}`}>
                          <Icon className={`w-5 h-5 ${isSelected ? "text-hh-primary" : "text-hh-muted"}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-[16px] leading-[24px] font-medium text-hh-text">
                              {option.label}
                            </h3>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-hh-primary flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-[14px] leading-[20px] text-hh-muted">
                            {option.desc}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Session duration */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="duration">Hoe lang wil je gemiddeld oefenen?</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "short", label: "5-10 min", desc: "Snel & gefocust" },
                    { id: "medium", label: "10-15 min", desc: "Standaard" },
                    { id: "long", label: "15-20+ min", desc: "Diepe training" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSessionDuration(option.id)}
                      className={`p-3 rounded-[12px] border-2 transition-all text-center ${
                        sessionDuration === option.id
                          ? "border-hh-primary bg-hh-primary/5"
                          : "border-hh-border hover:border-hh-ui-300"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Clock className={`w-4 h-4 ${sessionDuration === option.id ? "text-hh-primary" : "text-hh-muted"}`} />
                        <p className="text-[14px] leading-[20px] font-medium text-hh-text">
                          {option.label}
                        </p>
                      </div>
                      <p className="text-[12px] leading-[18px] text-hh-muted">
                        {option.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Terug
                </Button>
                <Button
                  variant="ink"
                  onClick={() => setStep(3)}
                  disabled={focusAreas.length === 0 || !sessionDuration}
                  className="gap-2"
                >
                  Volgende <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Primaire doel (Waarom ben je hier?) */}
        {step === 3 && (
          <Card className="p-8 rounded-[16px] shadow-hh-lg border-hh-border">
            <div className="space-y-6">
              <div>
                <h2 className="text-[24px] leading-[32px] mb-2">
                  Waarom ben je hier?
                </h2>
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  Kies wat je vooral wilt gebruiken — we sturen je daarna direct naar de juiste plek
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "ai-roleplay", label: "AI roleplay oefeningen", desc: "Oefen 24/7 met Hugo's AI avatar en krijg directe feedback", icon: Target },
                  { id: "live-training", label: "Live training sessies", desc: "Join dagelijkse live sessies met Hugo en stel je vragen", icon: Radio },
                  { id: "video-course", label: "Video cursus", desc: "Leer de 25 technieken in je eigen tempo via video's", icon: Video },
                  { id: "conversation-analysis", label: "Gespreksanalyse", desc: "Bekijk je voortgang en analyseer je prestaties", icon: MessageSquare },
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = primaryGoal === option.id;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => setPrimaryGoal(option.id)}
                      className={`p-4 rounded-[12px] border-2 transition-all text-left ${
                        isSelected
                          ? "border-hh-primary bg-hh-primary/5"
                          : "border-hh-border hover:border-hh-ui-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? "bg-hh-primary/10" : "bg-hh-ui-100"}`}>
                          <Icon className={`w-5 h-5 ${isSelected ? "text-hh-primary" : "text-hh-muted"}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-[16px] leading-[24px] font-medium text-hh-text">
                              {option.label}
                            </h3>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-hh-primary flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-[14px] leading-[20px] text-hh-muted">
                            {option.desc}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Terug
                </Button>
                <Button
                  variant="ink"
                  onClick={() => setStep(4)}
                  disabled={!primaryGoal}
                  className="gap-2"
                >
                  Volgende <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Confirmation & Mic Permission */}
        {step === 4 && (
          <Card className="p-8 rounded-[16px] shadow-hh-lg border-hh-border">
            <div className="space-y-6">
              <div>
                <h2 className="text-[24px] leading-[32px] mb-2">
                  Je bent klaar om te starten!
                </h2>
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  {primaryGoal === "ai-roleplay" 
                    ? "Voor AI roleplay hebben we je microfoon nodig"
                    : "Geef toegang tot je microfoon als je later wilt oefenen met AI roleplay"
                  }
                </p>
              </div>

              {/* Summary */}
              <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border bg-hh-ui-50">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] leading-[20px] text-hh-muted">
                      Ervaring
                    </span>
                    <span className="text-[14px] leading-[20px] text-hh-text capitalize">
                      {experience === "beginner" ? "Beginner" : experience === "intermediate" ? "Gevorderd" : "Expert"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] leading-[20px] text-hh-muted">
                      Sector
                    </span>
                    <span className="text-[14px] leading-[20px] text-hh-text capitalize">
                      {sector}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] leading-[20px] text-hh-muted">
                      Focus
                    </span>
                    <span className="text-[14px] leading-[20px] text-hh-text capitalize">
                      {focusAreas.join(", ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] leading-[20px] text-hh-muted">
                      Primair doel
                    </span>
                    <span className="text-[14px] leading-[20px] text-hh-text">
                      {primaryGoal === "ai-roleplay" ? "AI roleplay" : 
                       primaryGoal === "live-training" ? "Live training" :
                       primaryGoal === "video-course" ? "Video cursus" : "Analyse"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Microphone permission */}
              {micPermission === "pending" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-[12px] border-2 border-dashed border-hh-border text-center">
                    <Mic className="w-12 h-12 text-hh-muted mx-auto mb-3" />
                    <p className="text-[16px] leading-[24px] text-hh-text mb-2">
                      Microfoon toegang
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted mb-4">
                      Voor AI roleplay oefeningen heeft Hugo toegang nodig tot je microfoon
                    </p>
                    <Button variant="ink" onClick={requestMicPermission} className="gap-2">
                      <Mic className="w-4 h-4" /> Activeer microfoon
                    </Button>
                  </div>
                </div>
              )}

              {micPermission === "granted" && (
                <Alert className="bg-hh-success/10 border-hh-success/20">
                  <Check className="w-4 h-4 text-hh-success" />
                  <AlertDescription className="text-hh-text">
                    Perfect! Microfoon werkt. Je kunt nu starten.
                  </AlertDescription>
                </Alert>
              )}

              {micPermission === "denied" && (
                <div className="space-y-3">
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="space-y-2">
                      <p className="font-medium">Microfoon geblokkeerd</p>
                      <p className="text-sm">
                        Je kunt de app gebruiken, maar AI roleplay werkt niet zonder microfoon toegang.
                      </p>
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={requestMicPermission} 
                      className="gap-2 flex-1"
                    >
                      <Mic className="w-4 h-4" /> Probeer opnieuw
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Terug
                </Button>
                <Button
                  variant="ink"
                  onClick={handleFinish}
                  disabled={primaryGoal === "ai-roleplay" && micPermission !== "granted"}
                  className="gap-2"
                >
                  Start met Hugo <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Skip option */}
        {step < 4 && (
          <div className="text-center mt-6">
            <Button variant="ghost" size="sm" onClick={() => navigate && navigate("dashboard")}>
              Overslaan en direct naar dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}