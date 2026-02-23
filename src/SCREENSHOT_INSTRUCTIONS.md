# Screenshot Showcase - Implementatie Instructies

## Overzicht

De Landing page bevat nu een interactieve "Zo werkt het" sectie met tabs die de 5 kernfuncties van HugoHerbots.ai showcasen:

1. **Dashboard** - Persoonlijk overzicht met KPI's en voortgang
2. **Train** - Role-play sessies met Hugo's AI avatar
3. **Resultaten** - Direct feedback na elke sessie
4. **Bibliotheek** - Scenario library met filters
5. **Analyse** - Analytics en team inzichten

## Screenshots die je hebt

Je hebt de volgende screenshots geüpload:
- Dashboard met welkom, KPI tiles, continue card, feedback en skills
- Team Sessions met performance table
- Role-Play Results met scores en transcript
- Library (Bibliotheek) met scenario cards en filters
- Analytics met performance tiles en breakdown

## Hoe de échte screenshots toevoegen

### Optie 1: Via Figma Assets (Aanbevolen)

1. **Upload screenshots naar Figma**
   - Ga naar je Figma Make project
   - Upload de 5 screenshots als assets
   - Kopieer de `figma:asset/[hash].png` paths

2. **Update ProductShowcase.tsx**
   - Open `/components/HH/ProductShowcase.tsx`
   - Zoek het `tabs` array (regel ~28)
   - Vervang de `imageSrc` voor elke tab:

```typescript
// Dashboard screenshot
imageSrc: "figma:asset/[jouw-dashboard-screenshot-hash].png",

// Role-play screenshot (tijdens sessie)
imageSrc: "figma:asset/[jouw-roleplay-screenshot-hash].png",

// Results screenshot (na sessie)
imageSrc: "figma:asset/[jouw-results-screenshot-hash].png",

// Library screenshot
imageSrc: "figma:asset/[jouw-library-screenshot-hash].png",

// Analytics screenshot
imageSrc: "figma:asset/[jouw-analytics-screenshot-hash].png",
```

### Optie 2: Via ImageWithFallback

Als je problemen hebt met Figma assets:

1. **Importeer aan de top van ProductShowcase.tsx:**
```typescript
import dashboardScreenshot from "figma:asset/[hash].png";
import roleplayScreenshot from "figma:asset/[hash].png";
import resultsScreenshot from "figma:asset/[hash].png";
import libraryScreenshot from "figma:asset/[hash].png";
import analyticsScreenshot from "figma:asset/[hash].png";
```

2. **Update de imageSrc properties:**
```typescript
imageSrc: dashboardScreenshot,
```

## Screenshot Specificaties

Voor de beste weergave:

- **Resolutie**: 1200x800px of groter (aspect ratio 3:2)
- **Format**: PNG of JPG
- **Inhoud**: 
  - Dashboard: Toon KPI's, feedback cards en skills progress
  - Train: Toon actieve role-play met transcript en hints
  - Results: Toon scores modal met highlights
  - Library: Toon scenario grid met filters
  - Analytics: Toon performance tiles en charts

## Hugo's Boardroom Foto

De foto van Hugo in de boardroom is al toegevoegd aan:

- **About page** (`/components/HH/About.tsx`)
  - Sectie: "Hugo in actie - Boardroom photo"
  - Regel ~227-258
  - Import: `hugoBoardroom from "figma:asset/d7b695733520207576d0406f7258d097e2c645bb.png"`

## Testing

Na het updaten van de screenshots:

1. Ga naar de Landing page
2. Scroll naar de "Zo werkt het" sectie
3. Klik door alle 5 tabs
4. Verifieer dat:
   - Alle screenshots correct laden
   - De BrowserMockup correct weergeeft
   - De feature cards onder elke screenshot kloppen
   - De screenshots passen bij de tab labels

## Alternatieve Plaatsen voor Screenshots

Je kunt de ProductShowcase component ook hergebruiken op:

- **Pricing page** - Om te laten zien wat je krijgt
- **About page** - Om de methodologie visueel te maken
- **Demo page** (nieuw) - Voor een guided tour

Voeg gewoon toe:
```tsx
import { ProductShowcase } from "./ProductShowcase";

// In je component:
<ProductShowcase />
```

## Extra Optimalisaties

### Lazy Loading
Als de screenshots groot zijn:

```tsx
<img 
  src={screenshot} 
  alt="..." 
  loading="lazy"
  className="..."
/>
```

### Compressed Versions
Overweeg gecomprimeerde versies voor snellere laadtijden:
- Dashboard: max 800KB
- Andere: max 500KB each

## Vragen?

Als je problemen hebt met het toevoegen van de screenshots:

1. Check of de Figma asset paths correct zijn
2. Verifieer dat de imports bovenaan het bestand staan
3. Test in de browser console of de images laden
4. Gebruik ImageWithFallback als backup

---

**Gemaakt**: 2025-01-06  
**Component**: ProductShowcase.tsx  
**Pages**: Landing.tsx, About.tsx
