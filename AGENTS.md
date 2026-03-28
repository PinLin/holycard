# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the app code. Keep reusable UI in `src/components/`, screens in `src/screens/`, hooks in `src/hooks/`, NFC and data access logic in `src/services/`, shared types in [`src/types.ts`](/Users/pinlin/Desktop/holycard/src/types.ts), custom errors in `src/error/`, utilities in [`src/utils.ts`](/Users/pinlin/Desktop/holycard/src/utils.ts), and bundled card images in `src/image/`. Tests live in `__tests__/`. Android-native code and Gradle configuration are under `android/`. This repository is Android-only; there is no iOS target to maintain.

## Build, Test, and Development Commands
Use Node 18+ and install dependencies with `npm install`.

- `npm start` starts the Metro bundler.
- `npm run android` builds and launches the app on a connected Android device or emulator.
- `npm run lint` runs ESLint across the repository.
- `npm test` runs the Jest suite.
- `npx jest __tests__/App-test.tsx` runs the current app smoke test directly.

## Coding Style & Naming Conventions
Write application code in TypeScript and React Native function components. Follow the existing 4-space indentation used in `src/`, prefer single quotes, and keep imports grouped by source. ESLint extends `@react-native`; Prettier is available in the toolchain and should be kept consistent with the existing file style. Match current naming patterns such as `CardSummary.tsx` for components, `cardService.ts` for services, and `*Error.ts` for custom errors.

## Testing Guidelines
Jest uses the React Native preset from [`jest.config.js`](/Users/pinlin/Desktop/holycard/jest.config.js). Place tests in `__tests__/` and name them with the existing `*-test.tsx` pattern when covering components or app flows. Add tests for new user-visible behavior and NFC parsing logic when it can be exercised without hardware. No coverage threshold is configured, so focus on meaningful regression coverage.

## Commit & Pull Request Guidelines
Recent commits use short, imperative subjects such as `Fix wrong expiryDate` and `Bump version to 3.4.2`. Keep commits focused and descriptive. Pull requests should include a brief summary, testing performed (`npm test`, `npm run lint`, device verification when relevant), linked issues if applicable, and screenshots for UI changes.

## Security & Configuration Tips
Do not commit card keys, secrets, or private backend credentials. NFC behavior depends on external key material and Android hardware access, so document any device-specific setup in the PR when changing card-reading flows.
