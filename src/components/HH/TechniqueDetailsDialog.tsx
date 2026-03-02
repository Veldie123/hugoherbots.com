import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { X, Pencil } from "lucide-react";
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

            <div className="p-6 space-y-5">

              {displayData.doel && (
                <div>
                  <h4 className="font-semibold text-hh-text mb-2 text-sm">Doel</h4>
                  {isEditing ? (
                    <Textarea
                      value={displayData.doel}
                      onChange={(e) =>
                        setEditedData({ ...editedData, doel: e.target.value })
                      }
                      placeholder="Beschrijf het doel..."
                      rows={3}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm text-hh-text p-3 rounded-lg" style={{ backgroundColor: `${phaseColor}0A` }}>
                      {displayData.doel}
                    </p>
                  )}
                </div>
              )}

              {displayData.wat && (
                <div>
                  <h4 className="font-semibold text-hh-text mb-2 text-sm">Wat</h4>
                  {isEditing ? (
                    <Textarea
                      value={displayData.wat}
                      onChange={(e) =>
                        setEditedData({ ...editedData, wat: e.target.value })
                      }
                      placeholder="Wat houdt dit in..."
                      rows={2}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm text-hh-text p-3 rounded-lg" style={{ backgroundColor: 'var(--hh-ui-50)' }}>
                      {displayData.wat}
                    </p>
                  )}
                </div>
              )}

              {displayData.waarom && (
                <div>
                  <h4 className="font-semibold text-hh-text mb-2 text-sm">Waarom</h4>
                  {isEditing ? (
                    <Textarea
                      value={displayData.waarom}
                      onChange={(e) =>
                        setEditedData({ ...editedData, waarom: e.target.value })
                      }
                      placeholder="Waarom is dit belangrijk..."
                      rows={2}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm text-hh-text p-3 rounded-lg" style={{ backgroundColor: 'var(--hh-ui-50)' }}>
                      {displayData.waarom}
                    </p>
                  )}
                </div>
              )}

              {displayData.wanneer && (
                <div>
                  <h4 className="font-semibold text-hh-text mb-2 text-sm">Wanneer</h4>
                  {isEditing ? (
                    <Textarea
                      value={displayData.wanneer}
                      onChange={(e) =>
                        setEditedData({ ...editedData, wanneer: e.target.value })
                      }
                      placeholder="Wanneer pas je dit toe..."
                      rows={2}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm text-hh-text p-3 rounded-lg" style={{ backgroundColor: 'var(--hh-ui-50)' }}>
                      {displayData.wanneer}
                    </p>
                  )}
                </div>
              )}

              {displayData.hoe && (
                <div>
                  <h4 className="font-semibold text-hh-text mb-2 text-sm">Hoe</h4>
                  {isEditing ? (
                    <Textarea
                      value={displayData.hoe}
                      onChange={(e) =>
                        setEditedData({ ...editedData, hoe: e.target.value })
                      }
                      placeholder="Beschrijf hoe..."
                      rows={4}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm text-hh-text p-3 rounded-lg" style={{ backgroundColor: 'var(--hh-ui-50)' }}>
                      {displayData.hoe}
                    </p>
                  )}
                </div>
              )}

              {displayData.stappenplan && displayData.stappenplan.length > 0 && (
                <div>
                  <h4 className="font-semibold text-hh-text mb-2 text-sm">Stappenplan</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-hh-text p-3 rounded-lg" style={{ backgroundColor: 'var(--hh-ui-50)' }}>
                    {(Array.isArray(displayData.stappenplan) ? displayData.stappenplan : [displayData.stappenplan]).map((stap: string, idx: number) => (
                      <li key={idx}>{stap}</li>
                    ))}
                  </ol>
                </div>
              )}

              {displayData.voorbeeld && (Array.isArray(displayData.voorbeeld) ? displayData.voorbeeld.length > 0 : true) && (
                <div>
                  <h4 className="font-semibold text-hh-text mb-2 text-sm">Voorbeelden</h4>
                  <div className="space-y-2">
                    {(Array.isArray(displayData.voorbeeld) ? displayData.voorbeeld : [displayData.voorbeeld]).map((vb: string, idx: number) => (
                      <div
                        key={idx}
                        className="text-sm text-hh-text p-3 rounded-lg"
                        style={{ backgroundColor: `${phaseColor}0A` }}
                      >
                        "{vb}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchingSlides.length > 0 && (
                <div>
                  <h4 className="font-semibold text-hh-text mb-2 text-sm">Presentatie</h4>
                  <div className="space-y-2">
                    {matchingSlides.map((slide: EpicSlide) => (
                      <div
                        key={slide.id}
                        className="rounded-lg p-3 border border-hh-border/50"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h5 className="text-sm font-semibold text-hh-ink">{slide.titel}</h5>
                          {slide.visual_type && (
                            <Badge
                              variant="outline"
                              className="text-xs px-2 py-0 rounded-full shrink-0"
                            >
                              {VISUAL_TYPE_LABELS[slide.visual_type] || slide.visual_type}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-hh-muted mb-2">
                          {slide.kernboodschap}
                        </p>
                        {slide.bulletpoints && slide.bulletpoints.length > 0 && (
                          <ul className="space-y-1">
                            {slide.bulletpoints.map((bp, bpIdx) => (
                              <li key={bpIdx} className="flex items-start gap-2 text-xs text-hh-text">
                                <span className="w-1 h-1 rounded-full shrink-0 mt-1.5 bg-hh-muted" />
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
