const express = require('express');
const router = express.Router();
const followController = require('../controllers/social/followController');
const { authenticate } = require('../middleware/auth');
const { uuidParams, intQueries } = require('../utils/validate');

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

router.get('/:userId/followers', authenticate, uuidParams('userId'), followController.getFollowers);
router.get('/:userId/following', authenticate, uuidParams('userId'), followController.getFollowing);
router.get('/:userId/status', authenticate, uuidParams('userId'), followController.getFollowStatus);

router.post('/:userId', authenticate, uuidParams('userId'), followController.followUser);
router.delete('/:userId', authenticate, uuidParams('userId'), followController.unfollowUser);

module.exports = router;
