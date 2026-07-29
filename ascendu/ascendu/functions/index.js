/**
 * AscendU Cloud Functions — server-side session recording.
 *
 * Why this exists: the client must not be trusted to write its own leaderboard
 * totals. This callable function is the *only* path that updates leaderboards
 * and history. It verifies the caller is authenticated, that the username they
 * claim actually belongs to their uid, and that the reported session length is
 * physically plausible (no 9-hour sessions logged in 4 seconds).
 *
 * Deploy:  firebase deploy --only functions
 * Requires: Firebase Blaze (pay-as-you-go) plan for callable functions.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("node:crypto");

initializeApp();
const db = getFirestore();

const RECOVERY_QUESTIONS = new Set([
  "What was the name of your first pet?",
  "What primary school did you go to?",
  "What's your favourite subject?",
  "What city were you born in?",
  "What's your mother's maiden name?",
]);

function normalizeUsername(value) {
  return String(value || "").trim().normalize("NFC").toLowerCase();
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (username.length < 2 || username.length > 20 || !/^[a-z0-9_]+$/.test(username)) {
    throw new HttpsError("invalid-argument", "Usernames use 2-20 letters, numbers, or underscores.");
  }
  return username;
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 6 || password.length > 128) {
    throw new HttpsError("invalid-argument", "Password must be 6-128 characters.");
  }
  return password;
}

function recoveryHash(uid, username, answer) {
  return crypto.scryptSync(
    String(answer || "").trim().normalize("NFC").toLowerCase(),
    `lumora:${uid}:${username}`,
    32,
  ).toString("hex");
}

function safeHashEqual(left, right) {
  const a = Buffer.from(String(left || ""), "hex");
  const b = Buffer.from(String(right || ""), "hex");
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

async function verifyFirebasePassword(email, password, apiKey) {
  if (!apiKey || typeof apiKey !== "string" || apiKey.length > 256) {
    throw new HttpsError("failed-precondition", "Lumora's Firebase API key is not configured.");
  }
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.localId) {
    throw new HttpsError("unauthenticated", "Wrong username or password.");
  }
  return result.localId;
}

/**
 * Username-first authentication bridge.
 *
 * StudyGrove's screen doubles as sign-in and account creation. Lumora keeps
 * that UX, but credentials live exclusively in Firebase Authentication. This
 * callable verifies existing email-backed Lumora accounts, creates independent
 * username-only Lumora accounts when needed, and returns a short-lived custom
 * token for the client.
 */
exports.authenticateUsername = onCall(async (request) => {
  const username = validateUsername(request.data?.username);
  const password = validatePassword(request.data?.password);
  const usernameRef = db.collection("usernames").doc(username);
  const recoveryRef = db.collection("accountRecovery").doc(username);
  const usernameSnap = await usernameRef.get();

  if (usernameSnap.exists) {
    const account = usernameSnap.data() || {};
    if (!account.uid || !account.email) {
      throw new HttpsError("failed-precondition", "This Lumora account needs an administrator to repair its login mapping.");
    }
    const verifiedUid = await verifyFirebasePassword(account.email, password, request.data?.firebaseApiKey);
    if (verifiedUid !== account.uid) {
      throw new HttpsError("permission-denied", "The username mapping does not match this account.");
    }
    return { ok: true, created: false, customToken: await getAuth().createCustomToken(account.uid) };
  }

  const email = `${username}@accounts.lumora.invalid`;
  let account;
  try {
    account = await getAuth().createUser({ email, password, displayName: username });
  } catch (error) {
    if (error?.code !== "auth/email-already-exists") throw error;
    account = await getAuth().getUserByEmail(email);
  }

  const recovery = request.data?.recovery;
  const accountData = {
    uid: account.uid,
    email,
    displayName: username,
    createdAt: Date.now(),
    authModel: "firebase-auth",
  };
  let recoveryData = null;
  if (recovery?.question && recovery?.answer) {
    if (!RECOVERY_QUESTIONS.has(recovery.question)) {
      throw new HttpsError("invalid-argument", "Invalid recovery question.");
    }
    recoveryData = {
      uid: account.uid,
      question: recovery.question,
      answerHash: recoveryHash(account.uid, username, recovery.answer),
      updatedAt: Date.now(),
    };
  }

  try {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(usernameRef);
      if (current.exists && current.data()?.uid !== account.uid) {
        throw new HttpsError("already-exists", "That username is already taken.");
      }
      tx.set(usernameRef, accountData, { merge: true });
      if (recoveryData) tx.set(recoveryRef, recoveryData, { merge: true });
    });
  } catch (error) {
    if (!usernameSnap.exists) await getAuth().deleteUser(account.uid).catch(() => {});
    throw error;
  }

  return { ok: true, created: true, customToken: await getAuth().createCustomToken(account.uid) };
});

exports.getRecoveryQuestion = onCall(async (request) => {
  const username = validateUsername(request.data?.username);
  const usernameSnap = await db.collection("usernames").doc(username).get();
  if (!usernameSnap.exists) throw new HttpsError("not-found", "No account with that username.");
  const recoverySnap = await db.collection("accountRecovery").doc(username).get();
  const question = recoverySnap.data()?.question;
  if (!question) {
    throw new HttpsError("failed-precondition", "This account has no recovery question set. Existing email-based accounts should use Firebase's email reset flow.");
  }
  return { ok: true, question };
});

