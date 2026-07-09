---
name: Broadcast Pulse - Electric Edition
colors:
  surface: '#0c1609'
  surface-dim: '#0c1609'
  surface-bright: '#323c2d'
  surface-container-lowest: '#071105'
  surface-container-low: '#141e11'
  surface-container: '#182214'
  surface-container-high: '#222d1e'
  surface-container-highest: '#2d3828'
  on-surface: '#dae6d0'
  on-surface-variant: '#baccb0'
  inverse-surface: '#dae6d0'
  inverse-on-surface: '#293324'
  outline: '#85967c'
  outline-variant: '#3c4b35'
  surface-tint: '#2ae500'
  primary: '#efffe3'
  on-primary: '#053900'
  primary-container: '#39ff14'
  on-primary-container: '#107100'
  inverse-primary: '#106e00'
  secondary: '#bdc8d3'
  on-secondary: '#28313b'
  secondary-container: '#3e4852'
  on-secondary-container: '#acb6c2'
  tertiary: '#fff8f7'
  on-tertiary: '#442927'
  tertiary-container: '#ffd3ce'
  on-tertiary-container: '#7a5955'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#79ff5b'
  primary-fixed-dim: '#2ae500'
  on-primary-fixed: '#022100'
  on-primary-fixed-variant: '#095300'
  secondary-fixed: '#dae3f0'
  secondary-fixed-dim: '#bdc8d3'
  on-secondary-fixed: '#131d25'
  on-secondary-fixed-variant: '#3e4852'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#e7bdb8'
  on-tertiary-fixed: '#2c1513'
  on-tertiary-fixed-variant: '#5d3f3c'
  background: '#0c1609'
  on-background: '#dae6d0'
  surface-variant: '#2d3828'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is engineered for high-energy, real-time broadcast environments. It captures the tension between deep cinematic shadows and high-octane digital signals. The brand personality is authoritative yet vibrant—merging the reliability of professional media tools with the electric pulse of live digital culture.

The visual style is **Modern Dark-Mode** with a focus on **Tonal Layering**. We avoid "clunky" legacy broadcast aesthetics by utilizing thin strokes, subtle background blurs, and expansive negative space. The aesthetic is premium and technical, evoking the feel of a high-end control room updated for a modern, digital-first audience.

## Colors

The palette is anchored by a deep, midnight foundation to provide maximum contrast for the core accent.

- **Primary (Soft Electric Green):** Reserved for active states, critical calls to action, and live status indicators. It represents the "pulse" of the system.
- **Secondary (Metallic Silver):** Used for supporting UI elements, icons, and secondary labels to provide a sophisticated, hardware-inspired finish.
- **Surface Strategy:** We use a hierarchical dark scale. The base background is nearly black, while interactive surfaces use nested shades of slate to create depth without relying on heavy borders.
- **Typography:** Primary information is always Pure White for maximum legibility against dark backgrounds.

## Typography

This design system utilizes **Plus Jakarta Sans** exclusively to achieve a modern, geometric, and professional appearance. The typeface's open counters and clean terminals ensure high readability in low-light environments.

- **Headlines:** Use tighter letter-spacing and heavier weights to create a sense of urgency and impact.
- **Body Text:** Standard weight with generous line height to maintain an elegant, airy feel amidst dense data.
- **Labels:** Use uppercase with slight tracking increases for utility-based UI elements, mimicking professional broadcast equipment markings.

## Layout & Spacing

The layout follows a **Fluid Grid** logic with strict adherence to an 8px spatial rhythm. This ensures that even complex dashboard layouts remain organized and breathable.

- **Desktop:** A 12-column grid with 24px gutters. Content is often grouped into logical "modules" or panels that can expand to fill the viewport.
- **Mobile:** A 4-column grid with 16px margins. Complex data tables should transition to card-based stacks or horizontal scrolling regions.
- **Rhythm:** Use the 8px unit for all padding and margins to maintain a tight, systematic relationship between elements.

## Elevation & Depth

To achieve a premium feel and move away from "clunky" designs, we utilize **Tonal Layers** combined with **Low-Contrast Outlines**.

- **Surfaces:** Depth is indicated by color, not just shadow. Higher elevation surfaces are lighter shades of the base slate.
- **Shadows:** Use extremely soft, large-radius shadows (20-40px blur) with very low opacity (15-20%) to create a subtle lift.
- **Borders:** Instead of heavy strokes, use 1px semi-transparent borders (Metallic Silver at 10-15% opacity) to define edges. This adds a "machined" precision to the UI.
- **Glassmorphism:** Apply a subtle background blur (8px-12px) to floating overlays and navigation bars to maintain context of the content beneath.

## Shapes

The shape language is **Rounded**, striking a balance between technical precision and modern friendliness. 

- **Standard Elements:** 0.5rem (8px) radius for buttons and input fields.
- **Containers/Cards:** 1rem (16px) radius to create a distinct soft-rectangle look that feels more modern than sharp corners.
- **Interactive States:** On hover, shapes do not change radius, but background luminosity increases slightly to provide tactile feedback.

## Components

- **Buttons:** Primary buttons use the Soft Electric Green background with dark slate text for maximum punch. Secondary buttons use a Metallic Silver ghost style (outline only).
- **Cards:** Use a slightly lighter slate than the background with a 1px "machined" border. Headers within cards should be separated by a subtle horizontal rule.
- **Input Fields:** Darker than the surface they sit on. Use the Electric Green for the focus ring (2px) to indicate activity.
- **Chips/Badges:** For "Live" or "Active" indicators, use the Electric Green with a subtle "pulse" animation (low-opacity glow).
- **Lists:** Clean rows with 1px dividers. Use the Metallic Silver for secondary metadata like timestamps or IDs.
- **Navigation:** Vertical sidebars are preferred for broadcast tools, utilizing the Metallic Silver for icons and White for active labels.