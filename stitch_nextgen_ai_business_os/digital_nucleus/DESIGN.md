---
name: Digital Nucleus
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#bec8d2'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#88929b'
  outline-variant: '#3e4850'
  surface-tint: '#89ceff'
  primary: '#89ceff'
  on-primary: '#00344d'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#006591'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#ffb86e'
  on-tertiary: '#492900'
  tertiary-container: '#de8712'
  on-tertiary-container: '#4d2b00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#ffb86e'
  on-tertiary-fixed: '#2c1600'
  on-tertiary-fixed-variant: '#693c00'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
  surface-elevated: '#1E293B'
  border-subtle: rgba(241, 245, 249, 0.1)
  text-primary: '#FFFFFF'
  text-secondary: '#94A3B8'
  accent-gradient: 'linear-gradient(135deg, #0EA5E9 0%, #8B5CF6 100%)'
typography:
  display-hero:
    fontFamily: Syne
    fontSize: 72px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  display-hero-mobile:
    fontFamily: Syne
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Syne
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Syne
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  section-gap-lg: 160px
  section-gap-sm: 80px
  element-gap: 16px
---

## Brand & Style

The design system is engineered for the high-velocity world of digital entrepreneurship in LATAM. It balances the cold precision of AI with a high-end, premium aesthetic that evokes trust and technical superiority. The brand personality is **Elite, Automated, and Visionary**, positioning the product as the "central nervous system" of a digital business.

The visual style is a fusion of **Corporate Minimalism** and **High-Tech Glassmorphism**. It utilizes a deep, nocturnal foundation to make "intelligent" accents—like vibrant gradients and glowing borders—feel like active signals in a dark environment. The interface prioritizes "vistosidad" (visual impact) through generous negative space, allowing complex data and multi-step processes to feel manageable and sophisticated.

## Colors

This design system operates natively in a refined **Dark Mode**. The palette is anchored by a near-black background (`#0A0A0B`) to eliminate visual noise and provide maximum contrast for functional elements.

*   **Primary & Secondary:** A high-energy duo of Electric Blue (`#0EA5E9`) and Deep Violet (`#8B5CF6`). These are reserved for primary calls to action, progress indicators, and "AI-active" states.
*   **Gradients:** Use the `accent-gradient` for high-impact moments such as hero typography spans, primary buttons, and premium feature badges.
*   **Neutrals:** Text hierarchy is established using pure white for headers and a slate-gray (`#94A3B8`) for supporting descriptions. Borders and dividers should remain low-contrast to maintain the "seamless" glass effect.

## Typography

The typography strategy leverages the structural tension between **Syne** and **DM Sans**. 

**Syne** is utilized for headlines to provide a distinctive, avant-garde "tech" feel. Its ultra-bold weights and tight letter-spacing in hero sections create a commanding presence. 

**DM Sans** handles all functional and long-form content. It is chosen for its geometric clarity and exceptional readability on high-resolution screens. 

To ensure the "Business OS" feel, use `label-caps` for metadata, step indicators (e.g., "PASO 01"), and small category tags to differentiate them from the narrative flow of the body text.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop (12 columns) to ensure professional alignment and structured data presentation.

*   **Vertical Rhythm:** The system uses aggressive vertical spacing (`160px` between major sections) to emphasize exclusivity and prevent information overload.
*   **Information Density:** While the overall layout is spacious, internal component spacing (like within a card) is tight and efficient (`16px`) to mimic a professional dashboard or "OS" environment.
*   **Mobile Reflow:** On mobile devices, the 12-column grid collapses to a single column with `20px` side margins. Section gaps are reduced by 50% to maintain momentum.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layering** and **Glassmorphism**, rather than traditional heavy shadows.

*   **The Base:** The bottom-most layer is `#0A0A0B`.
*   **Surface Layers:** Cards and containers use a semi-transparent `#1E293B` with a `backdrop-filter: blur(12px)`. This creates the "glass" effect that suggests a sophisticated, multi-layered digital environment.
*   **Outlines:** Use "Ghost Borders"—1px solid lines with 10% white opacity. This defines shape without adding visual weight.
*   **Glows:** Primary elements may use a subtle, diffused outer glow (bloom) in the primary blue hue to simulate a screen emitting light, reinforcing the AI theme.

## Shapes

The shape language is **Rounded**, using a `0.5rem` (8px) base radius. This strikes a balance between the precision of a technical tool and the approachability of a modern SaaS product.

*   **Cards:** Use `rounded-xl` (1.5rem / 24px) to create a soft, modern enclosure for "Information Modules."
*   **Interactive Elements:** Buttons and input fields use the base `rounded` (0.5rem) to maintain a crisp, functional appearance.
*   **Feature Badges:** Small status chips or "Paso" indicators should use a pill-shape (full radius) to distinguish them from clickable buttons.

## Components

### Buttons
*   **Primary:** Gradient background (`accent-gradient`), white text, bold weight. On hover, apply a subtle scale (1.02x) and increase the outer glow.
*   **Secondary:** Ghost style with a `1px` white border at 20% opacity and a backdrop blur.

### Cards
*   Containers for features and pricing must use the Glassmorphism style: `#1E293B` at 60% opacity with a `12px` blur and a thin `1px` border.

### Input Fields
*   Dark backgrounds (`#0A0A0B`) with a `1px` border. Upon focus, the border transitions to the `primary_color` with a subtle outer glow.

### Chips & Badges
*   Used for "AI Powered" or "New" tags. These should be small, use `label-caps` typography, and feature a light blue tint background at 10% opacity with solid blue text.

### Progress Indicators
*   Linear bars for "Process Steps" should use the gradient fill against a dark track to visualize the "AI generation" speed.