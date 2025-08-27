const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Subscription plans configuration
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: ['Basic task management', 'Up to 10 tasks', 'Email support']
  },
  pro: {
    name: 'Pro',
    price: 9.99,
    priceId: 'price_pro_monthly', // Replace with actual Stripe price ID
    features: ['Unlimited tasks', 'AI suggestions', 'Priority support', 'Analytics']
  },
  enterprise: {
    name: 'Enterprise',
    price: 29.99,
    priceId: 'price_enterprise_monthly', // Replace with actual Stripe price ID
    features: ['Everything in Pro', 'Team collaboration', 'Advanced analytics', 'Custom integrations']
  }
};

// @route   GET /api/subscriptions/plans
// @desc    Get available subscription plans
// @access  Public
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// @route   GET /api/subscriptions/current
// @desc    Get current user subscription
// @access  Private
router.get('/current', auth, async (req, res) => {
  try {
    const user = req.user;
    const currentPlan = PLANS[user.subscription.plan];
    
    res.json({
      subscription: {
        plan: user.subscription.plan,
        status: user.subscription.status,
        currentPeriodEnd: user.subscription.currentPeriodEnd,
        planDetails: currentPlan
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

