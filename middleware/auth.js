const crypto = require('crypto');

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.session.message = { type: 'error', text: 'Please log in to continue.' };
  return res.redirect('/auth/login');
}

function isAdmin(req, res, next) {
  if (req.user && req.user.is_admin === 1) return next();
  return res.status(403).render('errors/404', {
    title: 'Forbidden',
    message: { type: 'error', text: 'You do not have permission to access this page.' }
  });
}

function addUserToLocals(req, res, next) {
  res.locals.currentUser = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
}

function addCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (req.session.message) {
    res.locals.message = req.session.message;
    delete req.session.message;
  } else {
    res.locals.message = null;
  }
  next();
}

function validateCsrf(req, res, next) {
  const token = req.body._csrf;
  if (!token || token !== req.session.csrfToken) {
    req.session.message = { type: 'error', text: 'Invalid security token. Please try again.' };
    return res.redirect('back');
  }
  return next();
}

module.exports = {
  isLoggedIn,
  isAdmin,
  addUserToLocals,
  addCsrfToken,
  validateCsrf
};
