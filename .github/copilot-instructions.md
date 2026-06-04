# Copilot Instructions

- Prefer high-level implementation over low-level duplication.
- Build with reusable components, shared utilities, and composable abstractions first.
- Avoid one-off UI code when an existing shared component or a small reusable primitive can solve the problem.
- Keep screen architecture layered: `app/` is for navigation and route wiring only, `components/screens/` is for full screen implementations, and `components/screens-components/` is for reusable screen building blocks assembled like Lego.
- Do not build full screen UI directly inside `app/`; compose screens from `components/screens/`, and compose those screens from `components/screens-components/` and shared primitives.
- For frontend and React Native changes, check both light mode and dark mode before considering the task complete.
- Treat "white mode" as light mode and ensure contrast, readability, and component states work in both themes.
