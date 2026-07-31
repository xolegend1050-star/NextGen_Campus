const express = require('express');
const router = express.Router();
const followController = require('../controllers/social/followController');
const { authenticate } = require('../middleware/auth');

router.get('/online', authenticate, (req, res) => {
  const io = req.app.get('io');
  const onlineUsers = req.app.get('onlineUsers');
  if (onlineUsers) {
    res.json({ online_user_ids: Array.from(onlineUsers.keys()) });
  } else {
    res.json({ online_user_ids: [] });
  }
});

router.get('/discover', authenticate, followController.discoverUsers);
router.get('/suggestions', authenticate, followController.getSuggestions);
router.get('/feed', authenticate, followController.getFeed);

router.get('/:userId/followers', authenticate, followController.getFollowers);
router.get('/:userId/following', authenticate, followController.getFollowing);
router.get('/:userId/status', authenticate, followController.getFollowStatus);

router.post('/:userId', authenticate, followController.followUser);
router.delete('/:userId', authenticate, followController.unfollowUser);

module.exports = router;
