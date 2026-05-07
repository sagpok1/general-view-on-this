const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin, validateCsrf } = require('../middleware/auth');
const Confession = require('../models/Confession');

router.get('/', isLoggedIn, isAdmin, (req, res) => {
  res.redirect('/admin/confessions');
});

router.get('/confessions', isLoggedIn, isAdmin, (req, res) => {
  const flagged = Confession.listFlagged({ limit: 200 });
  res.render('admin/confessions', {
    title: 'Admin · Flagged confessions',
    confessions: flagged
  });
});

router.post('/confessions/:id/hide', isLoggedIn, isAdmin, validateCsrf, (req, res) => {
  Confession.hide(parseInt(req.params.id, 10));
  req.session.message = { type: 'success', text: 'Confession hidden.' };
  return res.redirect('/admin/confessions');
});

router.post('/confessions/:id/restore', isLoggedIn, isAdmin, validateCsrf, (req, res) => {
  Confession.restore(parseInt(req.params.id, 10));
  req.session.message = { type: 'success', text: 'Confession restored.' };
  return res.redirect('/admin/confessions');
});

module.exports = router;
