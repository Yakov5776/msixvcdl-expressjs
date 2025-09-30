const CONFIG = {
  tokenFilename: "token.json",
  xboxLiveClientId: "00000000402b5328",
  packageServiceBaseUrl: "https://packagespc.xboxlive.com/GetBasePackage/",
  updateServiceAudience: "http://update.xboxlive.com",
  excludedFileExtensions: [".phf", ".xsp"],
  redirectUri: "https://login.live.com/oauth20_desktop.srf",
  microsoftLoginUrl: "https://login.live.com/oauth20_authorize.srf",
  microsoftTokenUrl: "https://login.live.com/oauth20_token.srf",
  xasuUrl: "https://user.auth.xboxlive.com/user/authenticate",
  xstsUrl: "https://xsts.auth.xboxlive.com/xsts/authorize",
  authorizeScope: "service::user.auth.xboxlive.com::MBI_SSL"
};

module.exports = CONFIG;