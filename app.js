/**
 * General View On This — Community Platform
 * Express entry point
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const morgan = require('morgan');
const methodOverride = require('method-override');
const path = require('path');

// Database init (creates tables + seeds data)
const { db, seedData } = require('./config/database');

// Passport configuration
const configurePassport = require('./config/passport');
configurePassport(passport);

// Session store
const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Security ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// ─── Logging ──────────────────────────────────────────────────
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// ─── Static Files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── View Engine ──────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Sessions ─────────────────────────────────────────────────
const sessionConfig = {
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.dirname(process.env.DB_PATH || './generalviewonthis.db'),
  }),
  secret: process.env.SESSION_SECRET || 'gvot-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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

// ─── Passport ─────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ─── Global Middleware ─────────────────────────────────────────
const { addUserToLocals, addCsrfToken } = require('./middleware/auth');
app.use(addUserToLocals);
app.use(addCsrfToken);

// Flash messages via session
app.use((req, res, next) => {
  res.locals.message = req.session.message || null;
  delete req.session.message;
  next();
});

// ─── Routes ───────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const orderRoutes = require('./routes/orders');
const surveyRoutes = require('./routes/surveys');
const predictionRoutes = require('./routes/predictions');
const gameRoutes = require('./routes/games');
const reviewRoutes = require('./routes/reviews');
const businessRoutes = require('./routes/business');
const adminRoutes = require('./routes/admin');

// Landing page
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }

  const User = require('./models/User');
  const Business = require('./models/Business');
  const Order = require('./models/Order');
  const Survey = require('./models/Survey');

  const stats = {
    totalBusinesses: Business.getStats().totalBusinesses,
    totalSurveys: Survey.getStats().totalSurveys,
    totalOrders: Order.getStats().totalOrders,
  };

  res.render('landing', { stats });
});

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/orders', orderRoutes);
app.use('/surveys', surveyRoutes);
app.use('/predictions', predictionRoutes);
app.use('/games', gameRoutes);
app.use('/reviews', reviewRoutes);
app.use('/business', businessRoutes);
app.use('/admin', adminRoutes);

// ─── Error Handling ───────────────────────────────────────────
// 404
app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Page Not Found',
    currentUser: req.user || null,
    isAuthenticated: req.isAuthenticated(),
    csrfToken: res.locals.csrfToken,
    message: null,
  });
});

// 500
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

// ─── Seed & Start ─────────────────────────────────────────────
seedData();

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║                                      ║');
  console.log('  ║   🏘️  General View On This is running! ║');
  console.log('  ║                                      ║');
  console.log(`  ║   → Port:        ${String(PORT).padEnd(19)}║`);
  console.log(`  ║   → Environment: ${NODE_ENV.padEnd(19)}║`);
  console.log(`  ║   → Database:    ${(process.env.DB_PATH || './generalviewonthis.db').padEnd(19)}║`);
  console.log(`  ║   → URL:         http://localhost:${PORT}  ║`);
  console.log('  ║                                      ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
