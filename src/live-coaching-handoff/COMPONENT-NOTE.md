# Component Files Note

## Hugo Live Photo Asset

De Hugo live coaching foto wordt in het origineel geïmporteerd via:
```tsx
import hugoLivePhoto from "figma:asset/9f21bc9eaae81b79a083fcd342b14f53acdad581.png";
```

**Voor jouw implementatie:**
Vervang deze import met de echte foto file. De `figma:asset` syntax werkt alleen in Figma Make.

```tsx
// Vervang:
import hugoLivePhoto from "figma:asset/9f21bc9eaae81b79a083fcd342b14f53acdad581.png";

// Door:
import hugoLivePhoto from "./assets/hugo-live-photo.png";
// of direct inline:
<img src="/images/hugo-live-coaching.png" alt="Hugo Herbots Live Coaching" />
```

## Alle Component Dependencies

De LiveCoaching component heeft de volgende imports nodig:
- `AppLayout` - Main app wrapper
- `Card`, `Badge`, `Button`, `Input`, `Tabs`, `ScrollArea`, `Avatar` - UI primitives
- `EPICSalesFlow` - Sales flow indicator component (gebruikt in sidebar)
- Lucide React icons
- Hugo live photo asset

Zie de volledige component code in `/components/HH/LiveCoaching.tsx`

## HeyGen Integration Placeholder

In regel 206-237 van LiveCoaching.tsx zie je de video player area:
```tsx
<div className="w-full bg-hh-ink flex items-center justify-center relative overflow-hidden"
     style={{ aspectRatio: "16/9" }}>
  <img src={hugoLivePhoto} alt="Hugo Herbots Live Coaching" 
       className="absolute inset-0 w-full h-full object-cover"/>
  {/* Badges overlay */}
</div>
```

**Dit is waar je HeyGen video embed komt:**
- Vervang `<img>` door HeyGen iframe/embed
- Behoud de 16:9 aspect ratio
- Behoud Live badge + Viewers count bovenop de video

Zie README.md sectie "Backend Vereisten → HeyGen API Integratie" voor details.
