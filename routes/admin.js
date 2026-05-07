const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin, validateCsrf } = require('../middleware/auth');
const Confession = require('../models/Confession');
const ConfessionComment = require('../models/ConfessionComment');

router.get('/', isLoggedIn, isAdmin, (req, res) => {
  res.redirect('/admin/confessions');
});

router.get('/confessions', isLoggedIn, isAdmin, (req, res) => {
  const flagged = Confession.listFlagged({ limit: 200 });
  const flaggedComments = ConfessionComment.flagged({ limit: 200 });
  res.render('admin/confessions', {
    title: 'Admin · Flagged content',
    confessions: flagged,
    flaggedComments
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

router.post('/comments/:id/hide', isLoggedIn, isAdmin, validateCsrf, (req, res) => {
  ConfessionComment.hide(parseInt(req.params.id, 10));
  req.session.message = { type: 'success', text: 'Comment hidden.' };
  return res.redirect('/admin/confessions');
});

module.exports = router;
