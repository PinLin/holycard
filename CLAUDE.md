# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HolyCard is an Android-only React Native (TypeScript) app that reads Taiwanese transit/payment card data via NFC (MIFARE Classic). It supports EasyCard (悠遊卡), HappyCash, and iPass card types.

## Commands

```bash
# Start Metro bundler
npm start

# Run on Android device/emulator
npm run android

# Lint
npm run lint

# Test
npm test

# Run a single test file
npx jest __tests__/App-test.tsx
```

## Architecture

The app follows a layered service-oriented pattern:

**`src/App.tsx`** — Root component. Manages the NFC reading lifecycle (start/stop/read), UI state, and wires together NfcService and CardService.

**`src/service/nfc.service.ts`** — All NFC operations: MIFARE Classic sector authentication with hex keys, block reading, balance extraction, TPASS pass info parsing, and Kuokuang point reading. This is where card-specific sector/block logic lives.

**`src/service/card.service.ts`** — Fetches card metadata from `https://card.pinlin.me/card/{uid}`, caches results locally via `react-native-keychain`.

**`src/model/card.model.ts`** — Core interfaces: `Card`, `CardType` enum (`UNKNOWN`, `HAPPY_CASH`, `EASY_CARD`, `I_PASS`), `CardSector`.

**`src/exception/`** — Custom exception classes for specific failure modes (missing keys, invalid keys, card unavailable, read failures).

**`src/components/Result.tsx`** — Displays card info, balance, TPASS commuter pass details, and Kuokuang points.

## Key NFC Details

- Card reads require MIFARE Classic sector authentication with keys fetched from the backend API
- TPASS expiry: read from sector 6 block 26
- TPASS purchase: read from sector 8
- Kuokuang points: read from sector 11
- EasyCard balance: extracted from specific sector blocks per card variant

## Code Style

Prettier config: single quotes, trailing commas, 4-space tabs. ESLint extends `@react-native`.
