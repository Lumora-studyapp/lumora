# Enabling private feedback

The feedback menu and form are visible, but sending and inbox access are disabled
by default. The verified Firebase project
`lumora-c8437` currently needs a Blaze upgrade before its callable can deploy.
No billing change was made. The deployment attempt compiled the rules but did
not complete. Do not enable submissions until the backend deployment succeeds.

1. Enable Blaze in the Firebase console for **Lumora** (`lumora-c8437`).
2. From this app directory, install the function dependencies with
   `npm --prefix functions install` if they are not already installed.
3. Deploy the additive feedback backend and access controls:
   `npx firebase-tools deploy --project lumora-c8437 --only "functions:submitFeedback,firestore:rules,firestore:indexes"`
4. Wait for the `private_feedback` category/createdAt index to finish building.
   Test authenticated submission, five-per-UTC-day limits, retry receipts, and
   denied non-admin collection reads against the deployed backend.
5. Set `VITE_FEEDBACK_ENABLED=true` in the intended frontend environment and
   rebuild/deploy the frontend. This is a build-time flag. Leave it unset or
   false for environments whose feedback backend is not ready.

Signed-in users find **Suggest an improvement** in the menu, with a clear notice
and disabled Send button until submissions are enabled. Existing
Firebase-role-verified administrators find **Review feedback** in the Admin
Console, showing a readiness notice until enabled. Once enabled, submissions
are private, newest first, with category filtering,
50-row pagination, and New/Reviewed/Closed statuses. There is no public board,
user history, conversation thread, or promised reply.

For rollback, disable the frontend flag and rebuild; the visible form returns
to its unavailable state without backend requests. Keep stored submissions
and restrictive rules intact. No account or study-data migration is needed.

Run `npm test` and `npm run build` before releasing. Local backend tests use a
transactional store double; they do not replace post-deployment authentication
and Firestore permission checks. A Firestore emulator additionally requires
Java, which was unavailable during implementation.
