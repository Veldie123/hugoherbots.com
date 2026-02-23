import { cn } from "../ui/utils";

interface LogoProps {
  variant?: "horizontal" | "vertical" | "icon";
  className?: string;
}

export function Logo({ variant = "horizontal", className }: LogoProps) {
  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 100 100"
        className={cn("w-10 h-10", className)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* HH signature icon - simplified handwritten style */}
        <path
          d="M20 30 L20 70 M20 50 L45 50 M45 30 L45 70 M55 30 L55 70 M55 50 L80 50 M80 30 L80 70"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Signature underline */}
        <path
          d="M15 80 Q50 75 85 80"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
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

  // Horizontal variant (default)
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-[24px] leading-[28px] tracking-[0.15em] uppercase" style={{ fontWeight: 700 }}>
        HUGO HERBOTS
      </span>
    </div>
  );
}
