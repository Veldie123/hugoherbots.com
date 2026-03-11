import React from "react";
import type { EpicSlideContent } from "@/types/crossPlatform";

const PHASE_COLORS: Record<string, { bg: string; border: string; badge: string; badgeText: string; label: string }> = {
  intro: { bg: 'color-mix(in srgb, var(--hh-ink) 85%, var(--hh-muted))', border: 'color-mix(in srgb, var(--hh-muted) 40%, var(--hh-ink))', badge: 'color-mix(in srgb, var(--hh-muted) 40%, var(--hh-ink))', badgeText: 'var(--hh-muted)', label: 'Introductie' },
  pre: { bg: 'color-mix(in srgb, var(--hh-ink) 85%, var(--hh-muted))', border: 'color-mix(in srgb, var(--hh-muted) 40%, var(--hh-ink))', badge: 'color-mix(in srgb, var(--hh-muted) 40%, var(--hh-ink))', badgeText: 'var(--hh-muted)', label: 'Voorbereiding' },
  E: { bg: 'color-mix(in srgb, var(--hh-primary) 15%, var(--hh-ink))', border: 'var(--hh-primary)', badge: 'var(--hh-primary)', badgeText: '#FFFFFF', label: 'Explore' },
  P: { bg: 'color-mix(in srgb, var(--hh-success) 15%, var(--hh-ink))', border: 'var(--hh-success)', badge: 'var(--hh-success)', badgeText: '#FFFFFF', label: 'Probe' },
  I: { bg: 'color-mix(in srgb, var(--hh-purple) 15%, var(--hh-ink))', border: 'var(--hh-purple)', badge: 'var(--hh-purple)', badgeText: '#FFFFFF', label: 'Impact' },
  C: { bg: 'color-mix(in srgb, var(--hh-warning) 15%, var(--hh-ink))', border: 'var(--hh-warning)', badge: 'var(--hh-warning)', badgeText: '#FFFFFF', label: 'Commit' },
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
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{
              backgroundColor: phaseStyle.badge,
              color: phaseStyle.badgeText,
            }}
          >
            {phaseStyle.label}
          </span>
          {slide.techniqueId && (
            <span className="text-xs font-mono" style={{ color: 'var(--hh-muted)' }}>
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
        <p className="text-xs leading-relaxed" style={{ color: 'var(--hh-border)' }}>
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
                <span className="text-xs leading-snug" style={{ color: 'var(--hh-muted)' }}>
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
            backgroundColor: 'rgba(var(--hh-primary-rgb),0.03)',
          }}
        >
          <p className="text-xs font-medium mb-1.5" style={{ color: phaseStyle.badgeText === '#FFFFFF' ? phaseStyle.border : 'var(--hh-muted)' }}>
            Jouw context
          </p>
          <div className="space-y-1">
            {Object.entries(slide.personalized_context).map(([key, value]) => (
              <div key={key} className="flex items-start gap-1.5">
                <span className="text-xs font-medium capitalize" style={{ color: 'var(--hh-muted)' }}>
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="text-xs" style={{ color: 'var(--hh-border)' }}>
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
          backgroundColor: 'rgba(var(--hh-primary-rgb),0.1)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L10.5 5.5L15.5 6.5L12 10L12.5 15L8 13L3.5 15L4 10L0.5 6.5L5.5 5.5L8 1Z" fill={phaseStyle.border} />
        </svg>
        <span className="text-xs" style={{ color: 'var(--hh-muted)' }}>
          E.P.I.C. TECHNIQUE
        </span>
      </div>
    </div>
  );
}

function EpicLogo() {
  return (
    <svg width="20" height="14" viewBox="0 0 60 20" fill="none">
      <text x="0" y="15" fontFamily="monospace" fontSize="14" fontWeight="bold" fill="var(--hh-primary)">
        EPIC
      </text>
    </svg>
  );
}
