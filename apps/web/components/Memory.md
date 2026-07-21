# apps/web/components — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- shadcn/ui components live in `components/ui/` — use `vercel:shadcn` skill before adding new ones
- Custom components go directly in `components/` (not in `ui/`)
- Server components by default; `'use client'` only for interactivity (buttons, forms, realtime)

## Patterns
- shadcn/ui installed via `npx shadcn@latest add <component>` — never copy-paste manually
- Tailwind v4 for styling — no CSS modules, no styled-components
- Component naming: PascalCase files matching component name

## Gotchas
- Tailwind v4 config differs from v3 — no `tailwind.config.js`; config in CSS via `@theme`
- shadcn/ui components in `ui/` are auto-generated — do not hand-edit; re-run `shadcn add` to update

## Decisions
- `components/ui/` is gitignored-style: treat as generated, not hand-authored
