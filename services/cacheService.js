const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class CacheService {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dbPath = path.join(process.cwd(), 'cache.db');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening cache database:', err);
      } else {
        console.log('Cache database connected');
        this.createTables();
      }
    });
  }

  createTables() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS package_cache (
        product_id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        last_modified_date TEXT NOT NULL,
        files_data TEXT NOT NULL,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Error creating cache table:', err);
      } else {
        console.log('Cache table ready');
      }
    });
  }

  /**
   * Check if cached data exists and is still valid
   * @param {string} productId - Product ID
   * @param {string} lastModifiedDate - Last modified date from products API
   * @returns {Promise<Object|null>} Cached data or null if not valid
   */
  async getCachedPackageData(productId, lastModifiedDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT content_id, files_data, last_modified_date
        FROM package_cache 
        WHERE product_id = ?
      `;

      this.db.get(query, [productId.toUpperCase()], (err, row) => {
        if (err) {
          console.error('Error checking cache:', err);
          reject(err);
          return;
        }

        if (!row) {
          console.log(`No cache found for product ID: ${productId}`);
          resolve(null);
          return;
        }

        // Compare last modified dates
        const cachedDate = new Date(row.last_modified_date);
        const currentDate = new Date(lastModifiedDate);

        if (currentDate > cachedDate) {
          console.log(`Cache expired for product ID: ${productId} (cached: ${cachedDate.toISOString()}, current: ${currentDate.toISOString()})`);
          resolve(null);
          return;
        }

        console.log(`Cache hit for product ID: ${productId}`);
        resolve({
          contentId: row.content_id,
          files: JSON.parse(row.files_data)
        });
      });
    });
  }

  /**
   * Cache package data
   * @param {string} productId - Product ID
   * @param {string} contentId - Content ID
   * @param {string} lastModifiedDate - Last modified date from products API
   * @param {Array} files - Package files array
   */
  async cachePackageData(productId, contentId, lastModifiedDate, files) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO package_cache 
        (product_id, content_id, last_modified_date, files_data)
        VALUES (?, ?, ?, ?)
      `;

      this.db.run(query, [
        productId.toUpperCase(),
        contentId,
        lastModifiedDate,
        JSON.stringify(files)
      ], function(err) {
        if (err) {
          console.error('Error caching data:', err);
          reject(err);
          return;
        }

        console.log(`Cached data for product ID: ${productId}`);
        resolve();
      });
    });
  }

  /**
   * Clear old cache entries (optional cleanup method)
   * @param {number} daysOld - Number of days old to consider for cleanup
   */
  async clearOldCache(daysOld = 30) {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM package_cache 
        WHERE cached_at < datetime('now', '-${daysOld} days')
      `;

      this.db.run(query, function(err) {
        if (err) {
          console.error('Error clearing old cache:', err);
          reject(err);
          return;
        }

        console.log(`Cleared ${this.changes} old cache entries`);
        resolve(this.changes);
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing cache database:', err);
        } else {
          console.log('Cache database closed');
        }
      });
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;