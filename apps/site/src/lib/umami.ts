// Analytics is opt-in and carries no identifiers of its own: a build only gets
// the Umami tags when both variables are set, so a clone, a fork or the
// self-hosted nginx image ships no third-party scripts. Set them per project
// (for example in the Cloudflare Pages build environment) to enable tracking.
const src = process.env.UMAMI_SRC?.trim().replace(/\/+$/, "");
const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();

export const umami = src && websiteId ? { src, websiteId } : null;
