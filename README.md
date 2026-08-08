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
- Color-coded urgency system: Overdue, Urgent (≤7 days), Due soon (≤30 days), Active, Ongoing, Closed
- AI-generated next steps for every document
- Filter by status: All, Active, Expiring soon, Closed
- Mark complete, reopen, or delete documents
- Persistent storage via localStorage

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

> **API calls:** The app routes requests to the Anthropic API through Vite's dev server proxy, which handles CORS automatically. As long as you're running `npm run dev` with a valid key in your `.env`, it will work out of the box.

---

## About

These projects are built as part of a practical learning path into agentic AI development — building real, usable tools. The focus is on AI that does meaningful work: extracting structured data from unstructured inputs, generating contextual guidance, and managing state across a user session.

More projects coming.
