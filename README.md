# FocusFlow

FocusFlow is an Ionic Angular study and workload app. The Ionic project remains the application runtime; the supplied Expo workflows have been adapted to its existing screens and services.

## Features

- Color-coded academic, freelance, and household tasks with a custom color picker, editable planning details (priority, due date/time, and focus estimate), subtasks, filters, and completion.
- A monthly calendar for task deadlines, a completed-task archive, and dated reminders with their own focus timer lengths.
- Browser notifications for task deadlines and reminders. Grant permission on the Calendar screen; FocusFlow must remain open for scheduled alerts to run.
- Commitment-based focus sessions with a first-action gate, configurable focus and break durations, recovery cycles, and original built-in lo-fi, rain, ocean, forest, cafe, vinyl, binaural, and white-noise audio options. In-app navigation locks during the gate and active focus; users can cancel an unstarted gate. During a session, students can add and check off task steps, see progress, and get a concise focus-block wrap-up before recovery.
- Optional Cascade Recovery Buffer that automatically inserts a protected recovery phase after a focus timer ends (15 minutes every fourth focus block); the toggle is available on Focus and in Settings and is saved on this device.
- Account drawer with editable local profile, accessibility and study preferences, and Help & About.
- Tasks, profile, XP, ambient volume, and preferences saved in the current browser on this device. The task list starts empty.
- Student-friendly subscription and premium-feature preview with proposed monthly and annual prices.
- Canvas assignment sync through a small same-origin Node API.

Task deadlines are optional. Manually entered dates are stored as local calendar dates and shown in the monthly Calendar. Task deadline notifications use the task time, or 9:00 AM local time when only a date is set. Reminders can be scheduled for a date and time and include a focus timer length. Browser notifications require permission and are delivered only while FocusFlow is open; they are not native push notifications and may be delayed if the browser suspends the app.

The first-action gate requires an explicit commitment before the focus timer starts, but it cannot verify that the real-world action was performed. During a running focus block, FocusFlow navigation is locked and the web app pauses the timer when the browser reports that its document has become hidden; the student must resume after returning. The current timer phase and remaining time are saved on this device; after a reload, the session is restored paused and can be resumed (including a protected recovery). An emergency-exit action ends the in-app session and leaves the task open. These are in-app safeguards only: a browser cannot prevent switching to other apps, opening another tab, or closing the browser, and background-event delivery can vary by browser and device. The recovery buffer runs as a non-pausable in-app timer phase and does not yet move scheduled calendar blocks: the current planner stores due dates/times, not planned task start and end times.

## Account, data, and subscription status

Email/password sign-up and login work as local test accounts in the current browser. Sign-up collects first, optional middle, and last name, email, password, and password confirmation. Passwords are never saved in plaintext; the browser stores a salted PBKDF2-SHA-256 hash. Accounts are not uploaded, email ownership is not verified, password reset and Google sign-in are not available, and clearing browser storage removes the accounts. This is demo authentication only—not suitable for production or sensitive credentials. Use a unique test password.

The subscription screen displays proposed pricing of ₱99/month or ₱799/year for Plus, and ₱49/month or ₱399/year for the student plan. These are previews only: checkout, renewals, student verification, and premium entitlements are not implemented. Calendar connections, cloud sync, study groups, and other listed Plus features are planned rather than live services.

## Run locally

Requirements: Node.js 20.11+ or 22.

```bash
npm install
npm start
```

This starts the Angular development server and the local API. Open `http://localhost:4200`.

## Canvas sync

On the Canvas page, create a personal access token in Canvas under **Account → Settings → Approved Integrations**, enter your Canvas host, and choose **Sync assignments**. The token is sent to the same-origin API for that request only, cleared from the form afterward, and never saved by FocusFlow. Sync imports assignments from active courses, handles Canvas pagination, and refreshes imported assignment details on later syncs while preserving your completion status, subtasks, and chosen task color. Imported assignments appear in Your Workload and Focus, and each open assignment has a **Start focus** action that opens the first-action gate for that existing task.

The server only connects to HTTPS Canvas hosts explicitly configured in its allowlist. By default, `canvas.tip.edu.ph` is allowed. To allow your school’s Canvas host, set `CANVAS_ALLOWED_HOSTS` to its exact hostname before starting the app, for example:

```powershell
$env:CANVAS_ALLOWED_HOSTS = "canvas.tip.edu.ph,school.instructure.com"
npm start
```

Canvas access tokens are sent to the API for the sync request and are not stored by FocusFlow.

### Deploying Canvas sync to Vercel

The Canvas endpoint is deployed as a Vercel Function at `/api/canvas/sync` alongside the static Angular app. In the Vercel project, add an Environment Variable named `CANVAS_ALLOWED_HOSTS` for the Production environment containing the exact Canvas hostname(s), comma-separated, for example:

```text
canvas.tip.edu.ph,school.instructure.com
```

Do not use wildcards or include URL paths. The server validates each requested HTTPS host against this allowlist. Redeploy after changing environment variables. The function accepts only POST requests and does not persist the supplied token. Test deployment with a token from an allowed Canvas account; never put tokens in source control or share them in chat.

Vercel deployment requires both the static build and the API function. The proposed plans shown in the app are not payment-related and do not affect Canvas access.

## Production build

```bash
npm run build
```

To serve the built app and API from one origin, run `npm run start:server` with `NODE_ENV=production`, `HOST=0.0.0.0`, and the appropriate `CANVAS_ALLOWED_HOSTS` value configured in the environment. The server binds to `127.0.0.1` by default.

## Capacitor

```bash
npx cap add android
npx cap sync
npx cap open android
```
