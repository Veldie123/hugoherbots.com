import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Target, X, Pencil, ListOrdered, Quote } from "lucide-react";
import { getCodeBadgeColors } from "../../utils/phaseColors";

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

  const accentBg = isAdmin ? "bg-purple-100" : "bg-hh-ink/10";
  const accentText = isAdmin ? "text-purple-600" : "text-hh-ink";

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="p-0 overflow-hidden"
        style={isDesktop ? { width: 'calc(60px + (100vw - 60px) / 3)', maxWidth: 'none' } : { width: '100%' }}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 pb-5">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0 ${codeBadgeColors}`}>
                  {technique.nummer}
                </div>
                <span className="text-[13px] text-hh-muted">Fase {displayData.fase} · {PHASE_LABELS[String(displayData.fase)] || ''}</span>
              </div>
              
              {isEditing ? (
                <Input
                  value={displayData.naam}
                  onChange={(e) =>
                    setEditedData({ ...editedData, naam: e.target.value })
                  }
                  className="text-[26px] font-bold mt-2"
                  placeholder="Techniek naam"
                />
              ) : (
                <h2 className="text-[26px] leading-[32px] font-bold text-hh-ink mt-1">
                  {displayData.naam}
                </h2>
              )}

              {displayData.tags && displayData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {displayData.tags?.map((tag: string, index: number) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-[12px] bg-hh-ui-50 text-hh-muted border-hh-border font-normal px-3 py-1 rounded-full"
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

            <div className="px-6 pb-8 space-y-7">
              {displayData.doel && (
                <div className={`${isAdmin ? 'bg-purple-500/10 border-purple-500/20' : 'bg-hh-ui-50 border-hh-border'} border rounded-xl p-5`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className={`w-4 h-4 ${isAdmin ? 'text-purple-600' : 'text-hh-ink'}`} />
                    <h4 className={`text-[14px] font-semibold ${isAdmin ? 'text-purple-600' : 'text-hh-ink'}`}>Doel</h4>
                  </div>
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
                    <p className={`text-[14px] leading-[22px] ${isAdmin ? 'text-purple-700' : 'text-hh-text'}`}>
                      {displayData.doel}
                    </p>
                  )}
                </div>
              )}

              {displayData.wat && (
                <div>
                  <h4 className="text-[15px] font-semibold text-hh-ink mb-2">Wat</h4>
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
                    <p className="text-[14px] leading-[22px] text-hh-text">
                      {displayData.wat}
                    </p>
                  )}
                </div>
              )}

              {displayData.waarom && (
                <div>
                  <h4 className="text-[15px] font-semibold text-hh-ink mb-2">Waarom</h4>
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
                    <p className="text-[14px] leading-[22px] text-hh-text">
                      {displayData.waarom}
                    </p>
                  )}
                </div>
              )}

              {displayData.wanneer && (
                <div>
                  <h4 className="text-[15px] font-semibold text-hh-ink mb-2">Wanneer</h4>
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
                    <p className="text-[14px] leading-[22px] text-hh-text">
                      {displayData.wanneer}
                    </p>
                  )}
                </div>
              )}

              {displayData.hoe && (
                <div>
                  <h4 className="text-[15px] font-semibold text-hh-ink mb-2">Hoe</h4>
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
                    <p className="text-[14px] leading-[22px] text-hh-text">
                      {displayData.hoe}
                    </p>
                  )}
                </div>
              )}

              {displayData.stappenplan && displayData.stappenplan.length > 0 && (
                <div className={`${isAdmin ? 'bg-purple-500/10 border-purple-500/20' : 'bg-hh-ui-50 border-hh-border'} border rounded-xl p-5`}>
                  <div className="flex items-center gap-2 mb-4">
                    <ListOrdered className={`w-4 h-4 ${isAdmin ? 'text-purple-600' : 'text-hh-ink'}`} />
                    <h4 className={`text-[14px] font-semibold ${isAdmin ? 'text-purple-600' : 'text-hh-ink'}`}>Stappenplan</h4>
                  </div>
                  <ol className="space-y-3">
                    {(Array.isArray(displayData.stappenplan) ? displayData.stappenplan : [displayData.stappenplan]).map((stap: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 mt-0.5 ${isAdmin ? 'bg-purple-600 text-white' : 'bg-hh-ink text-white'}`}>
                          {idx + 1}
                        </span>
                        <span className={`text-[14px] leading-[22px] ${isAdmin ? 'text-purple-700' : 'text-hh-text'}`}>{stap}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {displayData.voorbeeld && (Array.isArray(displayData.voorbeeld) ? displayData.voorbeeld.length > 0 : true) && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Quote className={`w-4 h-4 ${isAdmin ? 'text-purple-600' : 'text-hh-ink'}`} />
                    <h4 className={`text-[14px] font-semibold ${isAdmin ? 'text-purple-600' : 'text-hh-ink'}`}>Voorbeelden</h4>
                  </div>
                  <div className="space-y-3">
                    {(Array.isArray(displayData.voorbeeld) ? displayData.voorbeeld : [displayData.voorbeeld]).map((vb: string, idx: number) => (
                      <div
                        key={idx}
                        className={`${isAdmin ? 'bg-purple-500/10 border-purple-500/20' : 'bg-hh-ui-50 border-hh-border'} border rounded-xl p-5`}
                      >
                        <p className={`text-[14px] leading-[22px] italic ${isAdmin ? 'text-purple-700' : 'text-hh-text'}`}>
                          "{vb}"
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
                  className={`${isAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-hh-ink hover:bg-hh-ink/90'} px-6`}
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
                    className={`${isAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-hh-ink hover:bg-hh-ink/90'} px-6 gap-2`}
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
