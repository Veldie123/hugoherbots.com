import React from "react";
import type { EpicSlideContent } from "@/types/crossPlatform";

const PHASE_COLORS: Record<string, { bg: string; border: string; badge: string; badgeText: string; label: string }> = {
  intro: { bg: '#1A1F2E', border: '#3B4259', badge: '#3B4259', badgeText: '#A8B4CC', label: 'Introductie' },
  pre: { bg: '#1A1F2E', border: '#3B4259', badge: '#3B4259', badgeText: '#A8B4CC', label: 'Voorbereiding' },
  E: { bg: '#1B2A3A', border: '#2D6A9F', badge: '#2D6A9F', badgeText: '#FFFFFF', label: 'Explore' },
  P: { bg: '#1B3A2A', border: '#3C9A6E', badge: '#3C9A6E', badgeText: '#FFFFFF', label: 'Probe' },
  I: { bg: '#2A1B3A', border: '#7C3AED', badge: '#7C3AED', badgeText: '#FFFFFF', label: 'Impact' },
  C: { bg: '#3A2A1B', border: '#D97706', badge: '#D97706', badgeText: '#FFFFFF', label: 'Commit' },
};

function getPhaseStyle(phase: string) {
  return PHASE_COLORS[phase] || PHASE_COLORS.intro;
}

interface EpicSlideCardProps {
  slide: EpicSlideContent;
}

export function EpicSlideCard({ slide }: EpicSlideCardProps) {
  const phaseStyle = getPhaseStyle(slide.phase);

  return (
    <div
      className="rounded-xl overflow-hidden my-2 max-w-md"
      style={{
        backgroundColor: phaseStyle.bg,
        border: `1px solid ${phaseStyle.border}`,
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: phaseStyle.badge,
              color: phaseStyle.badgeText,
            }}
          >
            {phaseStyle.label}
          </span>
          {slide.techniqueId && (
            <span className="text-xs font-mono" style={{ color: '#8899AA' }}>
              {slide.techniqueId}
            </span>
          )}
        </div>
        <EpicLogo />
      </div>

      <div className="px-4 pb-2">
        <h4 className="text-sm font-bold text-white leading-tight">
          {slide.titel}
        </h4>
      </div>

      <div className="px-4 pb-3">
        <p className="text-xs leading-relaxed" style={{ color: '#C4D0DE' }}>
          {slide.kernboodschap}
        </p>
      </div>

      {slide.bulletpoints.length > 0 && (
        <div className="px-4 pb-3">
          <ul className="space-y-1.5">
            {slide.bulletpoints.map((bp, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="mt-1.5 flex-shrink-0 rounded-full"
                  style={{
                    width: '5px',
                    height: '5px',
                    backgroundColor: phaseStyle.border,
                  }}
                />
                <span className="text-xs leading-snug" style={{ color: '#A8B4CC' }}>
                  {bp}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {slide.personalized_context && Object.keys(slide.personalized_context).length > 0 && (
        <div
          className="px-4 py-2.5 border-t"
          style={{
            borderColor: phaseStyle.border,
            backgroundColor: 'rgba(255,255,255,0.03)',
          }}
        >
          <p className="text-xs font-medium mb-1.5" style={{ color: phaseStyle.badgeText === '#FFFFFF' ? phaseStyle.border : '#8899AA' }}>
            Jouw context
          </p>
          <div className="space-y-1">
            {Object.entries(slide.personalized_context).map(([key, value]) => (
              <div key={key} className="flex items-start gap-1.5">
                <span className="text-xs font-medium capitalize" style={{ color: '#8899AA' }}>
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="text-xs" style={{ color: '#C4D0DE' }}>
                  {value.length > 80 ? value.substring(0, 80) + '...' : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="px-4 py-2 flex items-center gap-1.5"
        style={{
          borderTop: `1px solid ${phaseStyle.border}`,
          backgroundColor: 'rgba(0,0,0,0.15)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L10.5 5.5L15.5 6.5L12 10L12.5 15L8 13L3.5 15L4 10L0.5 6.5L5.5 5.5L8 1Z" fill={phaseStyle.border} />
        </svg>
        <span className="text-xs" style={{ color: '#8899AA' }}>
          EPIC Sales Engine
        </span>
      </div>
    </div>
  );
}

function EpicLogo() {
  return (
    <svg width="20" height="14" viewBox="0 0 60 20" fill="none">
      <text x="0" y="15" fontFamily="monospace" fontSize="14" fontWeight="bold" fill="#4F7396">
        EPIC
      </text>
    </svg>
  );
}
