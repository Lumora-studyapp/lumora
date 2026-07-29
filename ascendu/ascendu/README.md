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

Never use StudyGrove's Firebase values in Lumora.

## Firebase identity and compatibility

Lumora continues to use Firebase Authentication and the existing
`usernames/{username}` mapping. The copied username-first login screen calls
Lumora Cloud Functions which:

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

Review and deploy the migration's functions and rules to Lumora's Firebase
project before testing authenticated features:

```bash
cd functions
npm install
cd ..
firebase use YOUR_LUMORA_PROJECT_ID
firebase deploy --only functions,firestore:rules,firestore:indexes
```

Cloud Functions require a Firebase project plan that supports deployments.

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
