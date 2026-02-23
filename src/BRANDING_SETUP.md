# HugoHerbots.ai Branding Setup

## ✅ Voltooid

### Copywriting (Hugo Herbots Brand Story)
Alle marketing teksten zijn herschreven met de Hugo Herbots brand story:
- **40 jaar ervaring**, **20.000+ mensen getraind**, **€2.000/halve dag** live training
- **"People buy people"** kernboodschap prominent aanwezig
- Persoonlijke, directe tone (ik-vorm vanuit Hugo's perspectief)
- Hero: "40 jaar salesgeheimen, nu jouw dagelijkse coach."
- CTAs: "Start gratis met Hugo", "Bekijk demo met Hugo", "Plan een gesprek"
- Zie `/COPY_UPDATE_SUMMARY.md` voor volledige details

### Kleuren
Alle kleurentokens zijn bijgewerkt naar het nieuwe brand palet:
- **MIRAGE** `#1C2535` - Primary dark
- **INDIAN INK** `#2B3748` - Secondary dark
- **SLATE GRAY** `#6B7A92` - Primary accent
- **FRENCH GRAY** `#B1B2B5` - Muted text
- **PLATINUM** `#E4E4E4` - Light gray
- **WHITE** `#FFFFFF` - Pure white

Zie `/styles/globals.css` voor alle CSS tokens.

### Logo Component
`/components/HH/Logo.tsx` is aangemaakt met 3 varianten:
- `<Logo variant="horizontal" />` - Voor headers, navigation
- `<Logo variant="vertical" />` - Voor hero sections, branding
- `<Logo variant="icon" />` - Voor favicon, collapsed sidebar

De logo's zijn geïmplementeerd in:
- Landing page header
- Pricing page header
- App sidebar (beide states)

### Typography
Fonts zijn geconfigureerd in `/styles/globals.css`:
- **Primair**: Hypatia Sans Bold (700) - voor headings
- **Secundair**: Hypatia Sans Light (300) - voor body text
- **Fallback**: Outfit (Google Fonts) - totdat Hypatia Sans font files beschikbaar zijn

## 🔧 Nog te doen

### 1. Hypatia Sans Font Files
**Actie vereist**: Hypatia Sans is een Adobe font en niet gratis beschikbaar via Google Fonts.

**Optie A - Adobe Fonts**:
1. Ga naar [Adobe Fonts](https://fonts.adobe.com/)
2. Zoek naar "Hypatia Sans"
3. Voeg toe aan je project
4. Vervang in `/styles/globals.css`:
```css
@import url('https://use.typekit.net/[jouw-kit-id].css');

html {
  font-family: 'hypatia-sans-pro', 'Outfit', sans-serif;
}
```

**Optie B - Self-hosted fonts**:
Als je de font files hebt (.woff, .woff2):
1. Plaats ze in `/public/fonts/`
2. Update `/styles/globals.css`:
```css
@font-face {
  font-family: 'Hypatia Sans';
  src: url('/fonts/HypatiaSansPro-Light.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
}

@font-face {
  font-family: 'Hypatia Sans';
  src: url('/fonts/HypatiaSansPro-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
}

html {
  font-family: 'Hypatia Sans', 'Outfit', sans-serif;
}
```

### 2. Favicon
**Actie vereist**: Favicon moet handmatig worden toegevoegd aan het HTML document.

**Stappen**:
1. Exporteer het HH logo icon als:
   - `favicon.ico` (16x16, 32x32)
   - `favicon.png` (192x192, 512x512)
   - `apple-touch-icon.png` (180x180)

2. Plaats de bestanden in `/public/`

3. Voeg toe aan je HTML `<head>` (meestal in `index.html` of layout):
```html
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

### 3. Logo Assets (optioneel)
De huidige logo's zijn gecodeerd als SVG in de `Logo.tsx` component.
Als je de originele logo bestanden hebt (PNG/SVG uit Figma), kun je ze importeren voor betere kwaliteit:

```tsx
import logoHorizontal from 'figma:asset/[hash].svg';
import logoVertical from 'figma:asset/[hash].svg';
import logoIcon from 'figma:asset/[hash].svg';
```

## 📋 Verificatie Checklist

### Branding & Design
- [x] Kleurenschema bijgewerkt in globals.css
- [x] Logo component aangemaakt (horizontal/vertical/icon)
- [x] Logo's geïmplementeerd in marketing pages
- [x] Logo's geïmplementeerd in app layout
- [x] Typography weights aangepast
- [x] SVG favicon aangemaakt in /public/

### Copywriting & Content
- [x] Hero copy herschreven met Hugo's brand story
- [x] Alle CTAs geüpdatet ("Start gratis met Hugo")
- [x] Value props herschreven
- [x] Social proof aangepast (zonder fake bedrijfsnamen)
- [x] FAQ vanuit Hugo's perspectief (ik-vorm)
- [x] Pricing copy met €2.000 live training referentie
- [x] Footer & navigation ("Over Hugo")
- [x] Guidelines.md bijgewerkt met brand story

### Nog te doen
- [ ] Hypatia Sans fonts geïnstalleerd (Adobe Fonts of self-hosted)
- [ ] Favicon configureren in HTML head
- [ ] PWA manifest geconfigureerd (optioneel)

## 🎨 Design Systeem

Alle componenten gebruiken nu automatisch de nieuwe branding via de CSS tokens:
- `text-hh-ink` → MIRAGE #1C2535
- `text-hh-primary` → SLATE GRAY #6B7A92
- `border-hh-border` → PLATINUM #E4E4E4
- `bg-hh-bg` → WHITE #FFFFFF

Geen extra wijzigingen nodig aan bestaande componenten!
