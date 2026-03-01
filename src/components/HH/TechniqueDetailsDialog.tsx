import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Target, X, Pencil, ListOrdered, Quote, FileText, HelpCircle, Clock, Wrench } from "lucide-react";
import { getCodeBadgeColors, PHASE_COLORS } from "../../utils/phaseColors";

const PHASE_LABELS: Record<string, string> = {
  '0': 'Pre-contactfase',
  '1': 'Openingsfase',
  '2': 'Ontdekkingsfase',
  '3': 'Aanbevelingsfase',
  '4': 'Beslissingsfase',
};

interface TechniqueDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technique: {
    id?: string;
    nummer: string;
    naam: string;
    fase: string;
    tags?: string[];
    doel?: string;
    hoe?: string;
    wat?: string;
    waarom?: string;
    wanneer?: string;
    verkoper_intentie?: string[];
    context_requirements?: string[];
    stappenplan?: string[];
    voorbeeld?: string[];
  } | null;
  onSave?: (updatedTechnique: any) => void;
  isEditable?: boolean;
  isAdmin?: boolean;
  onStartPractice?: (techniqueNumber: string, techniqueName: string) => void;
}

export function TechniqueDetailsDialog({
  open,
  onOpenChange,
  technique,
  onSave,
  isEditable = false,
  isAdmin = false,
}: TechniqueDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);

  useEffect(() => {
    if (technique && isEditing && !editedData) {
      setEditedData({
        naam: technique.naam,
        fase: technique.fase,
        tags: technique.tags || [],
        doel: technique.doel || "",
        hoe: technique.hoe || "",
        wat: technique.wat || "",
        waarom: technique.waarom || "",
        wanneer: technique.wanneer || "",
        verkoper_intentie: technique.verkoper_intentie || [],
        context_requirements: technique.context_requirements || [],
        stappenplan: technique.stappenplan || [],
      });
    }
  }, [technique, isEditing, editedData]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedData({
      naam: technique?.naam || "",
      fase: technique?.fase || "",
      tags: technique?.tags || [],
      doel: technique?.doel || "",
      hoe: technique?.hoe || "",
      wat: technique?.wat || "",
      waarom: technique?.waarom || "",
      wanneer: technique?.wanneer || "",
      verkoper_intentie: technique?.verkoper_intentie || [],
      context_requirements: technique?.context_requirements || [],
      stappenplan: technique?.stappenplan || [],
    });
  };

  const handleSave = () => {
    if (onSave && technique && editedData) {
      onSave({
        ...technique,
        ...editedData,
      });
    }
    setIsEditing(false);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedData(null);
  };

  const handleAddTag = (tag: string) => {
    if (editedData && !editedData.tags.includes(tag)) {
      setEditedData({
        ...editedData,
        tags: [...editedData.tags, tag],
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (editedData) {
      setEditedData({
        ...editedData,
        tags: editedData.tags.filter((tag: string) => tag !== tagToRemove),
      });
    }
  };

  if (!technique) return null;

  const displayData = isEditing ? editedData : technique;
  const codeBadgeColors = getCodeBadgeColors(technique.nummer);
  const phaseColor = PHASE_COLORS[String(technique.fase)] || "#64748b";

  const cardBg = isAdmin ? "bg-purple-500/[0.07]" : "bg-[#4F7396]/[0.06]";
  const cardBorder = isAdmin ? "border-purple-500/15" : "border-[#4F7396]/15";
  const iconColor = isAdmin ? "text-purple-600" : "text-[#4F7396]";
  const headerColor = isAdmin ? "text-purple-600" : "text-[#4F7396]";
  const bodyColor = isAdmin ? "text-purple-800" : "text-hh-text";
  const stepCircleBg = isAdmin ? "bg-purple-600" : "bg-[#4F7396]";
  const accentBtnBg = isAdmin ? "bg-purple-600 hover:bg-purple-700" : "bg-[#4F7396] hover:bg-[#3d6280]";

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  const SectionCard = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className={`${cardBg} ${cardBorder} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h4 className={`text-[13px] font-semibold uppercase tracking-wide ${headerColor}`}>{title}</h4>
      </div>
      {children}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="p-0 overflow-hidden"
        style={isDesktop ? { width: 'calc(60px + (100vw - 60px) / 3)', maxWidth: 'none' } : { width: '100%' }}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            <div
              className="p-6 pb-5"
              style={{
                background: `linear-gradient(135deg, ${phaseColor}12 0%, ${phaseColor}06 100%)`,
                borderBottom: `1px solid ${phaseColor}20`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0 border"
                  style={{
                    backgroundColor: `${phaseColor}18`,
                    color: phaseColor,
                    borderColor: `${phaseColor}30`,
                  }}
                >
                  {technique.nummer}
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: phaseColor }}
                  >
                    Fase {displayData.fase}
                  </span>
                  <span className="text-[12px] text-hh-muted">
                    {PHASE_LABELS[String(displayData.fase)] || ''}
                  </span>
                </div>
              </div>
              
              {isEditing ? (
                <Input
                  value={displayData.naam}
                  onChange={(e) =>
                    setEditedData({ ...editedData, naam: e.target.value })
                  }
                  className="text-[24px] font-bold mt-2"
                  placeholder="Techniek naam"
                />
              ) : (
                <h2 className="text-[24px] leading-[30px] font-bold text-hh-ink mt-1">
                  {displayData.naam}
                </h2>
              )}

              {displayData.tags && displayData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {displayData.tags?.map((tag: string, index: number) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                        isAdmin
                          ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                          : 'bg-[#4F7396]/10 text-[#4F7396] border-[#4F7396]/20'
                      }`}
                    >
                      {tag}
                      {isEditing && (
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1.5 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                  {isEditing && (
                    <Input
                      placeholder="Nieuwe tag..."
                      className="w-32 h-7 text-[12px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value) {
                          handleAddTag(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-5 space-y-3">
              {displayData.doel && (
                <SectionCard icon={Target} title="Doel">
                  {isEditing ? (
                    <Textarea
                      value={displayData.doel}
                      onChange={(e) =>
                        setEditedData({ ...editedData, doel: e.target.value })
                      }
                      placeholder="Beschrijf het doel..."
                      rows={3}
                      className="text-[14px]"
                    />
                  ) : (
                    <p className={`text-[14px] leading-[22px] ${bodyColor}`}>
                      {displayData.doel}
                    </p>
                  )}
                </SectionCard>
              )}

              {displayData.wat && (
                <SectionCard icon={FileText} title="Wat">
                  {isEditing ? (
                    <Textarea
                      value={displayData.wat}
                      onChange={(e) =>
                        setEditedData({ ...editedData, wat: e.target.value })
                      }
                      placeholder="Wat houdt dit in..."
                      rows={2}
                      className="text-[14px]"
                    />
                  ) : (
                    <p className={`text-[14px] leading-[22px] ${bodyColor}`}>
                      {displayData.wat}
                    </p>
                  )}
                </SectionCard>
              )}

              {displayData.waarom && (
                <SectionCard icon={HelpCircle} title="Waarom">
                  {isEditing ? (
                    <Textarea
                      value={displayData.waarom}
                      onChange={(e) =>
                        setEditedData({ ...editedData, waarom: e.target.value })
                      }
                      placeholder="Waarom is dit belangrijk..."
                      rows={2}
                      className="text-[14px]"
                    />
                  ) : (
                    <p className={`text-[14px] leading-[22px] ${bodyColor}`}>
                      {displayData.waarom}
                    </p>
                  )}
                </SectionCard>
              )}

              {displayData.wanneer && (
                <SectionCard icon={Clock} title="Wanneer">
                  {isEditing ? (
                    <Textarea
                      value={displayData.wanneer}
                      onChange={(e) =>
                        setEditedData({ ...editedData, wanneer: e.target.value })
                      }
                      placeholder="Wanneer pas je dit toe..."
                      rows={2}
                      className="text-[14px]"
                    />
                  ) : (
                    <p className={`text-[14px] leading-[22px] ${bodyColor}`}>
                      {displayData.wanneer}
                    </p>
                  )}
                </SectionCard>
              )}

              {displayData.hoe && (
                <SectionCard icon={Wrench} title="Hoe">
                  {isEditing ? (
                    <Textarea
                      value={displayData.hoe}
                      onChange={(e) =>
                        setEditedData({ ...editedData, hoe: e.target.value })
                      }
                      placeholder="Beschrijf hoe..."
                      rows={4}
                      className="text-[14px]"
                    />
                  ) : (
                    <p className={`text-[14px] leading-[22px] ${bodyColor}`}>
                      {displayData.hoe}
                    </p>
                  )}
                </SectionCard>
              )}

              {displayData.stappenplan && displayData.stappenplan.length > 0 && (
                <SectionCard icon={ListOrdered} title="Stappenplan">
                  <ol className="space-y-2.5">
                    {(Array.isArray(displayData.stappenplan) ? displayData.stappenplan : [displayData.stappenplan]).map((stap: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${stepCircleBg} text-white`}>
                          {idx + 1}
                        </span>
                        <span className={`text-[14px] leading-[22px] ${bodyColor}`}>{stap}</span>
                      </li>
                    ))}
                  </ol>
                </SectionCard>
              )}

              {displayData.voorbeeld && (Array.isArray(displayData.voorbeeld) ? displayData.voorbeeld.length > 0 : true) && (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Quote className={`w-4 h-4 ${iconColor}`} />
                    <h4 className={`text-[13px] font-semibold uppercase tracking-wide ${headerColor}`}>Voorbeelden</h4>
                  </div>
                  <div className="space-y-2">
                    {(Array.isArray(displayData.voorbeeld) ? displayData.voorbeeld : [displayData.voorbeeld]).map((vb: string, idx: number) => (
                      <div
                        key={idx}
                        className={`${cardBg} ${cardBorder} border rounded-xl p-4`}
                      >
                        <p className={`text-[14px] leading-[22px] italic ${bodyColor}`}>
                          &ldquo;{vb}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 pt-4 border-t border-hh-border/50 flex flex-row justify-end gap-3">
            {isEditing ? (
              <>
                <Button
                  className={`${accentBtnBg} px-6`}
                  onClick={handleSave}
                >
                  Opslaan
                </Button>
                <Button variant="outline" onClick={handleCancel} className="px-6">
                  Annuleren
                </Button>
              </>
            ) : (
              <>
                {isEditable && (
                  <Button
                    className={`${accentBtnBg} px-6 gap-2`}
                    onClick={handleEdit}
                  >
                    <Pencil className="w-4 h-4" />
                    Bewerken
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="px-6"
                >
                  Sluiten
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
