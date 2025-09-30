const express = require("express");
const authService = require("../auth/authService");
const tokenService = require("../auth/tokenService");
const packageService = require("../services/packageService");

const router = express.Router();

/**
 * Start OAuth flow - redirect to Microsoft login
 */
router.get("/login", (req, res) => {
  const loginUrl = authService.getMicrosoftLoginUrl();
  res.redirect(loginUrl);
});

/**
 * OAuth callback - handle authorization token and complete authentication
 */
router.get("/callback", async (req, res) => {
  const access_token = req.query.access_token;
  if (!access_token) {
    return res.status(400).send("Missing access_token in query");
  }

  try {
    // Complete Xbox Live authentication
    const { userToken, xsts } = await authService.authenticateXboxLive(access_token);

    // Save all authentication data
    const fullState = { access_token, userToken, xsts };
    tokenService.saveTokens(fullState);

    res.send("Authentication successful! You can now call /msixvc/:contentId");
  } catch (err) {
    console.error("Authentication failed:", err);
    res.status(500).send("Authentication failed: " + err.message);
  }
});

/**
 * Fetch package information for a given content ID
 */
router.get("/:contentId", async (req, res) => {
  const contentId = req.params.contentId;
  
  // Validate content ID format
  if (!packageService.isValidContentId(contentId)) {
    return res.status(400).json({ error: "Invalid contentId format" });
  }

  try {
    // Load existing tokens
    let tokens = tokenService.loadTokens();
    if (!tokens || !tokens.access_token) {
      return res.status(401).json({ 
        error: "Not authenticated. Go to /msixvc/login first" 
      });
    }

    // Check if we already have valid Xbox Live tokens, if not re-authenticate
    let xsts = tokens.xsts;
    if (!xsts || tokenService.needsXboxTokenRefresh(xsts)) {
      console.log("Re-authenticating with Xbox Live...");
      const authResult = await authService.authenticateXboxLive(tokens.access_token);
      tokens.userToken = authResult.userToken;
      tokens.xsts = authResult.xsts;
      xsts = authResult.xsts;
      tokenService.saveTokens(tokens);
    }

    // Fetch package information
    const files = await packageService.fetchPackageInfo(contentId, xsts);
    if (!files) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json({ contentId, files });
  } catch (err) {
    console.error("Failed to fetch package:", err);
    res.status(500).json({ error: "Failed to fetch package: " + err.message });
  }
});

module.exports = router;