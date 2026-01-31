export function getLoginUrl(redirectPath?: string): string {
  const appId = import.meta.env.VITE_APP_ID;
  const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const currentUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const callbackUrl = `${currentUrl}/api/oauth/callback`;
  const state = encodeURIComponent(redirectPath || "/");

  return `${portalUrl}?app_id=${appId}&callback_url=${encodeURIComponent(callbackUrl)}&state=${state}`;
}
