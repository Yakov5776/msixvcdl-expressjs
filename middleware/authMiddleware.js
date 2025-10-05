const CONFIG = require("../config");

/**
 * Check if request has valid password authentication
 * @param {Object} req - Express request object
 * @returns {boolean} True if authenticated with valid password
 */
function isPasswordAuthenticated(req) {
  const authHeader = req.headers.authorization;
  
  if (!CONFIG.authPassword) {
    return false; // No password configured
  }

  // Check Authorization header (Bearer token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === CONFIG.authPassword;
  }
  
  return false;
}

/**
 * Authentication middleware factory
 * @returns {Function} Express middleware function
 */
function createAuthMiddleware() {
  return (req, res, next) => {
    
    // Always allow root endpoint
    if (req.path === '/') {
      return next();
    }
    
    const hasPasswordAuth = isPasswordAuthenticated(req);
    
    if (CONFIG.publicMode) {
      // Public mode: allow access
      return next();
    } else {
      // Private mode: require password authentication for all non-root endpoints
      if (!hasPasswordAuth) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'This server is in private mode.',
          authMethods: [
            'Authorization header: Bearer <password>'
          ]
        });
      }
      
      return next();
    }
  };
}

module.exports = {
  isPasswordAuthenticated,
  createAuthMiddleware,
};