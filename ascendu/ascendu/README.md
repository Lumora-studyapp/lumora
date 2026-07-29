# Lumora

Lumora is an independent, Lumora-branded migration of the StudyGrove product
experience. It preserves the source application's layouts, responsive behavior,
navigation, focus timer, Pomodoro mode, checklist, assessments, garden, shops,
backgrounds, analytics, leaderboards, groups, announcements, animations, and
performance optimisations while connecting only to Lumora-owned services.

The source StudyGrove repository and deployment are not runtime dependencies.

## Local development

The application root is this directory (`ascendu/ascendu` from the repository
root), matching Lumora's existing Vercel Root Directory setting.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Available scripts:

- `npm run dev` starts Vite.
- `npm run build` creates the production bundle in `dist`.
- `npm run preview` serves the production bundle locally.

There is no lint script in the migrated source project.

## Required environment variables

Configure the same six values in local `.env.local` and in Lumora's Vercel
Preview and Production environments:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

`VITE_LUMORA_ADMIN_USERNAMES` is optional. It is a comma-separated list of
Lumora usernames allowed to see the admin interface. Firestore additionally
requires `roles/{firebaseUid}` with `{ admin: true }` for privileged writes.

`VITE_LUMORA_AUTH_FUNCTIONS` defaults to `false`. Leave it disabled while
LUMORA uses Firebase's Spark plan. Set it to `true` only after the callable
authentication and recovery functions have been deployed successfully.

Never use StudyGrove's Firebase values in Lumora.

## Firebase identity and compatibility

Lumora continues to use Firebase Authentication and the existing
`usernames/{username}` mapping. On the Firebase Spark plan, the username-first
login screen uses LUMORA's enabled Email/Password provider directly and creates
a deterministic, non-routable Firebase email for new username-only accounts.
Existing Lumora mappings that contain a real login email remain compatible.

An optional callable-functions mode can later:

- verify existing Lumora email/password accounts;
- create independent username-only Firebase Auth accounts when a username does
  not exist;
- return short-lived custom tokens;
- hash recovery answers on the server; and
- change passwords through Firebase Authentication.

No password or password hash is stored by the browser or in a StudyGrove-style
`users` collection.

The overlapping Lumora collections (`prefs`, `history`, weekly/all-time
leaderboards, and `presence`) are reused in place. Existing class, room,
class-board, avatar, XP, and cosmetic data is not deleted. Fields needed by the
copied experience are added lazily with merge writes and safe defaults.

## Firebase deployment

The committed `.firebaserc` pins Firebase CLI operations to the LUMORA project
`lumora-c8437`. Do not replace it with StudyGrove's project ID.

Direct account creation works without Cloud Functions. Review and deploy the
rules and indexes when Firebase CLI access is available:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

If LUMORA is upgraded to a plan that supports Cloud Functions, deploy the
optional recovery backend and then set `VITE_LUMORA_AUTH_FUNCTIONS=true`:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Vercel

Keep the existing Lumora project and settings:

- Root Directory: `ascendu/ascendu`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`

Test the migration on a branch Preview deployment first. Do not promote it to
Production until authentication, existing accounts/data, session writes,
leaderboards, and responsive interactions have been approved.
