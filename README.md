# Phone Cleaner

Production-ready, Arabic-first (RTL) web app for cleaning, normalizing, and deduplicating phone numbers. Everything runs locally in the browser — no server storage, no analytics, and no external phone parsing libraries.

## Highlights

- Arabic UI (RTL) with dark mode.
- Cleans and normalizes phone numbers to E.164-like format.
- Robust parsing for mixed input: phone-only, "Name - Phone", "Name, Phone", etc.
- Built‑in searchable country selector (Arabic/English/ISO2/dial code).
- Conditional country code injection rules for local numbers without an international prefix.
- Duplicate detection by phone and by name + phone.
- Export clean, duplicates, and invalid rows to CSV.
- Handles large lists using a Web Worker.

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Vitest for unit tests

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
npm run start
```

## Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run test` — run unit tests

## How Normalization Works

The normalization engine is deterministic and does not use external libraries:

1. Convert Arabic digits to Western digits.
2. Remove spaces, hyphens, parentheses, dots, slashes, underscores.
3. Keep a single leading `+` if present.
4. Convert `00` prefix to `+`.
5. If the number is international (`+` or `00`), keep its dial code.
6. If the number is local:
   - Optionally remove trunk prefix (e.g., `0`).
   - Prepend the selected dial code.
7. Validate length using country rules (strict) or a generic range (lenient).

Output format:

```
+<countryCode><nationalNumber>
```

## Conditional Country Code Injection

For local numbers without international prefixes, you can define rules that decide which dial code to add based on:

- Length (exact or range)
- Prefixes (e.g., `05`, `77`)
- Trunk handling (keep or remove leading `0`)

Rules are evaluated top‑to‑bottom; the first match wins. If no rule matches, you can choose to:

- Mark as invalid (`no_rule_match`) — default
- Or fall back to the default country

Rules are stored in localStorage.

## Country Data

Country data is embedded locally:

- `src/features/phone-cleaner/domain/countries.json`

Each entry includes:

- `iso2`
- `name_en`, `name_ar`
- `dial_code`
- `trunk_prefix` (optional)
- `national_number_length_min/max` (optional)

## Presets

Presets live in:

- `src/features/phone-cleaner/domain/presets.ts`

They define default country + validation/trunk rules for common setups.

## Project Structure

```
src/
  app/
  features/
    phone-cleaner/
      domain/
      ui/
      utils/
      workers/
  shared/
```

- Domain logic is pure and testable.
- UI is componentized and RTL‑ready.
- Heavy processing runs in a Web Worker.

## Privacy

- No user data is sent to any server.
- No analytics or tracking.

## Deployment

This project is ready for deployment on Vercel or any Node‑compatible host.

Vercel (recommended):

1. Push to GitHub.
2. Import the repo in Vercel.
3. Deploy.

No env vars required.

## Tests

```bash
npm run test
```

## License

Add a license file that matches your intended public usage (e.g., MIT).
