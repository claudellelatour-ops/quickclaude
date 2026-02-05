import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../../config/env';

// Configure Google OAuth strategy
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      (accessToken, refreshToken, profile, done) => {
        // Pass the profile to the callback
        return done(null, profile);
      }
    )
  );
}

// Configure Microsoft OAuth strategy
// Note: passport-microsoft needs to be configured similarly
// For simplicity, we'll handle Microsoft OAuth manually if needed

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
