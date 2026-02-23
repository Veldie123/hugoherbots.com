# Sticky Header & App Preview Implementation

**Status**: ✅ Complete

## Components Added

### 1. StickyHeader Component (`/components/HH/StickyHeader.tsx`)
- **Purpose**: Persistent navigation across all marketing pages
- **Features**:
  - Sticky positioning with scroll-triggered background blur
  - Mobile-responsive with hamburger menu
  - Active page state highlighting
  - Smooth transitions and animations
  - Shadow appears on scroll for depth
- **Navigation**: Logo (home), Over Hugo, Pricing, Login, Start gratis CTA
- **Props**: `currentPage`, `navigate` function

### 2. BrowserMockup Component (`/components/HH/BrowserMockup.tsx`)
- **Purpose**: Reusable browser window chrome for app screenshots
- **Features**:
  - macOS-style traffic lights (red, yellow, green)
  - URL bar showing "hugoherbots.ai"
  - 16:10 aspect ratio content area
  - Optional title and description
  - Shadow and border styling
- **Props**: `imageSrc`, `imageAlt`, `title` (optional), `description` (optional), `className` (optional)

## Pages Updated

### Landing Page (`/components/HH/Landing.tsx`)
**Changes**:
- ✅ Replaced static header with `<StickyHeader>`
- ✅ Added top padding (pt-32) to hero for sticky header clearance
- ✅ **New Section**: "App Preview" with full browser mockup showing Dashboard screenshot
- ✅ Enhanced value props cards with screenshot thumbnails (hover zoom effect)

**New Content**:
- "Kijk binnen in de app" section with browser mockup
- 4 app screenshots in value prop cards (Role-play, Library, Dashboard, Analytics)
- Visual hierarchy: Badge → Heading → Description → Mockup

### Pricing Page (`/components/HH/Pricing.tsx`)
**Changes**:
- ✅ Replaced static header with `<StickyHeader>`
- ✅ Added top padding (pt-32) to hero
- ✅ **New Section**: "Bekijk de app" with 2-column feature showcase
  - Role-play sessie screenshot with browser mockup
  - Analytics dashboard screenshot with browser mockup
  - Each with descriptive heading and body text

**Layout**: 2-column grid on desktop, stacked on mobile

### About Page (`/components/HH/About.tsx`)
**Changes**:
- ✅ Replaced static header with `<StickyHeader>`
- ✅ Added top padding (pt-32) to hero
- ✅ Fixed orphaned HTML from previous header

**Note**: No app preview added (focus is on Hugo's story)

## Design Details

### Sticky Header Behavior
- **Default (not scrolled)**: Transparent background
- **Scrolled (>20px)**: 
  - `bg-hh-bg/95` with backdrop blur
  - `shadow-hh-md` for elevation
- **Height**: Fixed 80px (h-20)
- **Z-index**: 50 (always on top)

### App Screenshots (Unsplash Images)
1. **Dashboard**: Business analytics dashboard
2. **Analytics**: Data visualization charts
3. **Role-play**: Video call coaching
4. **Library**: Content library grid

### Typography & Spacing
- Section headings: Default h2 styling from globals.css
- Descriptions: `text-[18px] leading-[26px] text-hh-muted`
- Section padding: `py-20` standard
- Hero top padding: `pt-32` (to clear sticky header)

## Mobile Responsiveness
- **StickyHeader**: Hamburger menu below `md:` breakpoint
- **BrowserMockup**: Scales responsively, maintains aspect ratio
- **App Preview Sections**: 2-column grid → single column on mobile

## Next Steps (Optional Enhancements)
- [ ] Add video demos instead of static screenshots
- [ ] Implement lightbox/modal for enlarged app previews
- [ ] Add scroll-triggered animations for browser mockups
- [ ] Create actual app screenshot images (replace Unsplash placeholders)
- [ ] Add interactive demo (iframe of actual app)
