# msixvcdl-expressjs

An nodejs/expressjs service that downloads (MSI)XVC packages from Xbox Live services.

### Things it does:

- OAuth authentication with Microsoft/Xbox Live
- Fetch package information and download URLs for MSIXVC packages
- Automatic token management and refresh

### API Endpoints:

`GET /` Shows available API endpoints.

`GET /msixvc/login` Initiates the OAuth flow by redirecting to Microsoft login page which contains `access_token` in final url.

`GET /msixvc/callback` OAuth callback endpoint that handles the authorization token from query parameter `access_token` provided from previous OAuth.

`GET /msixvc/:contentId` Fetches package information and download URLs for the specified content ID, requires `contentId` to be a GUID format content ID (e.g., `51b27c18-6082-4877-8d9f-8b78b1bf356b`)

**Response:**
```json
{
  "contentId": "51b27c18-6082-4877-8d9f-8b78b1bf356b",
  "files": [
    {
      "fileName": "Package.msixvc", // Depending on the package type, it mightn't contain a file extension
      "size": 123456789,
      "url": "https://assets1.xboxlive.com/..."
    }
  ]
}
```

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

### The Usage:

1. Go to `http://localhost:3001/msixvc/login`
2. Redeem `access_token` at `/msixvc/callback?access_token=...`
3. Fetch package info: `GET http://localhost:3001/msixvc/51b27c18-6082-4877-8d9f-8b78b1bf356b`

ConntentId can be found at `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=<product_id>&market=US&languages=en-US,neutral`.


### Credits:
- Created by **[Yakov5776](https://github.com/Yakov5776)**.
- Inspired by **[LukeFZ/MsixvcPackageDownloader](https://github.com/LukeFZ/MsixvcPackageDownloader)** - an interactive C# ConsoleApp alternative.
- MS Authentication API structure taken from **[OpenXbox/xbox-webapi-csharp](https://github.com/OpenXbox/xbox-webapi-csharp/)**.

Licensed under [MIT](/LICENSE).