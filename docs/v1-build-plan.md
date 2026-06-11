# Product Updates Blog V1 Build Plan

## Source Inputs
- Brief: [implementation-spec.md](./implementation-spec.md)
- Mock assets: [design_mocks/layout.png](./design_mocks/layout.png), [design_mocks/structure.png](./design_mocks/structure.png)

## V1 Scope Locked
- Single Product Updates page.
- Left sidebar with tag filters.
- Main content area with hero section and update cards.
- Each card includes image, tags, title, body, and read-more link.
- Sidebar preview panel for selected update.
- External links open in a new tab.

## Out Of Scope For V1
- Multi-slide hero carousel.
- Image zoom interactions.
- Full CMS integration.

## UX Structure
- Global layout:
  - Desktop: fixed-width sidebar + flexible main column.
  - Mobile: top filter bar + stacked cards; preview opens as full-width drawer.
- Hero block:
  - Highlights strategic product story and audience relevance.
- Card grid:
  - Responsive stacked cards (1 column mobile, 2 columns desktop).
- Preview panel:
  - Opens from card interaction.
  - Shows larger image, summary body, and external read-more link.

## Data Model (V1)
```ts
export type UpdateTag =
  | "accountants"
  | "bookkeepers"
  | "small-business"
  | "automation"
  | "compliance"
  | "insights";

export type ProductUpdate = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  tags: UpdateTag[];
  title: string;
  body: string;
  readMoreUrl: string;
  featured?: boolean;
};
```

## Behavior Rules
- Filter behavior:
  - Multi-select tags.
  - OR logic between tags.
  - No selected tags means show all updates.
- Preview behavior:
  - Click card opens preview with selected update.
  - Close via close button, backdrop click, or Escape key.
- Link behavior:
  - Read-more links use target="_blank" and rel="noopener noreferrer".

## Accessibility Requirements
- Keyboard-operable filter chips, cards, and preview close action.
- Visible focus indicators for all interactive controls.
- Semantic landmarks: nav, main, aside.
- Respect reduced motion preference for transitions.

## Implementation Plan (File-by-File)
1. Update [app/page.tsx](../app/page.tsx)
- Refactor to split into:
  - static seed updates data.
  - filter state management.
  - selected update preview state.
- Build responsive sidebar + hero + card grid + preview drawer.

2. Update [app/globals.css](../app/globals.css)
- Add brand-aligned CSS variables and layout primitives.
- Add subtle interaction styles (hover/focus) and reduced-motion handling.

3. Add assets placeholders in [public](../public)
- Create temporary update thumbnail images for layout testing.

4. Validation
- Run lint.
- Manual checks on desktop and mobile widths.

## Acceptance Checklist
- [ ] Sidebar filters narrow visible cards by selected tags.
- [ ] At least 6 sample cards render with required fields.
- [ ] Preview panel opens/closes correctly and supports keyboard close.
- [ ] External read-more links open in new tab.
- [ ] Mobile layout remains usable without horizontal overflow.
- [ ] Lint passes.

## Open Decisions
- Final FreeAgent color tokens and typography mapping.
- Final tag taxonomy names.
- Exact tone and copy style for hero and card summaries.
