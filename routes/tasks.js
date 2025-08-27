const express = require('express');
const Task = require('../models/Task');
const { auth, checkSubscription } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/tasks
// @desc    Get all tasks for the authenticated user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, priority, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const userId = req.user._id;

    // Build filter object
    const filter = { userId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const tasks = await Task.find(filter).sort(sort);

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority, dueDate, tags } = req.body;
    const userId = req.user._id;

    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    const task = new Task({
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags,
      userId
    });

    await task.save();

    res.status(201).json({ message: 'Task created successfully', task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, tags } = req.body;
    const userId = req.user._id;

    const task = await Task.findOne({ _id: id, userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (tags !== undefined) task.tags = tags;

    await task.save();

    res.json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const task = await Task.findOneAndDelete({ _id: id, userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/ai-suggestions
// @desc    Get AI suggestions for task (Pro feature)
// @access  Private (Pro+)
router.post('/ai-suggestions', auth, checkSubscription('pro'), async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Task title is required for AI suggestions' });
    }

    // Simulate AI suggestions (in a real app, this would call an AI service)
    const suggestions = generateAISuggestions(title, description);

    res.json({ suggestions });
  } catch (error) {
    console.error('AI suggestions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/analytics
// @desc    Get task analytics (Pro feature)
// @access  Private (Pro+)
router.get('/analytics', auth, checkSubscription('pro'), async (req, res) => {
  try {
    const userId = req.user._id;

    // Get task statistics
    const totalTasks = await Task.countDocuments({ userId });
    const completedTasks = await Task.countDocuments({ userId, status: 'completed' });
    const pendingTasks = await Task.countDocuments({ userId, status: { $ne: 'completed' } });

    // Get tasks by priority
    const tasksByPriority = await Task.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Get tasks by status
    const tasksByStatus = await Task.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get completion rate over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completionTrend = await Task.aggregate([
      { 
        $match: { 
          userId: userId, 
          status: 'completed',
          updatedAt: { $gte: thirtyDaysAgo }
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0,
      tasksByPriority,
      tasksByStatus,
      completionTrend
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to generate AI suggestions
function generateAISuggestions(title, description) {
  const suggestions = {
    priorityReason: '',
    estimatedTime: 0,
    relatedTasks: []
  };

  // Simple AI logic based on keywords
  const text = (title + ' ' + (description || '')).toLowerCase();

  // Priority suggestions
  if (text.includes('urgent') || text.includes('asap') || text.includes('emergency')) {
    suggestions.priorityReason = 'Contains urgent keywords - consider high priority';
    suggestions.priority = 'urgent';
  } else if (text.includes('important') || text.includes('critical')) {
    suggestions.priorityReason = 'Contains important keywords - consider high priority';
    suggestions.priority = 'high';
  } else if (text.includes('later') || text.includes('someday') || text.includes('maybe')) {
    suggestions.priorityReason = 'Contains low-priority keywords - consider low priority';
    suggestions.priority = 'low';
  } else {
    suggestions.priorityReason = 'Standard task - medium priority recommended';
    suggestions.priority = 'medium';
  }

  // Time estimation based on task type
  if (text.includes('meeting') || text.includes('call')) {
    suggestions.estimatedTime = 60; // 1 hour
  } else if (text.includes('email') || text.includes('message')) {
    suggestions.estimatedTime = 15; // 15 minutes
  } else if (text.includes('research') || text.includes('analysis')) {
    suggestions.estimatedTime = 120; // 2 hours
  } else if (text.includes('review') || text.includes('check')) {
    suggestions.estimatedTime = 30; // 30 minutes
  } else {
    suggestions.estimatedTime = 45; // Default 45 minutes
  }

  // Related task suggestions
  if (text.includes('project')) {
    suggestions.relatedTasks = ['Create project timeline', 'Set up project tracking', 'Schedule team meeting'];
  } else if (text.includes('report')) {
    suggestions.relatedTasks = ['Gather data', 'Create outline', 'Review and edit'];
  } else if (text.includes('presentation')) {
    suggestions.relatedTasks = ['Create slides', 'Practice presentation', 'Prepare Q&A'];
  }

  return suggestions;
}

module.exports = router;

