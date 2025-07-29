# Briefo – Perplexity-Powered News & Finance Social App

Briefo is a mobile social media app that delivers an AI-generated newsfeed and company information.  Users can:
* Follow real-time, automatically curated news stories through the Perplexity API and filter through 17 categories.
* Discuss and share articles with friends inside private chats or public comment threads.
* Track a personalised watch-list of companies and request AI-driven financial analyses or recent news.
* Generate deep research reports of companies based on 12 different criteria the user can select from.
* Chat with a general-purpose AI assistant that knows about the user's favorite news and companies.

---
## Table of Contents
1.  [Tech Stack](#tech-stack)
2.  [Installation](#installation)
3.  [Features](#features)
4.  [License](#license)
5.  [Contact](#contact)

---
## Tech Stack

* **Frontend** – React Native with Expo Router (TypeScript).  Single code-base targets iOS, Android, and Web.

* **Backend** – [Supabase](https://supabase.com/) (PostgreSQL, Row-Level Security, Realtime) hosts data and authentication.

* **Supabase Edge Functions (TypeScript on Deno)** – serverless micro-services that call external APIs and write back to the database:
  * `perplexity-news` – generates the daily newsfeed (titles, summaries, links, cover images, categories) with Perplexity and LinkPreview APIs
  * `perplexity-chat` – powers the in-app general AI chat assistant with Perplexity API
  * `perplexity-research` – produces long deep research reports on companies that the user can save with Perplexity API
  * `portfolio-tab-data` – fetches live quote snapshots from the Alpaca API
  * `stock-detail` – deeper company information using the Alpha Vantage API
  * Notification helpers: `create-chat-notification`, `create-friend-request-notification`, `create-accepted-request-notification`, `daily-news-suggestions`

* **Third-Party APIs** – Perplexity AI, Alpaca Market Data, Alpha Vantage, and LinkPreview

* **Hooks** – React-Query style data-fetch hooks inside `lib/` & `hooks/`.

* **Testing** – ESLint, Prettier, Expo Lint.

* **Data** – types folder contains all data tables in Supabase backend

---
## Installation

1. **Clone (private repo):**
   ```bash
   git clone git@github.com:adamblackman/briefo.git
   cd briefo
   ```

2. **Prerequisites**
   * Node 18 LTS+
   * npm
   * Expo CLI (`npm i -g expo-cli`)
   * Supabase CLI (≥ 1.0) for local emulation / function deploys

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Environment variables** – create an `.env` (root) and a `.env.local` under `supabase/` (consumed by edge functions).
   ```env
   # Frontend

   # Edge-function secrets (set via `supabase secrets set` in CI or local dev)
   MY_SUPABASE_URL=https://<project>.supabase.co
   MY_SUPABASE_SERVICE_ROLE_KEY=...
   PERPLEXITY_API_KEY=...
   LINKPREVIEW_API_KEY=...
   ALPACA_API_KEY=...
   ALPACA_SECRET_KEY=...
   ```

6. **Start the Expo dev server**
   ```bash
   npx expo start
   ```
   Then scan the QR code or click i on Mac for iOS simulator

7. **Deploy Edge Functions** (optional)
   ```bash
   supabase functions deploy perplexity-news portfolio-tab-data ...
   ```

---
## Features

* **Newsfeed** – AI generates a fresh set of articles every day automatically through a scheduled cron function.  Each card includes a cover image and an optional link icon that opens the original external source.  Tapping a card opens a full-screen summary that:
  * Shows properly formatted citations linked to the external sources
  * Lets users like 👍 or dislike 👎 the article
  * Provides Share-with-Friend action and a full comment thread where comments themselves have like/dislike counts and allow tapping a commenter's profile to make friends

* **Portfolio** – Displays a personalised list of stocks.  Users can search any symbol and add it to their list.  Selecting a symbol opens **StockDetail** with:
  * Interactive charts for 1D, 1W, 1M, 3M, YTD, 1Y, and 2Y
  * 52-week high / low, market-cap, P/E ratio, and a short company description
  * One-tap options for either an AI financial analysis or a recent-news digest
  * A **Deep Research Report** generator where users pick from 12 criteria – `management`, `competitors`, `outlook`, `risks`, `margins`, `valuation`, `capital_structure`, `research_development`, `revenue_breakdown`, `productivity_metrics`, `m&a_activity`, and `supply_chain` – and the edge function returns a long-form report

* **Chat Page** – Contains:
  * A general Perplexity AI chat that remembers the user's favourite categories, companies, and past conversations
  * A "New Chat" button for creating 1-to-1 or group discussions with friends

* **Profile Page** – Publicly visible profile with avatar, bio, and the user's recent comments.  Here the user can:
  * Manage friends and incoming friend requests (accept / decline)
  * Search for new friends
  * Edit name, username, bio, favourite companies, and preferred news categories

* **Notifications Tab** – Consolidates news suggestions, unread chat messages, new friend requests, and friend-request acceptances into a single feed.

---
## License

```
Copyright © 2025 Adam Blackman.  All rights reserved.

This code-base is proprietary and confidential.  It is supplied solely for evaluation in connection with the specified hackathon.  No licence, express or implied, is granted for any other use, disclosure, reproduction, or distribution.

The hackathon sponsor and Devpost are granted a non-exclusive, fully-paid licence to review, judge, and publicly promote the submission per the event rules for a period of three (3) years.
```