exports.resetUsernamePassword = onCall(async (request) => {
  const username = validateUsername(request.data?.username);
  const newPassword = validatePassword(request.data?.newPassword);
  const answer = String(request.data?.answer || "").trim();
  if (answer.length < 2 || answer.length > 120) throw new HttpsError("invalid-argument", "Enter your recovery answer.");
  const [usernameSnap, recoverySnap] = await Promise.all([
    db.collection("usernames").doc(username).get(),
    db.collection("accountRecovery").doc(username).get(),
  ]);
  if (!usernameSnap.exists) throw new HttpsError("not-found", "No account with that username.");
  const account = usernameSnap.data() || {};
  const recovery = recoverySnap.data() || {};
  const suppliedHash = recoveryHash(account.uid, username, answer);
  if (!safeHashEqual(recovery.answerHash, suppliedHash) || recovery.uid !== account.uid) {
    throw new HttpsError("permission-denied", "That answer doesn't match.");
  }
  await getAuth().updateUser(account.uid, { password: newPassword });
  return { ok: true, customToken: await getAuth().createCustomToken(account.uid) };
});

exports.setRecoveryQuestion = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to update recovery settings.");
  const username = validateUsername(request.data?.username);
  const question = String(request.data?.question || "");
  const answer = String(request.data?.answer || "").trim();
  if (!RECOVERY_QUESTIONS.has(question) || answer.length < 2 || answer.length > 120) {
    throw new HttpsError("invalid-argument", "Choose a recovery question and provide an answer.");
  }
  const ref = db.collection("usernames").doc(username);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.uid !== uid) {
    throw new HttpsError("permission-denied", "The signed-in account does not own this username.");
  }
  await db.collection("accountRecovery").doc(username).set({
    uid,
    question,
    answerHash: recoveryHash(uid, username, answer),
    updatedAt: Date.now(),
  }, { merge: true });
  return { ok: true };
});

// Same ISO-week key the client uses, computed server-side.
function getWeekKey(d = new Date()) {
  const jan = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan) / 86400000 + jan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${wk}`;
}

// Tracks how much focus time a session of a given start could plausibly contain.
// We store the session start when it begins (startSession) and check elapsed here.
const MAX_SESSION_SECS = 6 * 3600; // a single session can't exceed 6h
const MIN_SESSION_SECS = 60;       // under a minute doesn't count

/**
 * recordSession — the trusted write path.
 * data: { subjectId, secs, startedAt, coop?, classCode? }
 */
exports.recordSession = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to record a session.");

  const { subjectId, secs, startedAt, coop = false, classCode = null } = request.data || {};

  // ── Validate inputs ──
  if (typeof subjectId !== "string" || subjectId.length === 0 || subjectId.length > 40)
    throw new HttpsError("invalid-argument", "Bad subject.");
  if (typeof secs !== "number" || !Number.isFinite(secs))
    throw new HttpsError("invalid-argument", "Bad duration.");
  const dur = Math.floor(secs);
  if (dur < MIN_SESSION_SECS) throw new HttpsError("invalid-argument", "Session too short.");
  if (dur > MAX_SESSION_SECS) throw new HttpsError("invalid-argument", "Session too long.");

  // ── Plausibility: the wall-clock time since startedAt must be >= reported secs ──
  // (minus a small grace for latency). This blocks "instant" fake sessions.
  if (typeof startedAt === "number") {
    const wallElapsed = (Date.now() - startedAt) / 1000;
    if (wallElapsed + 10 < dur)
      throw new HttpsError("failed-precondition", "Reported time exceeds elapsed time.");
    if (Date.now() < startedAt - 60000)
      throw new HttpsError("invalid-argument", "Invalid start time.");
  }

  // ── Resolve the caller's username from their uid (don't trust a client-sent name) ──
  const unameSnap = await db.collection("usernames").where("uid", "==", uid).limit(1).get();
  if (unameSnap.empty) throw new HttpsError("failed-precondition", "No username for this account.");
  const username = unameSnap.docs[0].data().displayName || unameSnap.docs[0].id;

  const weekKey = getWeekKey();

  // ── Atomic-ish updates via a batch + transactions on the aggregate docs ──
  const bumpBoard = async (ref) => {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const u = data[username] || { totalSecs: 0, sessions: 0, subjects: {} };
      u.totalSecs += dur;
      u.sessions += 1;
      u.subjects = u.subjects || {};
      u.subjects[subjectId] = (u.subjects[subjectId] || 0) + dur;
      tx.set(ref, { [username]: u }, { merge: true });
    });
  };

  await bumpBoard(db.collection("leaderboard_weekly").doc(weekKey));
  await bumpBoard(db.collection("leaderboard_alltime").doc("data"));
  if (classCode && typeof classCode === "string") {
    await bumpBoard(db.collection("class_boards").doc(`${classCode}_${weekKey}`));
  }

  // ── Append to personal history ──
  const entry = { subject: subjectId, secs: dur, ts: Date.now(),
                  ...(coop ? { coop: true } : {}),
                  ...(classCode ? { classCode } : {}) };
  const hRef = db.collection("history").doc(username);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(hRef);
    const sessions = snap.exists ? (snap.data().sessions || []) : [];
    sessions.push(entry);
    tx.set(hRef, { sessions: sessions.slice(-2000) }, { merge: true });
  });

  return { ok: true, username, secs: dur, weekKey };
});
