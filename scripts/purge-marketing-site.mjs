/**
 * Tell the VHCC marketing site to drop its cached HTML after this catalog is republished.
 *
 * Ported from the Netlify build plugin in plugins/purge-marketing-site/, which cannot run on
 * Cloudflare. Nothing invokes this yet — run it by hand (`npm run purge:marketing`) or add it as a
 * CI step. Three constraints carried over from the original, each learned the hard way:
 *
 * 1. **Run this only after the deploy is live.** The marketing site's program pages read
 *    /api/{year}/programs/... at render time and cache the result for a day. Purging before the new
 *    JSON is being served makes the site re-render against the *old* data and cache that for another
 *    24 hours — turning a one-day delay into a one-day error. Netlify's `onSuccess` guaranteed this
 *    ordering; Cloudflare Builds has no equivalent hook, so whatever calls this must guarantee it
 *    instead. Do not move this into the build command.
 *
 * 2. **The content-type header is required**, even though the endpoint ignores the body. The
 *    marketing site is an Astro app with `security.checkOrigin` on, which rejects a POST that looks
 *    like a browser form submission (no content-type, or a "simple request" type) when no Origin
 *    header is present — as is the case server-to-server. Without it the framework answers 403
 *    before the purge handler runs, which reads like an auth failure but is not.
 *
 * 3. **A 404 means the other side is unconfigured**, not that the URL is wrong. The marketing Worker
 *    answers 404 rather than 401 when its own CATALOG_PURGE_SECRET is unset, so an unconfigured site
 *    does not advertise the endpoint.
 *
 * Configuration — with either unset this does nothing, so non-production contexts stay inert:
 *   MARKETING_PURGE_URL     e.g. https://www.vhcc.edu/catalog/purge
 *   MARKETING_PURGE_SECRET  matches CATALOG_PURGE_SECRET on the marketing Worker
 *
 * Exits 0 even on failure: the catalog being published is what mattered, and a marketing site
 * serving yesterday's credits for a few more hours is a smaller problem than a red pipeline that
 * makes somebody think the catalog did not go out.
 */

const TIMEOUT_MS = 10_000;
const SECRET_HEADER = "x-taproot-purge-secret";

const url = process.env.MARKETING_PURGE_URL;
const secret = process.env.MARKETING_PURGE_SECRET;

if (!url || !secret) {
  console.log(
    "[purge-marketing-site] MARKETING_PURGE_URL or MARKETING_PURGE_SECRET is unset — skipping.",
  );
  process.exit(0);
}

let response;
try {
  response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [SECRET_HEADER]: secret,
    },
    body: JSON.stringify({ reason: "catalog-deploy" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
} catch (error) {
  console.warn(`[purge-marketing-site] Could not reach the marketing site: ${error.message}`);
  process.exit(0);
}

if (response.status === 404) {
  console.warn(
    "[purge-marketing-site] The marketing site answered 404. Either the URL is wrong, or " +
      "CATALOG_PURGE_SECRET is not set on that Worker — it answers 404 rather than 401 when " +
      "unconfigured.",
  );
} else if (!response.ok) {
  console.warn(`[purge-marketing-site] The marketing site answered ${response.status}.`);
} else {
  console.log(
    "[purge-marketing-site] Cache purged — vhcc.edu program pages will re-read this catalog on " +
      "their next render.",
  );
}
