const fs = require("fs");
const path = require("path");
const authService = require("./authService");
const CONFIG = require("../config");

const tokenPath = path.join(process.cwd(), CONFIG.tokenFilename);

/**
 * Load tokens from file system
 * @returns {Object|null} Token data or null if not found
 */
function loadTokens() {
  if (fs.existsSync(tokenPath)) {
    return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  }
  return null;
}

/**
 * Save tokens to file system
 * @param {Object} data - Token data to save
 */
function saveTokens(data) {
  if (data.expires_in) {
    data.expires_at = Date.now() + (data.expires_in * 1000);
  }
  fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
}


/**
 * Check if access token needs refreshing
 * @param {Object} tokens - Current token data
 * @returns {boolean} True if token needs refreshing
 */
function needsTokenRefresh(tokens) {
  if (!tokens.access_token) return true;
  
  if (tokens.expires_at && Date.now() >= tokens.expires_at) {
    return true;
  }
  
  return false;
}

/**
 * Check if Xbox XSTS token needs refreshing
 * @param {Object} xstsToken - XSTS token data
 * @returns {boolean} True if token needs refreshing
 */
function needsXboxTokenRefresh(xstsToken) {
  if (!xstsToken || !xstsToken.NotAfter) return true;
  
  // Parse NotAfter timestamp and check if expired (add some buffer time)
  const expiryDate = new Date(xstsToken.NotAfter);
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
  return Date.now() >= (expiryDate.getTime() - bufferTime);
}

/**
 * Refresh tokens and Xbox Live authentication if needed
 * @returns {Promise<Object|null>} Refreshed token data or null if refresh failed
 */
async function refreshTokensIfNeeded() {
  const tokens = loadTokens();
  if (!tokens) {
    console.log('No tokens found, authentication required');
    return null;
  }

  // Check if access token needs refresh
  if (needsTokenRefresh(tokens)) {
    console.log('Access token expired, attempting refresh...');
    
    if (!tokens.refresh_token) {
      console.log('No refresh token available, re-authentication required');
      return null;
    }

    try {
      // Refresh the access token
      const newTokenData = await authService.refreshAccessToken(tokens.refresh_token);
      
      // Merge with existing data and preserve Xbox Live tokens temporarily
      const updatedTokens = {
        ...tokens,
        ...newTokenData,
        // Clear Xbox Live tokens since they're tied to the old access token
        userToken: null,
        xsts: null
      };
      
      saveTokens(updatedTokens);
      console.log('Access token refreshed successfully');
      return { ...updatedTokens, refreshed: true };
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      return null;
    }
  }

  return tokens;
}

module.exports = {
  loadTokens,
  saveTokens,
  needsTokenRefresh,
  needsXboxTokenRefresh,
  refreshTokensIfNeeded,
};