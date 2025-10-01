const CONFIG = require("../config");

/**
 * Fetch products data from Microsoft Display Catalog API
 * @param {string} productId - The product ID to fetch
 * @param {string} market - Market code (default: "US")
 * @param {string} languages - Language codes (default: "en-US,neutral")
 * @returns {Promise<Object|null>} Products data object or null if not found
 */
async function fetchProductsData(productId, market = "US", languages = "en-US,neutral") {
  const displayCatalogUrl = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${productId}&market=${market}&languages=${languages}`;
  
  try {
    const res = await fetch(displayCatalogUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch product info (${res.status})`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching products data:", error);
    throw error;
  }
}

/**
 * Extract content ID from products data
 * @param {Object} productsData - The products data from Display Catalog API
 * @returns {string|null} Content ID or null if not found
 */
function extractContentIdFromProducts(productsData) {
  // Navigate through the response structure to find the content ID
  if (productsData.Products && productsData.Products.length > 0) {
    const product = productsData.Products[0];
    if (product.DisplaySkuAvailabilities && product.DisplaySkuAvailabilities.length > 0) {
      const sku = product.DisplaySkuAvailabilities[0];
      if (sku.Sku && sku.Sku.Properties && sku.Sku.Properties.Packages) {
        const packages = sku.Sku.Properties.Packages;
        if (packages.length > 0) {
          // Look for the main package
          const mainPackage = packages[0];
          if (mainPackage.ContentId) {
            return mainPackage.ContentId;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Convert a product ID to content ID using Microsoft Display Catalog API
 * @param {string} productId - The product ID to convert
 * @param {string} market - Market code (default: "US")
 * @param {string} languages - Language codes (default: "en-US,neutral")
 * @returns {Promise<string|null>} Content ID or null if not found
 */
async function getContentIdFromProductId(productId, market = "US", languages = "en-US,neutral") {
  try {
    const productsData = await fetchProductsData(productId, market, languages);
    return extractContentIdFromProducts(productsData);
  } catch (error) {
    console.error("Error converting product ID to content ID:", error);
    throw error;
  }
}

/**
 * Fetch package information and download URLs for a given content ID
 * @param {string} contentId - The package content ID
 * @param {Object} xsts - XSTS authentication token
 * @returns {Promise<Array|null>} Array of package files or null if not found
 */
async function fetchPackageInfo(contentId, xsts) {
  const updateUrl = CONFIG.packageServiceBaseUrl + contentId;
  const headers = {
    Authorization: `XBL3.0 x=${xsts.DisplayClaims.xui[0].uhs};${xsts.Token}`,
  };

  const res = await fetch(updateUrl, { headers });
  if (!res.ok) throw new Error(`Failed to fetch package info (${res.status})`);

  const updateData = await res.json();
  if (!updateData.PackageFound || !updateData.PackageFiles) return null;

  return filterAndFormatPackageFiles(updateData.PackageFiles);
}

/**
 * Filter out excluded files and format package file data
 * @param {Array} packageFiles - Raw package files from API
 * @returns {Array} Formatted package files
 */
function filterAndFormatPackageFiles(packageFiles) {
  return packageFiles
    .filter((file) =>
      !CONFIG.excludedFileExtensions.some((ext) =>
        file.FileName.toLowerCase().endsWith(ext)
      )
    )
    .map((file) => {
      const downloadUrl =
        file.CdnRootPaths?.length > 0
          ? file.CdnRootPaths[0] + file.RelativeUrl
          : null;
      return { 
        fileName: file.FileName, 
        size: file.FileSize, 
        url: downloadUrl 
      };
    });
}

/**
 * Validate content ID format
 * @param {string} contentId - Content ID to validate
 * @returns {boolean} True if valid UUID format
 */
function isValidContentId(contentId) {
  return /^[0-9a-fA-F-]{36}$/.test(contentId);
}

/**
 * Validate product ID format
 * @param {string} productId - Product ID to validate
 * @returns {boolean} True if valid product ID format (alphanumeric, may contain dots)
 */
function isValidProductId(productId) {
  // Product IDs are typically alphanumeric with dots, like "9WZDNCRFJ3TJ"
  return /^[0-9A-Za-z.]+$/.test(productId) && productId.length >= 8;
}

/**
 * Extract metadata from products data
 * @param {Object} productsData - The products data from Display Catalog API
 * @returns {Object|null} Formatted metadata object or null if no data
 */
function extractMetadataFromProducts(productsData) {
  if (!productsData?.Products?.[0]) return null;
  
  const product = productsData.Products[0];
  const localizedProps = product.LocalizedProperties?.[0];
  const properties = product.Properties;
  const marketProps = product.MarketProperties?.[0];
  
  return {
    // Basic Information
    title: localizedProps?.ProductTitle || 'Unknown',
    shortTitle: localizedProps?.ShortTitle,
    publisher: localizedProps?.PublisherName || 'Unknown',
    developer: localizedProps?.DeveloperName,
    description: localizedProps?.ProductDescription,
    shortDescription: localizedProps?.ShortDescription,
    
    // Product Details
    category: properties?.Category || 'Unknown',
    categories: properties?.Categories || [],
    packageFamilyName: properties?.PackageFamilyName,
    publisherId: properties?.PublisherId,
    
    // Release and Update Info
    originalReleaseDate: marketProps?.OriginalReleaseDate,
    lastModifiedDate: product.LastModifiedDate,
    minimumAge: marketProps?.MinimumUserAge,
    
    // Usage Statistics
    ratings: marketProps?.UsageData?.map(usage => ({
      timeSpan: usage.AggregateTimeSpan,
      averageRating: usage.AverageRating,
      ratingCount: usage.RatingCount,
      playCount: usage.PlayCount
    })) || [],
    
    // Links
    links: {
      publisherWebsite: localizedProps?.PublisherWebsiteUri,
      supportUri: localizedProps?.SupportUri,
      supportPhone: localizedProps?.SupportPhone,
    },
    
    // Market Info
    markets: localizedProps?.Markets || [],
    
    // Search Terms
    searchHints: localizedProps?.SearchTitles?.filter(t => t.SearchTitleType === 'SearchHint')
      .map(t => t.SearchTitleString) || []
  };
}

module.exports = {
  fetchPackageInfo,
  filterAndFormatPackageFiles,
  isValidContentId,
  fetchProductsData,
  extractContentIdFromProducts,
  extractMetadataFromProducts,
  getContentIdFromProductId,
  isValidProductId,
};