# HugoHerbots.ai Design System Guidelines

## Project Overview
HugoHerbots.ai is een AI-salescoach platform voor B2B teams. Het platform gebruikt een avatar-gebaseerde AI coach om salesprofessionals te trainen via role-plays, gebaseerd op een methodologie van 4 fasen en 20 technieken.

**Brand Story**:
- Hugo Herbots = referentie in salestraining
- 40 jaar training; 20.000+ mensen getraind
- Laatste jaren exclusief voor een beperkt aantal bedrijven
- Live training = €2.000/halve dag voor kleine groep
- "In het laatste hoofdstuk van zijn leven" deelt hij nu zijn geheimen
- Kern van sales is 50 jaar onveranderd: **"People buy people"**
- Focus = menselijke psychologie en hoe je daarop inspeelt — nu beschikbaar als AI-coach

**Tone of Voice**:
- Eerlijk, direct, warm, persoonlijk (ik-vorm uit Hugo's perspectief waar logisch)
- Concreet, getalsmatig (noem 40 jaar, 20.000+, €2.000, etc.)
- Geen buzzwords ("synergie", "disruptie"), geen holle claims
- Zinnen kort-tot-middel, actief
- CTA's duidelijk en actiegericht

## Design Tokens (HH/) - Updated Branding 2025

### Brand Colors
- **MIRAGE** (`#1C2535`): Primary dark/ink - hoofdtekst, dark elements
- **INDIAN INK** (`#2B3748`): Secondary dark - UI tints
- **SLATE GRAY** (`#6B7A92`): Primary accent - CTA's, links, highlights
- **FRENCH GRAY** (`#B1B2B5`): Muted text - secondary text
- **PLATINUM** (`#E4E4E4`): Light gray - borders, dividers
- **WHITE** (`#FFFFFF`): Pure white - backgrounds

### Additional UI Colors
- **Success** (`#00C389`): Positive feedback, success states
- **Warn** (`#FFB020`): Warnings, attention items

### Typography
**Fonts**: 
- **Primary**: Hypatia Sans Bold (voor titels, headings, buttons)
- **Secondary**: Hypatia Sans Light (voor body text, inputs, paragraphs)
- **Fallback**: Outfit (Google Fonts) - Replace met Hypatia Sans font files wanneer beschikbaar

**Scale**:
- **H1**: 48px/56px, Bold (700)
- **H2**: 32px/40px, Bold (700)
- **H3**: 24px/32px, Bold (700)
- **Body**: 16px/24px, Light (300)
- **Small**: 14px/20px, Light (300)
- **Mono**: 12px/16px, Medium (500) - voor codes/technische info

### Effects
- **Elevations**: `.shadow-hh-sm`, `.shadow-hh-md`, `.shadow-hh-lg`
- **Focus**: 2px `#6B7A92` (SLATE GRAY) outline
- **Radius**: Default 16px voor cards/containers

### Grid System
- **Desktop**: 12 kolommen, 80px gap, 24px margin
- **Tablet**: 8 kolommen, 48px gap, 24px margin
- **Mobile**: 4 kolommen, 16px gap, 16px margin

## Key Microcopy (Hugo Herbots branded)

### Headlines
- "40 jaar salesgeheimen, nu jouw dagelijkse coach."
- "Train elke dag. Win elke week. Met Hugo."
- "De waarde van 40 jaar training, voor een fractie van live"
- "People buy people — en de psychologie leer je hier."

### CTAs
- "Start gratis met Hugo"
- "Bekijk demo met Hugo"
- "Probeer 14 dagen gratis"
- "Plan een gesprek"
- "Begin role-play"
- "Herhaal met focus"
- "Deel met manager"

### Hero copy elementen
- "40 jaar training"
- "20.000+ mensen getraind"
- "€2.000 per halve dag voor live training"
- "4 fasen • 20 technieken • People buy people"

### Empty States
- "Nog geen sessies — start je eerste role-play en krijg binnen 2 min feedback."

### Errors
- "Microfoon geblokkeerd — geef toegang in je browserinstellingen."

### Navigation
- "Over Hugo" (niet "Over ons")
- "Bekijk demo met Hugo" (niet alleen "Demo")

## Mock Data Patterns

### User Names
- Jan de Vries, Sarah van Dijk, Mark Peters, Lisa de Jong

### Company Names
- Acme Inc, TechCorp, SalesForce, TechStart, ScaleUp BV, GrowCo

### Techniques (20 total, 4 fasen)
**Fase 1 - Discovery**: SPIN, Discovery, BANT, Active Listening  
**Fase 2 - Qualification**: Objection Handling, Value Selling, Challenger  
**Fase 3 - Proposal**: Negotiation, ROI Calculation, Business Case  
**Fase 4 - Closing**: Closing Techniques, Urgency Creation, Next Steps

### Score Ranges
- **80-100%**: Excellent (green/success)
- **60-79%**: Good (yellow/warn)
- **0-59%**: Needs improvement (red/destructive)
