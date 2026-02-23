# 🚀 Quick Start Guide - Dashboard Design Package

**HugoHerbots.ai - Home Tab**

Volg deze stappen om de Dashboard in je Replit project te krijgen.

---

## 📋 Stap 1: Installeer Dependencies

```bash
# Core packages
npm install lucide-react clsx tailwind-merge

# shadcn/ui components
npx shadcn-ui@latest add card
npx shadcn-ui@latest add button
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add input
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add sheet
```

---

## 📁 Stap 2: Kopieer Design Files

Kopieer deze bestanden naar je project:

```
/dashboard-design-handoff/Dashboard.tsx 
  → /components/HH/Dashboard.tsx

/dashboard-design-handoff/AppLayout.tsx 
  → /components/HH/AppLayout.tsx

/dashboard-design-handoff/EmptyState.tsx 
  → /components/HH/EmptyState.tsx

/dashboard-design-handoff/Logo.tsx 
  → /components/HH/Logo.tsx
```

---

## 🎨 Stap 3: Update Styles

### Option A: Voeg toe aan bestaande globals.css

Open `/styles/globals.css` en voeg onderaan toe:

```bash
cat dashboard-styles.css >> /styles/globals.css
```

### Option B: Handmatig kopiëren

Kopieer de inhoud van `dashboard-styles.css` naar je `/styles/globals.css`

---

## 🔧 Stap 4: Creëer UserMenu Component

Creëer `/components/HH/UserMenu.tsx`:

```tsx
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";

interface UserMenuProps {
  navigate?: (page: string) => void;
  onLogout?: () => void;
}

export function UserMenu({ navigate, onLogout }: UserMenuProps) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-10 w-10"
      onClick={onLogout}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-hh-primary text-white text-[12px]">
          JD
        </AvatarFallback>
      </Avatar>
    </Button>
  );
}
```

---

## ⚙️ Stap 5: Update Tailwind Config

Update `/tailwind.config.js`:

```js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hh: {
          text: '#1C2535',
          ink: '#2B3748',
          primary: '#6B7A92',
          'slate-gray': '#6B7A92',
          muted: '#B1B2B5',
          border: '#E4E4E4',
          bg: '#FFFFFF',
          success: '#00C389',
          warn: '#FFB020',
          'ui-50': '#F9FAFB',
          'ui-100': '#F3F4F6',
          'ui-200': '#E5E7EB',
        },
      },
      boxShadow: {
        'hh-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'hh-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'hh-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
```

---

## 🎯 Stap 6: Gebruik Dashboard in je App

Update je main App component (`/App.tsx` of `/src/App.tsx`):

```tsx
import { useState } from 'react';
import { Dashboard } from './components/HH/Dashboard';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleNavigate = (page: string) => {
    console.log('Navigate to:', page);
    setCurrentPage(page);
    // Implement je routing logica hier
  };

  return (
    <div className="min-h-screen">
      <Dashboard 
        hasData={true}           // true = toon data, false = empty state
        navigate={handleNavigate} 
      />
    </div>
  );
}

export default App;
```

---

## ✅ Stap 7: Test je Setup

Start je development server:

```bash
npm run dev
```

Check of:
- ✅ Dashboard laadt zonder errors
- ✅ Sidebar navigatie werkt (icons klikbaar)
- ✅ Cards hebben hover effects
- ✅ Responsive layout werkt (resize browser)
- ✅ Streak card rechts uitgelijnd is (desktop)
- ✅ Hugo's tip card onderaan zichtbaar is

---

## 🎨 Customization Options

### Show Empty State

```tsx
<Dashboard hasData={false} navigate={handleNavigate} />
```

### Change Current Page Highlight

AppLayout prop `currentPage` bepaalt welke nav item highlighted is:

```tsx
<AppLayout currentPage="home" navigate={handleNavigate}>
  {/* content */}
</AppLayout>
```

Mogelijke waardes: 
- `"home"` - Home tab
- `"roleplaychat"` - Rollenspel Training
- `"videos"` - Video Cursus
- `"live"` - Live Coaching
- `"overviewprogress"` - Overzicht & Voortgang
- `"team"` - Team
- `"analytics"` - Analytics
- `"settings"` - Settings

---

## 🐛 Troubleshooting

### ❌ Error: "Cannot find module 'lucide-react'"

**Fix**: 
```bash
npm install lucide-react
```

### ❌ Error: "Module not found: Can't resolve '../ui/utils'"

**Fix**: Creëer `/components/ui/utils.ts`:
```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### ❌ Cards have no colors/styling

**Fix**: 
1. Check if `dashboard-styles.css` is toegevoegd aan `globals.css`
2. Check if Tailwind config heeft HH color tokens
3. Restart dev server: `npm run dev`

### ❌ Navigation doesn't work

**Fix**: Zorg dat je navigate function correct werkt:
```tsx
const handleNavigate = (page: string) => {
  console.log('Navigate to:', page); // Debug
  setCurrentPage(page);
};
```

### ❌ Icons not showing

**Fix**: 
```bash
npm install lucide-react
```

### ❌ Sidebar collapsed on desktop

**Fix**: AppLayout auto-collapses op < 1024px. Resize je browser window groter.

---

## 📊 Mock Data Customization

Wil je de mock data aanpassen? Edit Dashboard.tsx:

**Gebruikersnaam** (regel ~55):
```tsx
<h1>Welkom terug, Jan</h1>
// Change "Jan" naar je gewenste naam
```

**Streak dagen** (regel ~71):
```tsx
<span>7</span>
// Change "7" naar gewenst aantal
```

**Progress percentages** (regel ~147, 218):
```tsx
style={{ width: "12.5%" }}
// Change naar gewenste progress
```

**Hugo's tip** (regel ~412-418):
```tsx
<p>Je scoort sterk op E.P.I.C questioning...</p>
// Change naar gewenste tip tekst
```

---

## 📚 Next Steps

1. ✅ Dashboard werkt → Lees `README.md` voor design specs
2. 🔌 Backend integratie → Vervang mock data met API calls
3. 🧭 Routing → Implementeer navigate() met React Router
4. 🎨 Customization → Pas kleuren/teksten aan naar je branding
5. 📱 Mobile test → Test op echte mobile devices

---

## 📞 Support

**Design Package Versie**: v1.0  
**Last Updated**: December 2024

Voor vragen over design specs → zie `README.md`  
Voor dependencies → zie `DEPENDENCIES.md`

---

**Klaar om te bouwen! 🚀**
