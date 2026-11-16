const crypto = require('node:crypto');

function validateFeedback(data, ErrorType) {
  const {category, message, submissionId} = data || {};
  if (!['improvement', 'bug'].includes(category)) throw new ErrorType('invalid-argument', 'Choose an improvement or bug report.');
  if (typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 2000) {
    throw new ErrorType('invalid-argument', 'Enter between 10 and 2,000 characters.');
  }
  if (typeof submissionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(submissionId)) {
    throw new ErrorType('invalid-argument', 'Invalid submission ID.');
  }
  return {category, message: message.trim(), submissionId};
}

function createSubmitFeedback({db, ErrorType, now = Date.now}) {
  return async request => {
    if (!request.auth?.uid) throw new ErrorType('unauthenticated', 'Sign in to send feedback.');
    const payload = validateFeedback(request.data, ErrorType), uid = request.auth.uid;
    const key = crypto.createHash('sha256').update(`${uid}:${payload.submissionId}`).digest('hex');
    const ref = db.collection('private_feedback').doc(key);
    const date = new Date(now()), day = date.toISOString().slice(0, 10);
    const quota = db.collection('feedback_limits').doc(crypto.createHash('sha256').update(uid).digest('hex'));
    return db.runTransaction(async transaction => {
      const existing = await transaction.get(ref);
      if (existing.exists) {
        const saved = existing.data();
        if (saved.category !== payload.category || saved.message !== payload.message) {
          throw new ErrorType('already-exists', 'This submission was already received. Start a new message.');
        }
        return {received: true};
      }
      const limit = await transaction.get(quota), previous = limit.exists ? limit.data() : {};
      const count = previous.day === day ? previous.count : 0;
      if (count >= 5) throw new ErrorType('resource-exhausted', 'You have sent five messages today. Please try again tomorrow (UTC).');
      const accounts = await transaction.get(db.collection('usernames').where('uid', '==', uid).limit(1));
      if (accounts.empty) throw new ErrorType('failed-precondition', 'Finish setting up your account before sending feedback.');
      transaction.create(ref, {uid, username: accounts.docs[0].id, category: payload.category,
        message: payload.message, createdAt: date, updatedAt: date, status: 'new'});
      transaction.set(quota, {day, count: count + 1});
      return {received: true};
    });
  };
}

module.exports = {createSubmitFeedback, validateFeedback};
