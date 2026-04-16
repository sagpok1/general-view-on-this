const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { db } = require('./database');

module.exports = function (passport) {
  // Serialize user ID into session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session by ID
  passport.deserializeUser((id, done) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });

  // Local strategy: authenticate with email and password
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      (email, password, done) => {
        try {
          const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

          if (!user) {
            return done(null, false, { message: 'No account found with that email.' });
          }

          if (!user.password_hash) {
            return done(null, false, {
              message: 'This account uses Google sign-in. Please log in with Google.'
            });
          }

          const isMatch = bcrypt.compareSync(password, user.password_hash);
          if (!isMatch) {
            return done(null, false, { message: 'Incorrect password.' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Google OAuth 2.0 strategy (only if credentials are configured)
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL;

  if (googleClientId && googleClientSecret && googleCallbackUrl) {
    const GoogleStrategy = require('passport-google-oauth20').Strategy;

    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: googleCallbackUrl
        },
        (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user already exists by google_id
            let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);

            if (user) {
              return done(null, user);
            }

            // Check if a user with the same email already exists
            const email =
              profile.emails && profile.emails.length > 0
                ? profile.emails[0].value
                : null;

            if (email) {
              user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

              if (user) {
                // Link Google account to existing user
                db.prepare('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?').run(
                  profile.id,
                  profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
                  user.id
                );
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
                return done(null, user);
              }
            }

            // Create a new user from Google profile
            const name = profile.displayName || 'Google User';
            const avatarUrl =
              profile.photos && profile.photos.length > 0
                ? profile.photos[0].value
                : null;

            const result = db.prepare(`
              INSERT INTO users (email, google_id, name, account_type, credits, avatar_url, email_verified)
              VALUES (?, ?, ?, 'personal', 0, ?, 1)
            `).run(email, profile.id, name, avatarUrl);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );

    console.log('Google OAuth strategy configured.');
  } else {
    console.warn(
      'Warning: Google OAuth credentials not set. Google sign-in will be unavailable. ' +
      'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL in your environment.'
    );
  }
};
