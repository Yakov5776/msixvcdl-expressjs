const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
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
  fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} New token data
 */
async function refreshAccessToken(refreshToken) {
  const body = querystring.stringify({
    client_id: CONFIG.xboxLiveClientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    redirect_uri: CONFIG.redirectUri,
  });

  const response = await fetch(CONFIG.microsoftTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) throw new Error("Failed to refresh access token");
  return response.json();
}

/**
 * Check if access token needs refreshing
 * @param {Object} tokens - Current token data
 * @returns {boolean} True if token needs refreshing
 */
function needsTokenRefresh(tokens) {
  return !tokens.access_token || (tokens.expires_on && Date.now() / 1000 > tokens.expires_on);
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

module.exports = {
  loadTokens,
  saveTokens,
  refreshAccessToken,
  needsTokenRefresh,
  needsXboxTokenRefresh,
};