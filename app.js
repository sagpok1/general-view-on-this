/**
 * General View On This — anonymous wellness/confessions platform.
 * Express entry point.
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const morgan = require('morgan');
const methodOverride = require('method-override');
const path = require('path');

const { db, seedData } = require('./config/database');

const configurePassport = require('./config/passport');
configurePassport(passport);

const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
    },
  },
}));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const sessionConfig = {
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.dirname(process.env.DB_PATH || './generalviewonthis.db'),
  }),
  secret: process.env.SESSION_SECRET || 'gvot-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
  },
  name: 'gvot.sid',
};

if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

const { addUserToLocals, addCsrfToken } = require('./middleware/auth');
app.use(addUserToLocals);
app.use(addCsrfToken);

app.use((req, res, next) => {
  res.locals.message = res.locals.message || (req.session.message || null);
  if (req.session.message) delete req.session.message;
  next();
});

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const confessionRoutes = require('./routes/confessions');
const moodRoutes = require('./routes/mood');
const companionRoutes = require('./routes/companion');
const surveyRoutes = require('./routes/surveys');
const predictionRoutes = require('./routes/predictions');
const gameRoutes = require('./routes/games');
const settingsRoutes = require('./routes/settings');
const adminRoutes = require('./routes/admin');

app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.render('landing');
});

app.get('/about', (req, res) => res.render('static/about'));
app.get('/privacy', (req, res) => res.render('static/privacy'));

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/confessions', confessionRoutes);
app.use('/mood', moodRoutes);
app.use('/companion', companionRoutes);
app.use('/surveys', surveyRoutes);
app.use('/predictions', predictionRoutes);
app.use('/games', gameRoutes);
app.use('/settings', settingsRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Page Not Found',
    currentUser: req.user || null,
    isAuthenticated: req.isAuthenticated(),
    csrfToken: res.locals.csrfToken,
    message: null,
  });
});

app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).render('errors/500', {
    title: 'Server Error',
    currentUser: req.user || null,
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    csrfToken: res.locals.csrfToken || '',
    message: null,
  });
});

seedData();

app.listen(PORT, () => {
  console.log('');
  console.log('  General View On This is running');
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → ${NODE_ENV} mode`);
  console.log('');
});

module.exports = app;
