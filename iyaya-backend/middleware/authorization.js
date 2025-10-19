// middleware/authorization.js
const checkRole = (allowedRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Please log in first'
      });
    }

    if (req.user.role !== allowedRole) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: ${req.user.role || 'unknown'} cannot access this resource`,
        required: allowedRole
      });
    }

    next();
  };
};

// Backward compatibility
const checkUserType = checkRole;

module.exports = { checkRole, checkUserType };