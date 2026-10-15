# Kanso

A minimal, calm, local-first productivity application and daily command center for developers and students.

---

## Why I Built This

I built Kanso because I wanted a fast, distraction-free dashboard to manage daily habits, track LeetCode and Codeforces problem practice, and do focused deep-work sessions—without paying for subscriptions or storing personal routines on third-party servers.

Most productivity web apps require a hosted database and backend API. When deployed on free hosting tiers, the backend sleeps after 15 minutes, resulting in cold-start delays every time you open the app on your phone.

Kanso solves this by running 100% local-first:
- **Zero backend cold-starts:** All tasks, coding logs, focus statistics, and routines live directly in your browser's persistent storage.
- **Serverless API proxies:** LeetCode and Codeforces synchronization is handled directly by Next.js serverless route handlers, avoiding CORS issues without needing a Python server.
- **Private multi-device backup:** Optionally back up encrypted snapshots directly into your personal Google Drive sandbox (`appDataFolder`) using Google OAuth.
- **Mobile PWA:** Installable as a native full-screen app on iOS and Android with offline caching.

---

## What It Does

### Coding Arena
- **52-Week Contribution Heatmap:** GitHub-style activity grid displaying consistency over 16 weeks, 26 weeks, or a full year.
- **LeetCode & Codeforces Auto-Sync:** Enter your handle to pull solved problems, difficulty breakdowns, and recent accepted submissions into your ledger.
- **Problem Logger:** Fast entry form for logging problems across LeetCode, Codeforces, GeeksforGeeks, HackerRank, or custom contest links with editable logs.

### Deep Work Focus Timer
- **Pomodoro Engine:** Configurable work sprint intervals (15m, 25m, 50m, or custom duration).
- **Fullscreen Zen Mode:** Automatically fades away all navigation and controls on cursor idle so you can concentrate purely on the countdown.
- **Audio Hub:**
  - YouTube background player: paste any YouTube live stream or video (e.g. Lofi Girl, ambient).
  - Curated lo-fi web radio and direct `.mp3` stream support.
  - Offline procedural synthesizer: generates Brownian noise, 10Hz binaural alpha brainwaves, and rain sounds using the Web Audio API without using network bandwidth.
- **Anti-Cheat XP:** Focus minutes and XP are only recorded when the timer naturally finishes (`00:00`).

### Tasks, Routines & Notes
- **Rule of 3 Focus:** Set three non-negotiable daily objectives to prevent decision fatigue.
- **Timetable Schedule:** Time-blocked routine tracker with live indicator chips (`Active Now`, `Starts at X`, `Pending`).
- **Calendar Date Picker:** Interactive month/year calendar widget for scheduling habit blocks and setting task due dates.
- **Backlog & Markdown Scratchpad:** Quick-capture checklist and persistent notes for daily thoughts.
- **Balanced XP Economy:** Completing tasks awards XP; unchecking them deducts the exact XP awarded.

### Appearance & Privacy
- **Calm Themes:** Dual themes—**Sumi** (Dark) and **Washi** (Light)—with automatic System mode resolution.
- **Calm Accent Palettes:** 4 refined accent palettes: Pine (default), Ceramic, Sand, and Clay.
- **Google Drive Cloud Vault:** Save and restore your entire data snapshot to your private Google Drive app folder.
- **Reset Safety Gate:** Requires typing `DELETE ALL MY DATA` to purge local records.

---

## Project Structure

```text
go-with-flow/
├── frontend/
│   ├── public/              # Web manifest, icons, service worker (sw.js)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/sync/    # Serverless API routes (LeetCode & Codeforces)
│   │   │   ├── globals.css  # Dark & White mode styling, accent palettes
│   │   │   ├── layout.tsx   # PWA meta tags and font setup
│   │   │   └── page.tsx     # Main dashboard layout and state
│   │   ├── components/
│   │   │   ├── arena/       # Heatmap, ProblemLogger, RecentLogs
│   │   │   ├── focus/       # PomodoroTimer, audio synthesizer, DailyFocusCard
│   │   │   ├── routine/     # RoutineSection timetable
│   │   │   ├── tasks/       # TasksAndNotes (Rule-of-3, backlog, scratchpad)
│   │   │   ├── navigation/  # Header, XP progress, and mobile nav
│   │   │   ├── settings/    # Appearance, Google Drive vault, danger zone
│   │   │   ├── stats/       # AchievementsView and badges
│   │   │   └── ui/          # CalendarPicker and modals
│   │   ├── lib/             # api.ts (local storage engine), driveSync.ts, theme.ts
│   │   └── types/           # TypeScript interfaces
│   ├── package.json
│   └── tsconfig.json
├── package.json             # Root monorepo scripts
├── vercel.json              # Vercel deployment configuration
└── README.md
```

---

## Quickstart

### Prerequisites
- Node.js 18 or higher
- npm

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/go-with-flow.git
   cd go-with-flow
   ```

2. Install dependencies and start the dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Vercel

Because the application is serverless, there are no databases to provision or backend servers to manage.

---

## Installing on Mobile (PWA)

To run Kanso as a standalone mobile app:

- **iOS (Safari):** Open your Vercel URL in Safari → tap Share (`⎋`) → select **Add to Home Screen**.
- **Android (Chrome):** Open your Vercel URL in Chrome → tap the menu (`⋮`) → select **Install App** or **Add to Home Screen**.

The app works offline and launches full-screen like a native application.

---

## Google Drive Cloud Sync (Optional)

If you want cross-device backup between your laptop and phone:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **Google Drive API**.
3. Under **OAuth consent screen**, select **External** and add your Google account to test users.
4. Add the scope: `https://www.googleapis.com/auth/drive.appdata`.
5. Create an **OAuth 2.0 Client ID** (Web application type) and add your deployed Vercel domain and `http://localhost:3000` to **Authorized JavaScript origins**.
6. Add the Client ID to `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
7. In Vercel, add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` under **Project Settings > Environment Variables**.

---

## License

MIT License. Feel free to use and customize for your own workflow.
