const LocalStrategy = require('passport-local').Strategy;
const { db } = require('./database');
const { verifyPhrase } = require('../lib/recoveryPhrase');

module.exports = function (passport) {
  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser((id, done) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });

  // Strategy verifies phrase only. The route handler additionally checks the
  // urgent-delete password and silently wipes the account if it matches —
  // login form and strategy stay identical so no UI tells the difference.
  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passwordField: 'phrase' },
      (username, phrase, done) => {
        try {
          const cleanUsername = String(username || '').trim();
          if (!cleanUsername) {
            return done(null, false, { message: 'Username or phrase is incorrect.' });
          }
          const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
          if (!user) {
            return done(null, false, { message: 'Username or phrase is incorrect.' });
          }
          if (!verifyPhrase(phrase, user.phrase_hash)) {
            return done(null, false, { message: 'Username or phrase is incorrect.' });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
};
