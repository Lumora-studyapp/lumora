# StudyGrove shell migration audit

## Repository shape

- Lumora application root: `ascendu/ascendu`
- Lumora entry point: `src/main.jsx` -> `src/App.jsx`
- StudyGrove application root: repository root
- StudyGrove entry point: `src/main.jsx` -> `src/App.jsx`
- Both applications use React 18, React DOM 18, Vite 5, and Firebase 10.
- Lumora also uses Firebase Authentication and callable Cloud Functions. Those integrations remain authoritative.

## Migrated interaction patterns

- StudyGrove's centered `440px` application workspace on larger screens
- StudyGrove's compact top brand, currency, and account-actions row
- StudyGrove's full-width tab strip directly below the header
- The same vertically stacked content flow on desktop and mobile
- Compact progress visibility adapted for Lumora's XP model
- Card, sheet, button, and responsive spacing conventions
- Transform/opacity-only ambient motion with reduced-motion support

## Lumora adaptations

- StudyGrove's garden preview is replaced by a classroom scene.
- The user's growing tree is replaced by Lumora's existing growing person/avatar.
- Live presence is represented by classmates at desks.
- Garden growth language is replaced by classroom and personal-growth language.
- Lumora's existing Living World progression values are used only to determine visual classroom richness.

## Deliberately not migrated

- StudyGrove Firestore collections or document paths
- `studygrove_*` localStorage keys
- Admin usernames or admin console behavior
- Tree skins, enhancement tiers, tree IDs, decorations, or garden layout coordinates
- StudyGrove authentication assumptions and saved passwords
- StudyGrove branding, copy, icons, and botanical assets
- StudyGrove Vite source-replacement plugin

## Compatibility boundary

Lumora keeps its existing Firebase initialization, authentication session, Cloud Function calls, Firestore schema, `ascendu_*` persistence keys, subjects, XP, coins, cosmetics, classes, co-op rooms, presence, badges, targets, and leaderboard behavior. The migrated code is presentational and receives those values through props.

## Deployment notes

- Vercel must use `ascendu/ascendu` as the root directory.
- Keep the current Vite build command (`npm run build`) and output directory (`dist`).
- Copy all existing `VITE_FIREBASE_*` values to the destination Vercel project.
- Confirm the deployed Firebase callable Functions region matches the existing project.
- Keep the existing Firebase project if current users and progress must be preserved.
- Add the new production hostname to Firebase Authentication authorized domains.
