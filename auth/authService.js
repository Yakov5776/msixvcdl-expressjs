const querystring = require("querystring");
const CONFIG = require("../config");

/**
 * Generate Microsoft login URL for OAuth
 * @returns {string} Microsoft login URL
 */
function getMicrosoftLoginUrl() {
  const query = querystring.stringify({
    client_id: CONFIG.xboxLiveClientId,
    response_type: "token",
    redirect_uri: CONFIG.redirectUri,
    scope: CONFIG.authorizeScope,
  });
  return `${CONFIG.microsoftLoginUrl}?${query}`;
}

// We don't need this function since you can get access_token directly from URL fragment when doing response_type=token instead of response_type=code
// /**
//  * Exchange authorization code for access/refresh tokens
//  * @param {string} code - Authorization code from Microsoft
//  * @returns {Promise<Object>} Token data
//  */
// async function exchangeCodeForTokens(code) {
//   const body = querystring.stringify({
//     client_id: CONFIG.xboxLiveClientId,
//     code,
//     redirect_uri: CONFIG.redirectUri,
//     grant_type: "authorization_code",
//   });

//   const response = await fetch(CONFIG.microsoftTokenUrl, {
//     method: "POST",
//     headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     body,
//   });

//   if (!response.ok) throw new Error("Failed to exchange code for tokens");
//   return response.json();
// }

/**
 * XASU Authentication (user.auth.xboxlive.com)
 * @param {string} accessToken - Microsoft access token
 * @returns {Promise<Object>} User token response
 */
async function authenticateXASU(accessToken) {
  const body = {
    Properties: {
      AuthMethod: "RPS",
      SiteName: "user.auth.xboxlive.com",
      RpsTicket: `${accessToken}`,
    },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT",
  };

  const res = await fetch(CONFIG.xasuUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-xbl-contract-version": "1",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error("Failed XASU authentication");
  return res.json();
}

/**
 * XSTS Authentication (xsts.auth.xboxlive.com)
 * @param {Object} userToken - User token from XASU
 * @returns {Promise<Object>} XSTS token response
 */
async function authenticateXSTS(userToken) {
  const body = {
    Properties: { UserTokens: [userToken.Token] },
    RelyingParty: CONFIG.updateServiceAudience,
    TokenType: "JWT",
  };

  const res = await fetch(CONFIG.xstsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-xbl-contract-version": "1",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error("Failed XSTS authentication");
  return res.json();
}

/**
 * Complete Xbox Live authentication flow
 * @param {string} accessToken - Microsoft access token
 * @returns {Promise<{userToken: Object, xsts: Object}>} Authentication tokens
 */
async function authenticateXboxLive(accessToken) {
  const userToken = await authenticateXASU(accessToken);
  const xsts = await authenticateXSTS(userToken);
  return { userToken, xsts };
}

module.exports = {
  getMicrosoftLoginUrl,
  authenticateXASU,
  authenticateXSTS,
  authenticateXboxLive,
};