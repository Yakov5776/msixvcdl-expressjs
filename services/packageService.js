const CONFIG = require("../config");

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

module.exports = {
  fetchPackageInfo,
  filterAndFormatPackageFiles,
  isValidContentId,
};