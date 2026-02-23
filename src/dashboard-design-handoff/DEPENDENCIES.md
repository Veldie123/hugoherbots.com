# Dependencies - Dashboard Design Package

## 📦 Required NPM Packages

```bash
npm install lucide-react
npm install clsx tailwind-merge
```

## 🎨 Required shadcn/ui Components

Je moet de volgende shadcn/ui components installeren:

```bash
npx shadcn-ui@latest add card
npx shadcn-ui@latest add button
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add input
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add sheet
```

## 📁 File Structure in je project

```
/components/
  /HH/
    Dashboard.tsx          ✅ Included
    AppLayout.tsx          ✅ Included
    EmptyState.tsx         ✅ Included
    Logo.tsx               ✅ Included
    UserMenu.tsx           ⚠️  Not included (dependency)
    AppFooter.tsx          ⚠️  Not included (dependency)
  
  /ui/
    card.tsx               ➡️  shadcn/ui
    button.tsx             ➡️  shadcn/ui
    badge.tsx              ➡️  shadcn/ui
    input.tsx              ➡️  shadcn/ui
    avatar.tsx             ➡️  shadcn/ui
    sheet.tsx              ➡️  shadcn/ui
    utils.ts               ➡️  shadcn/ui utility (cn function)

/styles/
  globals.css              ⚠️  Add dashboard-styles.css content here
```

## ⚠️ Missing Dependencies (Not in package)

Deze componenten worden gebruikt maar zijn NIET included in dit package:

### 1. UserMenu.tsx
**Locatie**: `/components/HH/UserMenu.tsx`

**Props**:
```tsx
interface UserMenuProps {
  navigate?: (page: string) => void;
  onLogout?: () => void;
}
```

**Minimal Implementation**:
```tsx
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";

export function UserMenu({ navigate, onLogout }: UserMenuProps) {
  return (
    <Button variant="ghost" size="icon" className="h-10 w-10">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-hh-primary text-white text-[12px]">
          JD
        </AvatarFallback>
      </Avatar>
    </Button>
  );
}
```

### 2. AppFooter.tsx
**Locatie**: `/components/HH/AppFooter.tsx`

AppLayout gebruikt dit NIET, dus je kan dit negeren. Het is legacy code.

## 🔧 Utils Function (cn)

Als je `utils.ts` nog niet hebt in `/components/ui/`:

```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## 🎯 Import Example

Zo gebruik je Dashboard in je main App:

```tsx
import { Dashboard } from './components/HH/Dashboard';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  return (
    <Dashboard 
      hasData={true} 
      navigate={(page) => setCurrentPage(page)} 
    />
  );
}
```

## 🎨 Tailwind Configuration

Zorg dat je Tailwind CSS geïnstalleerd hebt:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**tailwind.config.js**:
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

## ✅ Installation Checklist

- [ ] Install lucide-react
- [ ] Install clsx + tailwind-merge
- [ ] Install shadcn/ui components (card, button, badge, input, avatar, sheet)
- [ ] Create UserMenu.tsx (or use minimal version above)
- [ ] Add dashboard-styles.css to globals.css
- [ ] Configure Tailwind (colors, shadows)
- [ ] Copy Dashboard.tsx, AppLayout.tsx, EmptyState.tsx, Logo.tsx
- [ ] Test navigation prop function
- [ ] Verify responsive layout

## 🐛 Common Issues

**Issue**: `Module not found: Can't resolve '../ui/utils'`  
**Fix**: Create utils.ts with cn function (see above)

**Issue**: `undefined is not a function (reading 'navigate')`  
**Fix**: Pass navigate prop to Dashboard component

**Issue**: Colors not working  
**Fix**: Add HH color tokens to tailwind.config.js

**Issue**: Icons not rendering  
**Fix**: Install lucide-react: `npm install lucide-react`

---

**Questions?** Check README.md voor design specs en layout details.
