// Exact production hosts keep branch previews and localhost usable as combined sites.
export const PORTFOLIO_ORIGIN = "https://www.jkivaria.com";
export const TRACKER_ORIGIN = "https://job-tracker-pro-joshhyjr-s-projects.vercel.app";
export const RECOVERY_PATH = "/app/transfer";
export const TRANSFER_CONFIRMED_KEY = "job-tracker-domain-transfer-confirmed-v1";

export function getSiteKind(hostname = window.location.hostname): "portfolio" | "tracker" | "combined" {
  if (["jkivaria.com", "www.jkivaria.com"].includes(hostname.toLowerCase())) return "portfolio";
  if (hostname.toLowerCase() === new URL(TRACKER_ORIGIN).hostname) return "tracker";
  return "combined";
}

export function trackerUrl(path = "/app", hostname = window.location.hostname): string {
  return getSiteKind(hostname) === "portfolio" ? `${TRACKER_ORIGIN}${path}` : path;
}

export function portfolioUrl(hostname = window.location.hostname): string {
  return getSiteKind(hostname) === "tracker" ? `${PORTFOLIO_ORIGIN}/` : "/";
}

export function resolvePortfolioLink(href: string, hostname = window.location.hostname): string {
  // Resolve legacy links at render time, including Firestore-published projects, without rewriting cloud content.
  try {
    const url = new URL(href, PORTFOLIO_ORIGIN);
    if ([new URL(PORTFOLIO_ORIGIN).hostname, "jkivaria.com", new URL(TRACKER_ORIGIN).hostname].includes(url.hostname)
      && (url.pathname === "/app" || url.pathname.startsWith("/app/"))) {
      return trackerUrl(`${url.pathname}${url.search}${url.hash}`, hostname);
    }
  } catch { /* Invalid links remain subject to the portfolio content validator. */ }
  return href;
}
