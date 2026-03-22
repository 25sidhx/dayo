# Dayo 📅

**Your day, sorted.** A smart college schedule assistant that reads your timetable, tracks attendance, and tells you when to leave.

## 🚀 Live

**[dayo-seven.vercel.app](https://dayo-seven.vercel.app)**

## ✨ Features

- **📸 Timetable Extraction** — Upload a photo of your timetable. Gemini AI reads it and builds your schedule.
- **📊 Attendance Tracker** — Track per-subject attendance with safe-bunk calculations and semester-aware totals.
- **🔔 Morning Briefing** — Daily push notification with class count, first class, and leave time.
- **📅 Schedule View** — Visual timeline of today's classes with bunk/cancel options.
- **🗓️ Timetable Grid** — Full weekday grid like a real college timetable.
- **👥 Batch Share** — Share your timetable with batchmates via 6-digit codes.
- **📱 Mobile-First PWA** — Bottom nav, responsive layout, installable as an app.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (Turbopack), React 19, Tailwind CSS |
| Backend | Next.js API Routes, Firebase Admin SDK |
| Database | Cloud Firestore |
| Auth | Firebase Authentication (Google Sign-In) |
| AI | Google Gemini 2.0 Flash (timetable extraction) |
| Notifications | OneSignal Web Push |
| Deployment | Vercel |

## 🏃 Run Locally

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/dayo.git
cd dayo

# Install
npm install

# Set up environment
cp .env.example .env.local
# Fill in your keys (see .env.example)

# Run
npm run dev
```

Open [localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/
│   ├── (dashboard)/      # Protected pages
│   │   ├── dashboard/    # Main dashboard
│   │   ├── schedule/     # Day-by-day timeline
│   │   ├── timetable/    # Full weekday grid
│   │   ├── attendance/   # Per-subject tracker
│   │   ├── batch-share/  # Share with friends
│   │   └── settings/     # Preferences
│   ├── api/
│   │   ├── extract-schedule/  # Gemini AI extraction
│   │   ├── bunk/              # Attendance math
│   │   ├── admin/deduplicate/ # Data cleanup
│   │   └── cron/morning-briefing/ # Daily notification
│   ├── onboarding/       # First-time setup
│   └── login/            # Auth page
├── components/           # Shared components
├── context/              # Auth context
└── lib/                  # Firebase, utilities
```

## 🔑 Environment Variables

See [`.env.example`](.env.example) for the full list. Key ones:

- `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/app/apikey)
- `NEXT_PUBLIC_ONESIGNAL_APP_ID` — [OneSignal Dashboard](https://dashboard.onesignal.com)
- Firebase keys — [Firebase Console](https://console.firebase.google.com)

## 📄 License

MIT
