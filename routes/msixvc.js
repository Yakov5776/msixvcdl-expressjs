const express = require("express");
const authService = require("../auth/authService");
const tokenService = require("../auth/tokenService");
const packageService = require("../services/packageService");
const cacheService = require("../services/cacheService");

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
  const code = req.query.code;
  let access_token;
  let tokenData = null;
  
  if (code) {
    try {
      // Exchange code for tokens
      tokenData = await authService.exchangeCodeForTokens(code);
      access_token = tokenData.access_token;
      console.log('Received tokens from authorization code exchange');
    } catch (err) {
      console.error("Error exchanging code for tokens:", err);
      return res.status(500).send("Failed to exchange code for tokens: " + err.message);
    }
  } else {
    access_token = req.query.access_token;
  }
  
  if (!access_token) {
    return res.status(400).send("Missing access_token in query");
  }

  try {
    // Complete Xbox Live authentication
    const { userToken, xsts } = await authService.authenticateXboxLive(access_token);

    // Save all authentication data including refresh token if available
    const fullState = {
      access_token,
      userToken,
      xsts,
      // Include token data from authorization code exchange if available
      ...(tokenData && {
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        user_id: tokenData.user_id,
        foci: tokenData.foci
      })
    };
    
    tokenService.saveTokens(fullState);

    res.send("Authentication successful! You can now call /msixvc/:contentId");
  } catch (err) {
    console.error("Authentication failed:", err);
    res.status(500).send("Authentication failed: " + err.message);
  }
});

/**
 * Fetch package information for a given content ID or product ID
 */
router.get("/:identifier", async (req, res) => {
  const identifier = req.params.identifier;
  let contentId = identifier;
  let isProductId = false;
  
  // Check if the identifier is a content ID or product ID
  if (packageService.isValidContentId(identifier)) {
    // It's a content ID, use it directly
    contentId = identifier;
  } else if (packageService.isValidProductId(identifier)) {
    // It's a product ID, convert it to content ID
    isProductId = true;
    try {
      console.log(`Converting product ID ${identifier} to content ID...`);
      
      // Fetch products data first (can be used for metadata later)
      const productsData = await packageService.fetchProductsData(identifier);
      if (!productsData) {
        return res.status(404).json({ 
          error: "Could not fetch product data for the given product ID",
          productId: identifier
        });
      }
      
      // Extract content ID from the products data
      contentId = packageService.extractContentIdFromProducts(productsData);
      if (!contentId) {
        return res.status(404).json({ 
          error: "Could not find content ID for the given product ID",
          productId: identifier
        });
      }
      
      console.log(`Product ID ${identifier} converted to content ID: ${contentId}`);
      
      // Store products data for potential metadata use
      req.productsData = productsData;
    } catch (err) {
      console.error("Error converting product ID to content ID:", err);
      return res.status(500).json({ 
        error: "Failed to convert product ID to content ID: " + err.message,
        productId: identifier
      });
    }
  } else {
    return res.status(400).json({ 
      error: "Invalid identifier format. Must be either a valid content ID (UUID) or product ID" 
    });
  }

  try {
    // Refresh tokens if needed (handles both access token and refresh token logic)
    let tokens = await tokenService.refreshTokensIfNeeded();
    if (!tokens) {
      return res.status(401).json({ 
        error: "Not authenticated or token refresh failed. Go to /msixvc/login first" 
      });
    }

    // Check if we already have valid Xbox Live tokens, if not re-authenticate
    let xsts = tokens.xsts;
    if (!xsts || tokenService.needsXboxTokenRefresh(xsts)) {
      console.log("Xbox Live tokens expired, re-authenticating...");
      try {
        const authResult = await authService.authenticateXboxLive(tokens.access_token);
        tokens.userToken = authResult.userToken;
        tokens.xsts = authResult.xsts;
        xsts = authResult.xsts;
        tokenService.saveTokens(tokens);
      } catch (authError) {
        console.error("Xbox Live re-authentication failed:", authError);
        return res.status(401).json({ 
          error: "Xbox Live authentication failed. Please re-authenticate at /msixvc/login" 
        });
      }
    }

    let files, metadata;
    
    // Check cache first if using product ID
    if (isProductId && req.productsData?.Products?.[0]?.LastModifiedDate) {
      const lastModifiedDate = req.productsData.Products[0].LastModifiedDate;
      
      try {
        const cachedData = await cacheService.getCachedPackageData(identifier, lastModifiedDate);
        
        if (cachedData) {
          // Use cached data
          console.log(`Using cached data for product ID: ${identifier}`);
          files = cachedData.files;
          // Always extract fresh metadata since we already have the products data
          metadata = packageService.extractMetadataFromProducts(req.productsData);
        } else {
          // Cache miss or expired - fetch fresh data
          console.log(`Cache miss for product ID: ${identifier}, fetching fresh data`);
          files = await packageService.fetchPackageInfo(contentId, xsts);
          if (!files) {
            return res.status(404).json({ error: "Package not found" });
          }
          
          // Extract metadata
          metadata = packageService.extractMetadataFromProducts(req.productsData);
          
          // Cache only the files (expensive part)
          try {
            await cacheService.cachePackageData(identifier, contentId, lastModifiedDate, files);
          } catch (cacheErr) {
            console.error('Failed to cache data:', cacheErr);
            // Continue anyway - caching failure shouldn't break the request
          }
        }
      } catch (cacheErr) {
        console.error('Cache error, falling back to direct fetch:', cacheErr);
        // Fall back to direct fetch if cache fails
        files = await packageService.fetchPackageInfo(contentId, xsts);
        if (!files) {
          return res.status(404).json({ error: "Package not found" });
        }
        metadata = packageService.extractMetadataFromProducts(req.productsData);
      }
    } else {
      // Direct content ID request or no lastModifiedDate - no caching
      files = await packageService.fetchPackageInfo(contentId, xsts);
      if (!files) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      if (isProductId) {
        metadata = packageService.extractMetadataFromProducts(req.productsData);
      }
    }

    // Prepare response object
    const response = { contentId };
    
    if (isProductId) {
      response.productId = identifier;
      if (metadata) {
        response.metadata = metadata;
      }
    }
    
    response.files = files;
    
    res.json(response);
  } catch (err) {
    console.error("Failed to fetch package:", err);
    res.status(500).json({ error: "Failed to fetch package: " + err.message });
  }
});

module.exports = router;