import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/utils';

interface DetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'admin' | 'user';
}

export function DetailsSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  badges,
  children,
  footer,
  variant = 'user',
}: DetailsSheetProps) {
  const isAdmin = variant === 'admin';
  
  const accentColor = isAdmin ? '#9333ea' : '#3d9a6e';
  const secondaryColor = isAdmin ? '#9333ea' : '#1e3a5f';
  const accentBg = isAdmin ? 'rgba(147, 51, 234, 0.05)' : 'rgba(61, 154, 110, 0.08)';
  const accentBorder = isAdmin ? 'rgba(147, 51, 234, 0.2)' : 'rgba(61, 154, 110, 0.25)';
  const headerBg = isAdmin ? 'var(--card)' : 'rgba(61, 154, 110, 0.03)';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="p-0 flex flex-col border-r shadow-xl bg-hh-bg"
        style={{ width: 'min(500px, 40vw)', maxWidth: '500px' }}
      >
        <SheetHeader 
          className="p-6 pb-4 border-b flex-shrink-0"
          style={{ borderColor: accentBorder, backgroundColor: headerBg }}
        >
          {badges && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {badges}
            </div>
          )}
          <SheetTitle className="text-xl font-semibold text-hh-text pr-8">
            {title}
          </SheetTitle>
          {subtitle && (
            <SheetDescription className="text-sm text-hh-muted mt-1">
              {subtitle}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {children}
        </div>

        {footer && (
          <SheetFooter 
            className="p-4 border-t bg-card flex-shrink-0 flex-row justify-end gap-3"
            style={{ borderColor: 'var(--hh-border, #e5e7eb)' }}
          >
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface TechniqueContentProps {
  technique: {
    nummer?: string;
    naam?: string;
    fase?: string | number;
    doel?: string;
    wat?: string;
    waarom?: string;
    wanneer?: string;
    hoe?: string;
    stappenplan?: string[];
    voorbeeld?: string | string[];
    tags?: string[];
    themas?: string[];
    is_fase?: boolean;
  } | null;
  variant?: 'admin' | 'user';
}

export function TechniqueContent({ technique, variant = 'user' }: TechniqueContentProps) {
  const isAdmin = variant === 'admin';
  const accentColor = isAdmin ? '#9333ea' : '#3d9a6e';
  const accentBg = isAdmin ? 'rgba(147, 51, 234, 0.05)' : 'rgba(61, 154, 110, 0.08)';
  
  if (!technique) {
    return <p className="text-hh-muted py-4">Techniek niet gevonden</p>;
  }

  const sections = [
    { label: 'Doel', value: technique.doel, highlight: true },
    { label: 'Wat', value: technique.wat },
    { label: 'Waarom', value: technique.waarom },
    { label: 'Wanneer', value: technique.wanneer },
    { label: 'Hoe', value: technique.hoe },
  ];

  return (
    <div className="space-y-5">
      {sections.map(({ label, value, highlight }) => (
        <div key={label}>
          <h4 className="font-semibold text-hh-text mb-2 text-sm">{label}</h4>
          <p 
            className="text-sm text-hh-text p-3 rounded-lg"
            style={{ backgroundColor: highlight ? accentBg : 'var(--hh-ui-50)' }}
          >
            {value || <span className="italic text-hh-muted">Niet ingevuld</span>}
          </p>
        </div>
      ))}

      {technique.stappenplan && technique.stappenplan.length > 0 && (
        <div>
          <h4 className="font-semibold text-hh-text mb-2 text-sm">Stappenplan</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-hh-text p-3 rounded-lg" style={{ backgroundColor: 'var(--hh-ui-50)' }}>
            {(Array.isArray(technique.stappenplan) ? technique.stappenplan : [technique.stappenplan]).map((stap, idx) => (
              <li key={idx}>{stap}</li>
            ))}
          </ol>
        </div>
      )}

      {technique.voorbeeld && (Array.isArray(technique.voorbeeld) ? technique.voorbeeld.length > 0 : true) && (
        <div>
          <h4 className="font-semibold text-hh-text mb-2 text-sm">Voorbeelden</h4>
          <div className="space-y-2">
            {(Array.isArray(technique.voorbeeld) ? technique.voorbeeld : [technique.voorbeeld]).map((vb, idx) => (
              <div 
                key={idx} 
                className="text-sm text-hh-text p-3 rounded-lg border"
                style={{ backgroundColor: accentBg, borderColor: 'transparent' }}
              >
                "{vb}"
              </div>
            ))}
          </div>
        </div>
      )}

      {technique.tags && technique.tags.length > 0 && (
        <div>
          <h4 className="font-semibold text-hh-text mb-2 text-sm">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {technique.tags.map((tag, idx) => (
              <Badge 
                key={idx} 
                variant="outline" 
                className="text-xs"
                style={{ 
                  backgroundColor: accentBg, 
                  color: accentColor, 
                  borderColor: 'transparent' 
                }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {technique.themas && technique.themas.length > 0 && (
        <div>
          <h4 className="font-semibold text-hh-text mb-2 text-sm">Thema's</h4>
          <div className="flex flex-wrap gap-2">
            {technique.themas.map((thema, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {thema}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface VideoInfoContentProps {
  video: {
    id?: string;
    title?: string;
    displayTitle?: string;
    duration?: number;
    muxPlaybackId?: string;
    status?: string;
    techniqueNumber?: string;
    phase?: string;
    views?: number;
    ai_confidence?: number;
    has_transcript?: boolean;
    transcript?: string;
    created_at?: string;
  } | null;
  technique?: {
    nummer?: string;
    naam?: string;
    fase?: string | number;
    doel?: string;
    wat?: string;
    waarom?: string;
    wanneer?: string;
    hoe?: string;
    stappenplan?: string[];
    voorbeeld?: string | string[];
    tags?: string[];
  } | null;
  variant?: 'admin' | 'user';
}

export function VideoInfoContent({ video, technique, variant = 'user' }: VideoInfoContentProps) {
  if (!video) {
    return <p className="text-hh-muted py-4">Video niet gevonden</p>;
  }

  if (technique) {
    return <TechniqueContent technique={technique} variant={variant} />;
  }

  return <p className="text-hh-muted py-4">Geen techniek gekoppeld</p>;
}

export default DetailsSheet;
