# AgriLearn AI Design System

**Version:** 1.0  
**Owner:** World Humanitarian Support Foundation (WHSF)  
**Product principle:** Responsible AI that is understandable, inclusive, practical and safe.

## 1. Experience principles

1. **Human before technology** — describe the user outcome before the AI capability.
2. **Clarity before decoration** — use plain language, visible hierarchy and generous spacing.
3. **Accessible by default** — target WCAG 2.2 AA, keyboard access, visible focus and reduced-motion support.
4. **Trust through transparency** — label demonstrations, uncertainty, limitations and human-review pathways.
5. **Low-bandwidth resilience** — avoid unnecessary media, keep core content usable without heavy assets.
6. **Mobile and voice first** — primary workflows must work on small screens and without precise typing.

## 2. Brand foundation

### Product name
AgriLearn AI

### Descriptor
AI for digital inclusion and climate-smart livelihoods.

### Brand attributes
Trustworthy, inclusive, practical, optimistic, evidence-led and locally adaptable.

### Voice
- Use direct, respectful sentences.
- Explain unfamiliar terms.
- Never overstate AI certainty or impact.
- Distinguish verified outcomes from goals and projections.
- Use action-oriented labels such as “Ask AgriLearn” and “Explore learning paths.”

## 3. Color tokens

| Token | Value | Purpose |
|---|---:|---|
| `--color-forest-900` | `#082D1C` | Dark surfaces and footer |
| `--color-forest-800` | `#0B3D26` | Primary dark |
| `--color-forest-700` | `#0F5132` | Primary action |
| `--color-forest-600` | `#167247` | Interactive accent |
| `--color-mint-100` | `#E8F5ED` | Supportive surface |
| `--color-mint-50` | `#F3FAF6` | Soft section background |
| `--color-gold-500` | `#D8A62E` | Recognition and highlights |
| `--color-ink-900` | `#10251A` | Main text |
| `--color-ink-600` | `#52675A` | Secondary text |
| `--color-line` | `#C9DDD0` | Borders |
| `--color-canvas` | `#FBFAF3` | Page background |
| `--color-white` | `#FFFFFF` | Cards and inverse text |

Color must never be the only indicator of state. Text, icons or patterns must accompany status colors.

## 4. Typography

Use the native system stack for reliability and performance:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Recommended scale:

- Display: `clamp(3rem, 7vw, 6.4rem)`, weight 850–900
- H2: `clamp(2.15rem, 4.5vw, 4rem)`, weight 800–900
- H3: `1.2rem–1.5rem`, weight 800
- Body large: `1.1rem–1.25rem`
- Body: `1rem`
- Small: `0.85rem–0.92rem`

Keep paragraphs below approximately 75 characters per line.

## 5. Spacing and layout

Base spacing unit: `4px`.

Common tokens: `8, 12, 16, 24, 32, 48, 64, 80, 96`.

- Maximum content width: `1180px`
- Text content width: `720px–780px`
- Standard section padding: `80px` desktop, `56px` tablet, `40px` mobile
- Card radius: `20px–28px`
- Pill radius: `999px`

## 6. Core components

### Header
- Sticky, translucent surface with a clear bottom border.
- Product and organization names remain visible.
- Mobile menu must be operable by keyboard and expose `aria-expanded`.

### Buttons
- Primary: forest background, white text.
- Secondary: transparent or white surface, forest border.
- Minimum target size: 44 × 44 px.
- Visible hover, focus-visible and disabled states.

### Cards
- White or dark-elevated surface.
- One concise purpose per card.
- Avoid excessive shadows; use border and spacing first.

### AI composer
- Clear role/topic inputs and question area.
- Voice control, submit control and read-aloud control.
- Visible status region using `aria-live`.
- Safety note and human-review guidance always present.

### Metrics
- Separate verified numbers, programme priorities and future targets.
- Never present targets as achieved outcomes.

### Navigation
Primary information architecture:
- Platform
- Digital Skills
- Impact
- Partners
- Responsible AI
- Try AgriLearn

## 7. Interaction states

All interactive controls require:
- Default
- Hover
- Focus-visible
- Active
- Disabled
- Loading where applicable
- Success/error feedback where applicable

Animation duration should normally remain between 160–280ms. Honor `prefers-reduced-motion: reduce`.

## 8. Accessibility requirements

- WCAG 2.2 AA target.
- Semantic landmarks and heading order.
- Skip link to main content.
- Keyboard-operable navigation and forms.
- Focus indicators with at least 2px visible outline.
- Form labels always visible.
- Minimum text contrast of 4.5:1 for normal text.
- Do not autoplay audio or video.
- Support browser zoom to 200% without content loss.
- Provide text alternatives for meaningful images.
- Use `aria-live` sparingly for AI status and results.

## 9. Responsive behavior

- Desktop: multi-column storytelling and persistent navigation.
- Tablet: two-column grids where content remains readable.
- Mobile: one-column flow, compact navigation, full-width actions and comfortable touch targets.
- Core AI workflow must remain available at 320px viewport width.

## 10. Responsible AI interface rules

Every AI experience must:
- Identify itself as AI-assisted.
- Explain that outputs may be incomplete or incorrect.
- Show when advice is educational rather than professional diagnosis.
- Avoid unsupported certainty.
- Provide escalation to local agronomists, extension officers or qualified experts for high-impact decisions.
- Protect sensitive personal and farm data.
- Avoid using user content for unrelated purposes without explicit consent.

## 11. Implementation mapping

The public prototype currently implements tokens and components directly in `agrilearn/index.html`. During the application migration, map them to:

- `packages/ui/tokens.css`
- `packages/ui/Button`
- `packages/ui/Card`
- `packages/ui/Header`
- `packages/ui/AIComposer`
- `packages/ui/Metric`
- `packages/ui/SectionHeading`

## 12. Definition of design-system done

The design-system milestone is complete when:
- Tokens are documented and implemented.
- Public pages use consistent typography, buttons, cards and spacing.
- Navigation works across desktop and mobile.
- Keyboard focus and reduced-motion behavior are verified.
- AI demonstration includes visible safety and transparency language.
- No critical WCAG issues are known.