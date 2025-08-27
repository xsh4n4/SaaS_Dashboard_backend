const express = require('express');
const User = require('../models/User');
const { auth, checkSubscription } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/stats
// @desc    Get user statistics (pro feature)
// @access  Private (Pro+)
router.get('/stats', auth, checkSubscription('pro'), async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user's task statistics
    const Task = require('../models/Task');
    const totalTasks = await Task.countDocuments({ userId });
    const completedTasks = await Task.countDocuments({ userId, status: 'completed' });
    const pendingTasks = await Task.countDocuments({ userId, status: { $ne: 'completed' } });
    
    // Calculate completion rate
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;
    
    // Get tasks by priority
    const tasksByPriority = await Task.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    
    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentTasks = await Task.countDocuments({
      userId,
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRate: parseFloat(completionRate),
      tasksByPriority,
      recentTasks,
      memberSince: req.user.createdAt,
      lastLogin: req.user.lastLogin
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

