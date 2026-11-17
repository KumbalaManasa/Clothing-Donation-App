const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /notifications — LLD §3.5: any authenticated user, own notifications,
// unread-first (task 7.1). Secondary sort newest-first within each group.
router.get('/', requireAuth, async (req, res) => {
  const notifications = await db('notifications')
    .where({ user_id: req.user.uid })
    .orderBy([
      { column: 'read', order: 'asc' },
      { column: 'created_at', order: 'desc' },
    ]);

  return res.status(200).json(notifications);
});

// POST /notifications/:id/read — LLD §3.5: owner-only.
router.post('/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;

  const notification = await db('notifications').where({ id }).first();
  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }
  if (notification.user_id !== req.user.uid) {
    return res.status(403).json({ message: 'Not the owner of this notification' });
  }

  const [updated] = await db('notifications')
    .where({ id })
    .update({ read: true })
    .returning(['id', 'user_id', 'listing_id', 'type', 'message', 'read', 'created_at']);

  return res.status(200).json(updated);
});

module.exports = router;
