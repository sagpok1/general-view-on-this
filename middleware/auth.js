const crypto = require('crypto');

/**
 * Middleware: require user to be logged in.
 * Redirects to /auth/login with a session message if not authenticated.
 */
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.message = { type: 'error', text: 'Please log in to access this page.' };
  return res.redirect('/auth/login');
}

/**
 * Middleware: require user to have a business account.
 * Redirects to /dashboard if account_type is not 'business'.
 */
function isBusinessAccount(req, res, next) {
  if (req.user && req.user.account_type === 'business') {
    return next();
  }
  req.session.message = { type: 'error', text: 'You need a business account to access this page.' };
  return res.redirect('/dashboard');
}

/**
 * Middleware: require user to be an admin.
 * Returns 403 if the user is not an admin.
 */
function isAdmin(req, res, next) {
  if (req.user && req.user.is_admin === 1) {
    return next();
  }
  return res.status(403).render('error', {
    title: 'Forbidden',
    message: 'You do not have permission to access this page.',
    statusCode: 403
  });
}

/**
 * App-level middleware: make current user and auth status available in all views.
 */
function addUserToLocals(req, res, next) {
  res.locals.currentUser = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
}

/**
 * App-level middleware: generate a CSRF token and store it in session/locals.
 * Also reads session messages into res.locals and clears them.
 */
function addCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  // Read session message into locals and clear it
  if (req.session.message) {
    res.locals.message = req.session.message;
    delete req.session.message;
  } else {
    res.locals.message = null;
  }

  next();
}

/**
 * Middleware: validate CSRF token on POST requests.
 * Expects req.body._csrf to match req.session.csrfToken.
 */
function validateCsrf(req, res, next) {
  const token = req.body._csrf;
  if (!token || token !== req.session.csrfToken) {
    req.session.message = { type: 'error', text: 'Invalid or missing security token. Please try again.' };
    return res.redirect('back');
  }
  return next();
}

module.exports = {
  isLoggedIn,
  isBusinessAccount,
  isAdmin,
  addUserToLocals,
  addCsrfToken,
  validateCsrf
};
