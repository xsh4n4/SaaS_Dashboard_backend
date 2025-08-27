const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Middleware to check subscription level
const checkSubscription = (requiredPlan) => {
  return (req, res, next) => {
    const planHierarchy = { free: 0, pro: 1, enterprise: 2 };
    const userPlan = req.user.subscription.plan;
    const userPlanLevel = planHierarchy[userPlan];
    const requiredPlanLevel = planHierarchy[requiredPlan];

    if (userPlanLevel < requiredPlanLevel) {
      return res.status(403).json({ 
        message: `This feature requires a ${requiredPlan} subscription`,
        currentPlan: userPlan,
        requiredPlan: requiredPlan
      });
    }

    next();
  };
};

module.exports = { auth, checkSubscription };

