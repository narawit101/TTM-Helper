# Next.js 15 & TypeScript Project Rules

## 1. Technical Stack
- Framework: Next.js 15 (App Router)
- Language: TypeScript (Strict mode)
- Styling: Tailwind CSS
- Components: Shadcn UI (Radix UI)
- Icons: Lucide React
- Validation: Zod

## 2. General Principles
- **No 'any'**: Never use the `any` type. Define proper interfaces or types.
- **Functional Components**: Use arrow functions for all components.
- **Client vs Server**: Default to Server Components. Use `'use client'` only when interactivity (useState, useEffect) or browser APIs are required.
- **Clean Code**: Follow DRY (Don't Repeat Yourself) and SOLID principles.

## 3. Naming Conventions
- Components: PascalCase (e.g., `UserButton.tsx`)
- Folders/Files in App Router: kebab-case (e.g., `user-profile/page.tsx`)
- Utils/Hooks: camelCase (e.g., `useLocalStorage.ts`)

## 4. Folder Structure Standards
- `/app`: All routes and layouts.
- `/components/ui`: Atomic components (Shadcn).
- `/components/shared`: Reusable business components.
- `/lib`: Server-side utilities, DB clients (Prisma/Drizzle).
- `/hooks`: Custom React hooks.
- `/types`: Shared TypeScript definitions.

## 5. Agent-Specific Instructions
- **Plan First**: Before writing code, summarize the plan in the chat and ask for confirmation.
- **Check Environment**: Always verify if required environment variables exist in `.env.example` before implementation.
- **Verify Build**: After significant changes, run `npm run build` or `next lint` to ensure no regressions.
- **Error Handling**: Always wrap async operations (API routes, Server Actions) in try-catch blocks and use Zod for input validation.

## 6. CSS & UI
- Use Tailwind CSS for all styling.
- Avoid inline styles.
- Ensure responsive design (mobile-first).

## Frontend tasks

When doing frontend design tasks, avoid generic, overbuilt layouts.

**Use these hard rules:**
- One composition: The first viewport must read as one composition, not a dashboard (unless it's a dashboard).
- Brand first: On branded pages, the brand or product name must be a hero-level signal, not just nav text or an eyebrow. No headline should overpower the brand.
- Brand test: If the first viewport could belong to another brand after removing the nav, the branding is too weak.
- Typography: Use expressive, purposeful fonts and avoid default stacks (Inter, Roboto, Arial, system).
- Background: Don't rely on flat, single-color backgrounds; use gradients, images, or subtle patterns to build atmosphere.
- Full-bleed hero only: On landing pages and promotional surfaces, the hero image should be a dominant edge-to-edge visual plane or background by default. Do not use inset hero images, side-panel hero images, rounded media cards, tiled collages, or floating image blocks unless the existing design system clearly requires it.
- Hero budget: The first viewport should usually contain only the brand, one headline, one short supporting sentence, one CTA group, and one dominant image. Do not place stats, schedules, event listings, address blocks, promos, "this week" callouts, metadata rows, or secondary marketing content in the first viewport.
- No hero overlays: Do not place detached labels, floating badges, promo stickers, info chips, or callout boxes on top of hero media.
- Cards: Default: no cards. Never use cards in the hero. Cards are allowed only when they are the container for a user interaction. If removing a border, shadow, background, or radius does not hurt interaction or understanding, it should not be a card.
- One job per section: Each section should have one purpose, one headline, and usually one short supporting sentence.
- Real visual anchor: Imagery should show the product, place, atmosphere, or context. Decorative gradients and abstract backgrounds do not count as the main visual idea.
- Reduce clutter: Avoid pill clusters, stat strips, icon rows, boxed promos, schedule snippets, and multiple competing text blocks.
- Use motion to create presence and hierarchy, not noise. Ship at least 2-3 intentional motions for visually led work.
- Color & Look: Choose a clear visual direction; define CSS variables; avoid purple-on-white defaults. No purple bias or dark mode bias.
- Ensure the page loads properly on both desktop and mobile.
- For React code, prefer modern patterns including useEffectEvent, startTransition, and useDeferredValue when appropriate if used by the team. Do not add useMemo/useCallback by default unless already used; follow the repo's React Compiler guidance.

Exception: If working within an existing website or design system, preserve the established patterns, structure, and visual language.