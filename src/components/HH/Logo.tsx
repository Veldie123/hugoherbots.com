import { cn } from "../ui/utils";

interface LogoProps {
  variant?: "horizontal" | "vertical" | "icon";
  className?: string;
}

function HhIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("w-10 h-10", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hh. handwritten signature — branding PDF */}
      {/* H: two vertical stems + crossbar */}
      <path
        d="M15 18 L15 78 M15 48 L40 48 M40 18 L40 78"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* h: stem + curved bowl */}
      <path
        d="M56 22 L56 78"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M56 44 C56 34, 80 34, 80 46 L80 78"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Dot */}
      <circle cx="90" cy="30" r="3" fill="currentColor" />
    </svg>
  );
}

export function Logo({ variant = "horizontal", className }: LogoProps) {
  if (variant === "icon") {
    return <HhIcon className={className} />;
  }

  if (variant === "vertical") {
    return (
      <div className={cn("flex flex-col items-center gap-0", className)}>
        <span className="text-[32px] leading-[36px] tracking-[0.2em] uppercase" style={{ fontWeight: 700 }}>
          HUGO
        </span>
        <span className="text-[32px] leading-[36px] tracking-[0.2em] uppercase" style={{ fontWeight: 700 }}>
          HERBOTS
        </span>
      </div>
    );
  }

  // Horizontal variant (default) — icon on mobile, text on desktop
  return (
    <div className={cn("flex items-center", className)}>
      <HhIcon className="w-8 h-8 sm:hidden" />
      <span className="hidden sm:block text-[24px] leading-[28px] tracking-[0.15em] uppercase" style={{ fontWeight: 700 }}>
        HUGO HERBOTS
      </span>
    </div>
  );
}
