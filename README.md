# Bürokratik — German Bureaucracy Tracker

Germany runs on paperwork. Bürokratik helps you track it.

A document management tool for navigating German bureaucracy — from Anmeldung and health insurance to Finanzamt deadlines and rental agreements. Built for anyone living or working in Germany who needs to stay on top of official documents and deadlines.

## What makes it agentic

The app uses Claude to do real work, not just answer questions:

- **Paste a German letter** — Claude reads it, identifies the document type, extracts the deadline, summarises what it means, and generates specific next steps
- **Upload a PDF or image** — same extraction from a scan or photo of an official document
- **Add manually** — Claude generates contextual next steps based on the document category and your notes

## Features

- 10 document categories covering the most common German bureaucracy touchpoints: Mietvertrag, Anmeldung, Krankenversicherung, Finanzamt, Jobcenter, Aufenthaltstitel, Versicherung, Rundfunkbeitrag, Rentenversicherung, and general documents
- Category names keep the German term — that's the word printed on the actual letter — paired with a translated gloss, e.g. "Health Insurance (Krankenversicherung)". In German the two are the same word, so it's shown once.
- Color-coded urgency system: Overdue, Urgent (≤7 days), Due soon (≤30 days), Active, Ongoing, Closed
- AI-generated next steps for every document
- Filter by status: All, Active, Expiring soon, Closed
- Mark complete, reopen, or delete documents
- Persistent storage via localStorage
- Dark mode, defaulting to your OS preference and remembering your choice
- Interface available in English, German, Turkish, and Ukrainian, defaulting to your browser's language and remembering your choice

## Tech stack

- React + Vite
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- Vanilla CSS (no UI library)

## Running locally

Requires [Node.js](https://nodejs.org/) v18 or higher.

```bash
git clone https://github.com/Eliza370/Agents.git
cd Agents/buerokratik
npm install
npm run dev
```

Copy `.env.example` to `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=your_key_here
```

> **API calls:** The app routes requests to the Anthropic API through Vite's dev server proxy, which handles CORS automatically and injects the `x-api-key` header itself — the key stays in `.env` and never reaches the browser bundle. As long as you're running `npm run dev` with a valid key in your `.env`, it will work out of the box.

## Adding a language

Interface text lives in one JSON file per language in `src/locales/`. To add one:

1. Copy `en.json` to `src/locales/xx.json` and translate the values — keep the keys as they are.
2. Import it in `src/i18n.js` and add it to the `LOCALES` map.

That's it — the language dropdown, date formatting, and English fallback for missing keys all pick it up automatically.

## Scope

This is a local-only proof of concept, not production software:

- Documents are stored in unencrypted `localStorage` — anyone with access to the browser profile can read them.
- AI extraction and generated next steps always come back in English, regardless of which interface language you've selected. Only the app's own UI text is translated.
- Everything runs in the browser — no backend, no accounts, no sync across devices.

---

## About

These projects are built as part of a practical learning path into agentic AI development — building real, usable tools. The focus is on AI that does meaningful work: extracting structured data from unstructured inputs, generating contextual guidance, and managing state across a user session.

More projects coming.
