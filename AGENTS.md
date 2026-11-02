# Working in Mator

- Read `CLAUDE.md` and relevant files before edits. Preserve its project rules; verify historical documentation against current code.
- Expo Router routes live in `app/`; screens in `components/screens/`; feature components in `components/screens-components/`; shared primitives in `components/shared/`; theme tokens in `themes/`.
- Keep changes scoped. Do not change UI, shared components, dependencies, or native configuration during an audit without authorization. Never print or commit credentials or `.env` contents.
- Preserve Russian/Uzbek/English localization, OS light/dark appearance, accessibility, vehicle fitment, guest/auth flows, cart and checkout behavior, navigation, and loading/error/empty states.
- Use existing theme tokens and components. Check narrow layouts and long translated labels. Distinguish web observations from native verification.

## Commands checked on 2026-11-01

- `npm start -- --localhost --port 8081`: starts Metro; requires permission to bind the local port in restricted environments. `/explore` serves web, but this audit found SVG/Reanimated `CSSStyleDeclaration` runtime errors, failed API requests, and font/rendering differences.
- `npm run ios -- --device <simulator-uuid> --no-install --port 8081`: invokes the local native build. Initial rebuild failed with missing `RNSContainer.h` (Xcode exit 65). Subsequent audits used the running iPhone 16 Pro / iOS 18.3 build, with Russian/Uzbek and both appearances. Android remains unverified.
- `npm run typecheck`: passed.
- `npm test -- tests/home-category-counts.test.tsx tests/category-label-wrap.test.ts tests/category-tile-label.test.ts`: 31 tests passed; existing React renderer/act warnings remain.
- Final checks on 2026-11-02: `npm test` passed all 827 tests; `npm run typecheck` passed; `npx expo export --platform ios --output-dir /tmp/mator-main-export` produced the iOS bundle (not a native Xcode rebuild). No generic `npm run build` script exists.

After code changes, run appropriate tests and type checking; verify the affected flow visually. Do not claim checks passed unless executed. API transport is selected by `EXPO_PUBLIC_API_BASE_URL` and optional `EXPO_PUBLIC_HTTP_DOMAINS`; no-HTTP mode does not provide a populated home category grid.
