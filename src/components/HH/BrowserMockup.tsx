import { ImageWithFallback } from "../figma/ImageWithFallback";

interface BrowserMockupProps {
  imageSrc: string;
  imageAlt: string;
  title?: string;
  description?: string;
  className?: string;
}

export function BrowserMockup({
  imageSrc,
  imageAlt,
  title,
  description,
  className = "",
}: BrowserMockupProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Browser Window */}
      <div className="relative bg-white rounded-2xl shadow-hh-lg overflow-hidden border border-hh-border">
        {/* Browser Chrome */}
        <div className="bg-hh-ui-100 border-b border-hh-border px-4 py-3 flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28CA42]" />
          </div>
          {/* URL bar */}
          <div className="flex-1 ml-4 bg-white rounded-lg px-4 py-1.5 text-[14px] leading-[20px] font-[300] text-hh-muted border border-hh-border">
            hugoherbots.ai
          </div>
        </div>

        {/* Browser Content */}
        <div className="bg-hh-ui-50 aspect-[16/10] overflow-hidden">
          <ImageWithFallback
            src={imageSrc}
            alt={imageAlt}
            className="w-full h-full object-cover object-top"
          />
        </div>
      </div>

      {/* Optional Caption */}
      {(title || description) && (
        <div className="mt-6 text-center">
          {title && <h4 className="text-hh-ink mb-2">{title}</h4>}
          {description && (
            <p className="text-hh-muted max-w-md mx-auto">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
