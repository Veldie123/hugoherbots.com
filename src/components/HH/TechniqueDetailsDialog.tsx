import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Target, X, Pencil, Quote, FileText, HelpCircle, Clock, Wrench, Presentation } from "lucide-react";
import { PHASE_COLORS } from "../../utils/phaseColors";
import { getEpicSlides, type EpicSlide } from "../../data/epic-slides-service";

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

  if (!technique || !technique.nummer) return null;

  const displayData = isEditing ? editedData : technique;
  const phaseColor = PHASE_COLORS[String(technique.fase)] || "#64748b";

  const accentBtnBg = isAdmin ? "bg-purple-600 hover:bg-purple-700" : "bg-[#4F7396] hover:bg-[#3d6280]";

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  const matchingSlides = getEpicSlides().filter(
    (slide) => slide.techniqueIds?.includes(technique.nummer)
  );

  const VISUAL_TYPE_LABELS: Record<string, string> = {
    quote: "Quote",
    diagram: "Diagram",
    matrix: "Matrix",
    lijst: "Lijst",
  };

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
                background: `linear-gradient(135deg, ${phaseColor}18 0%, ${phaseColor}08 100%)`,
                borderBottom: `2px solid ${phaseColor}25`,
              }}
            >
              <div className="flex items-center gap-3.5 mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 border"
                  style={{
                    backgroundColor: `${phaseColor}20`,
                    color: phaseColor,
                    borderColor: `${phaseColor}35`,
                  }}
                >
                  {technique.nummer}
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest"
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
                <h2 className="text-[22px] leading-[28px] font-bold text-hh-ink mt-1">
                  {displayData.naam}
                </h2>
              )}

              {displayData.tags && displayData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {displayData.tags?.map((tag: string, index: number) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${phaseColor}12`,
                        color: phaseColor,
                        borderColor: `${phaseColor}30`,
                      }}
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

            <div className="px-5 py-5 space-y-5">

              {displayData.doel && (
                <div
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: `${phaseColor}0A`,
                    borderLeft: `4px solid ${phaseColor}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" style={{ color: phaseColor }} />
                    <h4 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: phaseColor }}>Doel</h4>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={displayData.doel}
                      onChange={(e) =>
                        setEditedData({ ...editedData, doel: e.target.value })
                      }
                      placeholder="Beschrijf het doel..."
                      rows={3}
                      className="text-[15px]"
                    />
                  ) : (
                    <p className="text-[15px] leading-[24px] text-hh-ink font-medium">
                      {displayData.doel}
                    </p>
                  )}
                </div>
              )}

              {(displayData.wat || displayData.wanneer || displayData.hoe) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayData.wat && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" style={{ color: phaseColor }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: phaseColor }}>Wat</span>
                      </div>
                      {isEditing ? (
                        <Textarea
                          value={displayData.wat}
                          onChange={(e) =>
                            setEditedData({ ...editedData, wat: e.target.value })
                          }
                          placeholder="Wat houdt dit in..."
                          rows={2}
                          className="text-[13px]"
                        />
                      ) : (
                        <p className="text-[13px] leading-[20px] text-hh-text">{displayData.wat}</p>
                      )}
                    </div>
                  )}

                  {displayData.wanneer && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" style={{ color: phaseColor }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: phaseColor }}>Wanneer</span>
                      </div>
                      {isEditing ? (
                        <Textarea
                          value={displayData.wanneer}
                          onChange={(e) =>
                            setEditedData({ ...editedData, wanneer: e.target.value })
                          }
                          placeholder="Wanneer pas je dit toe..."
                          rows={2}
                          className="text-[13px]"
                        />
                      ) : (
                        <p className="text-[13px] leading-[20px] text-hh-text">{displayData.wanneer}</p>
                      )}
                    </div>
                  )}

                  {displayData.hoe && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" style={{ color: phaseColor }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: phaseColor }}>Hoe</span>
                      </div>
                      {isEditing ? (
                        <Textarea
                          value={displayData.hoe}
                          onChange={(e) =>
                            setEditedData({ ...editedData, hoe: e.target.value })
                          }
                          placeholder="Beschrijf hoe..."
                          rows={4}
                          className="text-[13px]"
                        />
                      ) : (
                        <p className="text-[13px] leading-[20px] text-hh-text">{displayData.hoe}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {displayData.waarom && (
                <div
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: `${phaseColor}08`,
                    borderLeft: `4px solid ${phaseColor}60`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <HelpCircle className="w-3.5 h-3.5" style={{ color: `${phaseColor}CC` }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: `${phaseColor}CC` }}>Waarom</span>
                  </div>
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
                    <p className="text-[14px] leading-[22px] text-hh-text italic">
                      {displayData.waarom}
                    </p>
                  )}
                </div>
              )}

              {displayData.stappenplan && displayData.stappenplan.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3 px-1">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: phaseColor }}>
                      <span className="text-[9px] font-bold text-white">#</span>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: phaseColor }}>Stappenplan</span>
                  </div>
                  <div className="relative ml-[7px]">
                    <div
                      className="absolute left-[13px] top-0 bottom-0 w-[2px]"
                      style={{ backgroundColor: `${phaseColor}25` }}
                    />
                    <ol className="space-y-3 relative">
                      {(Array.isArray(displayData.stappenplan) ? displayData.stappenplan : [displayData.stappenplan]).map((stap: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 text-white relative z-10"
                            style={{ backgroundColor: phaseColor }}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-[13px] leading-[20px] text-hh-text pt-1">{stap}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {displayData.voorbeeld && (Array.isArray(displayData.voorbeeld) ? displayData.voorbeeld.length > 0 : true) && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3 px-1">
                    <Quote className="w-3.5 h-3.5" style={{ color: phaseColor }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: phaseColor }}>Voorbeelden</span>
                  </div>
                  <div className="space-y-2.5">
                    {(Array.isArray(displayData.voorbeeld) ? displayData.voorbeeld : [displayData.voorbeeld]).map((vb: string, idx: number) => (
                      <div
                        key={idx}
                        className="relative rounded-lg p-4 overflow-hidden"
                        style={{ backgroundColor: `${phaseColor}08` }}
                      >
                        <span
                          className="absolute top-1 left-3 text-[48px] leading-none font-serif select-none pointer-events-none"
                          style={{ color: `${phaseColor}18` }}
                        >
                          &ldquo;
                        </span>
                        <p className="text-[14px] leading-[22px] italic text-hh-text relative z-10 pl-2">
                          {vb}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchingSlides.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3 px-1">
                    <Presentation className="w-3.5 h-3.5" style={{ color: phaseColor }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: phaseColor }}>Presentatie</span>
                  </div>
                  <div className="space-y-2.5">
                    {matchingSlides.map((slide: EpicSlide) => (
                      <div
                        key={slide.id}
                        className="rounded-lg p-4 border border-hh-border/50"
                        style={{ borderLeftWidth: '3px', borderLeftColor: `${phaseColor}80` }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h5 className="text-[14px] font-semibold text-hh-ink">{slide.titel}</h5>
                          {slide.visual_type && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-2 py-0 rounded-full shrink-0"
                              style={{
                                color: phaseColor,
                                borderColor: `${phaseColor}40`,
                                backgroundColor: `${phaseColor}0A`,
                              }}
                            >
                              {VISUAL_TYPE_LABELS[slide.visual_type] || slide.visual_type}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[13px] leading-[20px] text-hh-muted mb-2">
                          {slide.kernboodschap}
                        </p>
                        {slide.bulletpoints && slide.bulletpoints.length > 0 && (
                          <ul className="space-y-1">
                            {slide.bulletpoints.map((bp, bpIdx) => (
                              <li key={bpIdx} className="flex items-start gap-2 text-[12px] leading-[18px] text-hh-text">
                                <span className="w-1 h-1 rounded-full shrink-0 mt-2" style={{ backgroundColor: `${phaseColor}80` }} />
                                {bp}
                              </li>
                            ))}
                          </ul>
                        )}
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
