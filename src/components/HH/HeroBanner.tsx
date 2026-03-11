import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface HeroBannerAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'success' | 'muted';
  disabled?: boolean;
}

interface HeroBannerProps {
  image: string;
  imagePosition?: string;
  flipImage?: boolean;
  badge: {
    icon?: React.ReactNode;
    label: string;
    variant?: 'primary' | 'success';
  };
  title: string;
  subtitle?: string;
  primaryAction?: HeroBannerAction;
  secondaryAction?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  };
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function HeroBanner({
  image,
  imagePosition = '50% 30%',
  flipImage,
  badge,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  isLoading,
  children,
}: HeroBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl h-[200px] sm:h-[280px] dark:ring-1 dark:ring-white/10">
      <img
        src={image}
        alt="Hugo Herbots"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          objectPosition: imagePosition,
          ...(flipImage ? { transform: 'scaleX(-1)' } : {}),
        }}
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      <div className="relative h-full flex items-center p-6 sm:p-8">
        <div className="text-white space-y-3 max-w-lg">
          {isLoading ? (
            <>
              <div className="h-6 w-40 bg-white/20 rounded-full animate-pulse" />
              <div className="h-8 w-64 bg-white/20 rounded animate-pulse" />
              <div className="hidden sm:block h-4 w-80 bg-white/10 rounded animate-pulse" />
              <div className="h-9 w-36 bg-white/10 rounded-lg animate-pulse mt-2" />
            </>
          ) : (
            <>
              <Badge
                className={`text-[12px] py-0.5 text-white border-0 ${
                  badge.variant === 'success' ? 'bg-hh-success' : 'bg-hh-primary'
                }`}
              >
                {badge.icon}
                {badge.label}
              </Badge>

              <h2 className="text-[24px] sm:text-[32px] font-bold leading-tight">
                {title}
              </h2>

              {subtitle && (
                <p className="hidden sm:block text-white/60 text-[14px] italic leading-relaxed line-clamp-2">
                  {subtitle}
                </p>
              )}

              {children}

              <div className="flex flex-wrap gap-3 pt-1">
                {primaryAction && (
                  <Button
                    className={`gap-2 border-0 ${
                      primaryAction.variant === 'muted'
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-hh-success hover:bg-hh-success/90 text-white'
                    }`}
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled}
                  >
                    {primaryAction.icon}
                    {primaryAction.label}
                  </Button>
                )}
                {secondaryAction && (
                  <button
                    className="hidden sm:flex items-center gap-2 h-9 px-4 py-2 rounded-md text-sm font-medium text-white border backdrop-blur-sm transition-colors cursor-pointer"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--hh-bg) 25%, transparent)', borderColor: 'color-mix(in srgb, var(--hh-bg) 60%, transparent)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hh-bg)'; e.currentTarget.style.color = 'var(--hh-ink)'; e.currentTarget.style.borderColor = 'var(--hh-bg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--hh-bg) 25%, transparent)'; e.currentTarget.style.color = 'var(--hh-bg)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--hh-bg) 60%, transparent)'; }}
                    onFocus={(e) => { e.currentTarget.style.backgroundColor = 'var(--hh-bg)'; e.currentTarget.style.color = 'var(--hh-ink)'; e.currentTarget.style.borderColor = 'var(--hh-bg)'; }}
                    onBlur={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--hh-bg) 25%, transparent)'; e.currentTarget.style.color = 'var(--hh-bg)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--hh-bg) 60%, transparent)'; }}
                    onClick={secondaryAction.onClick}
                  >
                    {secondaryAction.icon}
                    {secondaryAction.label}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
