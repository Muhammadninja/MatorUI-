# Refactor — Step 1: Profile screen + AI Chat (agent) screen

## Goal
Pull repeated UI shapes out of the screens into shared primitives,
move types to `types/`, enforce one-component-per-file in the new
primitives. First pass over the **profile screen** and the **AI chat
("agent") screen**.

## What changed

### New shared primitives

Three small components, each in its own folder, each with `index.ts`
re-exporting a single component from a same-named `.tsx` file (matches
the existing `app-card` / `app-chip` pattern).

#### `components/shared/app-divider/`
Replaces ad-hoc `<View style={{ height: 1, backgroundColor: divider }} />`
blocks. Props: `colorName` (default `'divider'`), `thickness` (default
`StyleSheet.hairlineWidth`), `opacity`, `spacing`, `orientation`
(`'horizontal' | 'vertical'`), `style`.

#### `components/shared/app-icon-button/`
Round/rounded pressable wrapping a single lucide icon. Replaces the
repeated `<AppPressableView width={36} height={36} rounded={999}>` +
`<Icon … />` pattern. Bumps the tappable region to **≥ 44pt via
hitSlop** regardless of visible size — fixes the A2 punch-list item
about icon-only buttons missing the accessibility minimum.

Props: `Icon`, `onPress`, `size` (default 36), `iconSize` (default 18),
`strokeWidth`, `colorName`/`color`, `backgroundColorName`, `rounded`
(default 999), `accessibilityLabel` (required), `disabled`.

#### `components/shared/app-icon-box/`
Non-interactive square that frames a small icon. Replaces the local
`iconBox()` helper that was a closure inside `profile-screen.tsx` and
repeated six times. Used as the leading affordance in profile section
rows.

Props: `Icon`, `size` (default 34), `iconSize` (default 16),
`strokeWidth`, `rounded` (default 12), `backgroundColorName` (default
`backgroundSecondary`), `colorName` (default `icon`).

### Types moved

#### `types/ai-chat.ts` (new)
The full AI chat type surface (`AiChatRole`, `AiChatVehicleContext`,
`AiChatMessage`, `AiChatConversationSummary`, `AiChatSendMessageRequest`,
`AiChatSendMessageResponse`) lives here now. The service file
re-exports the same set for back-compat so any older imports keep
working.

### Profile screen — `components/screens/profile-screen.tsx`
- Removed the local `iconBox()` closure (the React import that existed
  only to type its parameter is now gone too).
- All six `iconBox(Icon)` call sites replaced with
  `<AppIconBox Icon={…} />`.
- `useThemeContext` import dropped — no longer used at this level
  (the new `AppIconBox` handles its own token resolution).

### AI chat (agent) screen — `components/screens-components/ai-chat/ai-chatbot.tsx`
- Top-bar **History** and **EllipsisVertical** buttons swapped to
  `AppIconButton`. Each now has an `accessibilityLabel` ("Restore
  latest chat", "Clear chat") that the bare pressables lacked.
- Inline divider `<AppView style={{ height: 1, backgroundColor:
  tokens.divider, opacity: 0.9 }} />` replaced with
  `<AppDivider thickness={1} opacity={0.9} />`.
- Both `'error' as any` color casts removed — `colorName="error"` is
  valid against `ColorName`, the cast was hiding it.
- Type imports `AiChatMessage` and `AiChatVehicleContext` now come
  from `@/types/ai-chat`, not the service file.

### Service — `services/ai-chat-service.ts`
- Type declarations removed; service imports them from `@/types/ai-chat`.
- A type-only re-export block keeps the old import path
  (`from '@/services/ai-chat-service'`) valid — zero churn for any
  caller that hasn't been touched yet.

## What was deliberately NOT changed
- **The unused 32×32 placeholder pressable** in the top bar (left of
  the "Matorui Copilot" label) — looks like a reserved avatar slot.
  Left as is; can be killed in a follow-up once the design intent is
  confirmed.
- **The "Toast playground" block** in `profile-screen.tsx` — dev-only
  sanity buttons. Not the right time to remove them; will be cleaned
  up before shipping.
- **The two `ScrollView` sections** in the chatbot ("Things I can do"
  / "Questions while you shop") — both follow the same pattern and
  could be extracted into a `<HorizontalSuggestions>` component, but
  that's an additive refactor, not a "use what already exists"
  refactor. Left for another pass.
- **`ai-chat-composer`, `ai-chat-message-bubble`,
  `ai-chat-suggestion-chip`** — already single-purpose components,
  one per file, properly importing shared primitives.

## Best practices encoded
1. **Single export per file.** Every new shared component has an
   `index.ts` that re-exports a single component + its props type from
   a same-named `.tsx`. No two-component files.
2. **Types live in `types/`.** Service files import + re-export for
   transitional back-compat; UI files always import directly from
   `types/`. The re-export keeps the back-compat surface explicit so
   a future developer can see when it's safe to delete.
3. **Accessibility floors at the primitive level.** `AppIconButton`
   auto-inflates `hitSlop` so the tappable region is ≥ 44pt no matter
   what visible size the caller passes. Eliminates the A2 punch-list
   class of issue entirely.
4. **No `as any`.** When a colorName looks invalid, fix the type, not
   the call site. Casts in screens are a smell; the registry is the
   contract.

## Verification
- `npx tsc --noEmit` passes.
- All six `iconBox(Icon)` call sites in `profile-screen.tsx` were
  replaced; no remaining references.
- The two custom round pressables in the chatbot top bar were both
  swapped to `AppIconButton`.
- Inline divider swapped, both `as any` casts removed.

## Next
Step 2 of the refactor sweep: apply the same treatment to one of the
next screens. Candidates ranked by repeated-pattern density:

1. **`checkout-screen.tsx`** — uses ad-hoc express-pay button rows,
   address/payment summary cards, section headers. High primitive
   opportunity.
2. **`track-order-screen.tsx`** — courier card, status pill, step
   indicator. Several patterns shared with other screens.
3. **`vehicle-detail-screen.tsx`** — has its own headline, stats,
   action row sub-components. Worth verifying they're properly
   composed.
4. **`item-detail-screen.tsx`** — similar product detail surface,
   likely repeats patterns from the catalog area.

Recommend hitting **checkout-screen** next — biggest payoff and most
places where the "hide what isn't wired" guidance from doc 11 also
applies.
