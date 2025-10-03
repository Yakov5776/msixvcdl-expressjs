# msixvcdl-expressjs

An nodejs/expressjs service that downloads (MSI)XVC packages from Xbox Live services.

### Things it does:

- OAuth authentication with Microsoft/Xbox Live
- Fetch package information and download URLs for MSIXVC packages
- Automatic token management with refresh token support
- SQLite-based caching system for improved performance
- Product metadata extraction from Microsoft Display Catalog
- Support for both Product IDs and Content IDs

### The Usage:

1. Go to `http://localhost:3001/msixvc/login`
2. Redeem `code` at `/msixvc/callback?code=...`
3. Fetch package info: `GET http://localhost:3001/msixvc/<product_id>` e.g. `9PMF91N3LZ3M` 

**ProductId** is preferred for caching purposes but you can also use **ContentId**, `contentId` is required to be a GUID format content ID (e.g., `51b27c18-6082-4877-8d9f-8b78b1bf356b`) and can be found at `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=<product_id>&market=US&languages=en-US,neutral`. 

### API Endpoints:

`GET /` Shows available API endpoints.

`GET /msixvc/login` Initiates the OAuth flow by redirecting to Microsoft login page which contains `code` query token in final url.

`GET /msixvc/callback` OAuth callback endpoint that handles the authorization token from query parameter `code` provided from previous OAuth.

`GET /msixvc/:productId` (or `/:contentId`) Fetches package information and download URLs for the specified product ID

**Example Response:**
```json
{
  "contentId": "51b27c18-6082-4877-8d9f-8b78b1bf356b",
  "productId": "9PMF91N3LZ3M",
  "metadata": {
    "title": "Roblox - Windows",
    "description": "...",
    "publisher": "Roblox Corporation",
    "category": "Action & adventure",
    "ratings": [],
    "originalReleaseDate": "2025-09-11T17:00:00.0000000Z"
  },
  "files": [
    {
      "fileName": "Package.msixvc", // Depending on the package type, it mightn't contain a file extension
      "size": 123456789,
      "url": "https://assets1.xboxlive.com/..."
    }
  ]
}
```

**Note:** `metadata` field is only included when using Product IDs (not Content IDs directly).

### How it works:

The service uses a multi-step OAuth flow with Xbox Live:

1. **Microsoft OAuth** (`/msixvc/login`)
   - Redirects to `https://login.live.com/oauth20_authorize.srf?response_type=...`

2. **Xbox Live User Authentication** (automatic)
   - Calls `https://user.auth.xboxlive.com/user/authenticate`
   - Exchanges Microsoft token for Xbox User token

3. **Xbox Live XSTS Authentication** (automatic)
   - Calls `https://xsts.auth.xboxlive.com/xsts/authorize`
   - Gets XSTS token for package service access

4. **Caching System** (automatic for Product IDs)
   - SQLite database stores package data to reduce Xbox Live API calls
   - Cache invalidation based on `LastModifiedDate` from DisplayCatalog
   - Significantly improves response times for repeated requests

### Credits:
- Created by **[Yakov5776](https://github.com/Yakov5776)**.
- Inspired by **[LukeFZ/MsixvcPackageDownloader](https://github.com/LukeFZ/MsixvcPackageDownloader)** - an interactive C# ConsoleApp alternative.
- MS Authentication API structure taken from **[OpenXbox/xbox-webapi-csharp](https://github.com/OpenXbox/xbox-webapi-csharp/)**.

Licensed under [MIT](/LICENSE).