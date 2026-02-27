interface TrackChangeProps {
  original?: string;
  proposed?: string;
  label?: string;
  compact?: boolean;
}

export function TrackChange({ original, proposed, label, compact = false }: TrackChangeProps) {
  const hasOriginal = original !== undefined && original !== null && original !== '';
  const hasProposed = proposed !== undefined && proposed !== null && proposed !== '';

  if (!hasOriginal && !hasProposed) return null;

  if (!hasOriginal && hasProposed) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-sm' : ''}`}>
        {label && <span className="text-hh-muted font-medium">{label}:</span>}
        <span className="text-green-600 font-medium">{proposed}</span>
        <span className="text-xs text-hh-muted italic">(nieuw)</span>
      </span>
    );
  }

  if (hasOriginal && !hasProposed) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-sm' : ''}`}>
        {label && <span className="text-hh-muted font-medium">{label}:</span>}
        <span className="text-red-400 line-through">{original}</span>
        <span className="text-xs text-hh-muted italic">(verwijderd)</span>
      </span>
    );
  }

  if (original === proposed) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-sm' : ''}`}>
        {label && <span className="text-hh-muted font-medium">{label}:</span>}
        <span className="text-hh-muted">{original}</span>
        <span className="text-xs text-hh-muted italic">(ongewijzigd)</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 flex-wrap ${compact ? 'text-sm' : ''}`}>
      {label && <span className="text-hh-muted font-medium">{label}:</span>}
      <span className="text-red-400 line-through">{original}</span>
      <span className="text-hh-muted">→</span>
      <span className="text-green-600 font-medium">{proposed}</span>
    </span>
  );
}

export function TrackChangeBlock({ original, proposed, label }: TrackChangeProps) {
  const hasOriginal = original !== undefined && original !== null && original !== '';
  const hasProposed = proposed !== undefined && proposed !== null && proposed !== '';

  if (!hasOriginal && !hasProposed) return null;

  return (
    <div className="space-y-1">
      {label && <div className="text-sm font-medium text-hh-muted">{label}</div>}
      <div className="flex flex-col gap-0.5">
        {hasOriginal && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-red-400 mt-0.5 shrink-0">oud</span>
            <span className={`text-sm ${hasProposed && original !== proposed ? 'text-red-400 line-through' : 'text-hh-muted'}`}>
              {original}
            </span>
          </div>
        )}
        {hasProposed && original !== proposed && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-green-600 mt-0.5 shrink-0">nieuw</span>
            <span className="text-sm text-green-600 font-medium">{proposed}</span>
          </div>
        )}
      </div>
    </div>
  );
}
