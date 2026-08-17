/**
 * Tell the VHCC marketing site to drop its cached HTML when this catalog is republished.
 *
 * ## Why this exists
 *
 * The marketing site's program pages (vhcc.edu/programs/…) read their credits and their full
 * curriculum from this site's JSON API at render time — `/api/{year}/programs/{page}/{program}.json`
 * — and then cache the rendered page at Cloudflare's edge for a day. Nothing in that chain watches
 * this repository, so without this plugin a catalog correction reaches those pages whenever their
 * `s-maxage` happens to lapse: right eventually, and silently a day stale in the fortnight when it
 * matters most, which is the August rollover.
 *
 * Cloudflare scopes cache purging to the Worker that owns the cache, so this cannot be done from
 * here directly — the marketing site exposes an endpoint and we ask.
 *
 * ## Why `onSuccess` and not `onPostBuild`
 *
 * Timing is the whole correctness argument, and it points the opposite way to intuition.
 *
 * `onPostBuild` runs after the build and **before the deploy is published**. Purging there would be
 * actively worse than not purging at all: the marketing site would drop its pages, a visitor would
 * arrive seconds later, the render would read the *old* JSON still being served, and that stale
 * answer would then be cached for a further twenty-four hours. A purge that fires early converts a
 * one-day delay into a one-day error.
 *
 * `onSuccess` runs **after the deploy is live and published** — it is the same moment Netlify's
 * "Deploy succeeded" notification fires, which is why plugins cannot use it to fail a build. That is
 * exactly the guarantee this needs: by the time we ask for a purge, the new JSON is the JSON anyone
 * fetching it will get.
 *
 * The marketing site closes the other half of the same race from its side, by reading the API with
 * `cache: "no-store"` so a render cannot be served a copy cached before the deploy. Both halves are
 * needed: this one makes the purge late enough, that one makes the read live.
 *
 * ## Configuration
 *
 * Two environment variables, set in Netlify under Site configuration → Environment variables:
 *
 * - `MARKETING_PURGE_URL`    — e.g. `https://www.vhcc.edu/catalog/purge`
 * - `MARKETING_PURGE_SECRET` — the same value as `CATALOG_PURGE_SECRET` on the marketing Worker,
 *                              set there with `wrangler secret put CATALOG_PURGE_SECRET`
 *
 * With either unset the plugin does nothing and says so. That is deliberate: deploy previews and
 * branch builds should not be purging the production site's cache, and the ordinary way to arrange
 * that is to scope the variables to the production context rather than to add a branch check here
 * that would have to be kept in step with Netlify's settings.
 *
 * ## Why a failure here does not fail the deploy
 *
 * It cannot — the deploy is already live by the time this runs. More to the point it should not: the
 * catalog being published is the thing that mattered, and a marketing site that keeps serving
 * yesterday's credits for a few more hours is a smaller problem than a red build that makes somebody
 * think the catalog did not go out. So this reports through the build summary and returns.
 */

/** Long enough for a cold Worker to wake, short enough not to hold the build log open. */
const TIMEOUT_MS = 10_000;

/** The header name the marketing site's purge handler checks. Comes from Taproot's shared constant. */
const SECRET_HEADER = "x-taproot-purge-secret";

export const onSuccess = async ({ utils }) => {
  const url = process.env.MARKETING_PURGE_URL;
  const secret = process.env.MARKETING_PURGE_SECRET;

  if (!url || !secret) {
    console.log(
      "[purge-marketing-site] MARKETING_PURGE_URL or MARKETING_PURGE_SECRET is unset — skipping.",
    );
    return;
  }

  /*
   * `AbortSignal.timeout` rather than a bare fetch: the marketing site is a different provider on a
   * different network, and a build should not be able to hang on it. Node 18+ on Netlify has it.
   */
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        /*
         * **Required, and not because the endpoint reads the body — it does not.**
         *
         * The marketing site is an Astro app, and Astro's CSRF protection (`security.checkOrigin`,
         * on by default) rejects a POST that looks like a browser form submission: no `content-type`
         * at all, or one of the three "simple request" types, with no matching `Origin` header. A
         * server-to-server call sends no `Origin`, so a bare POST is answered **403 by the framework
         * before the purge handler ever runs** — verified against the live route.
         *
         * That failure is nasty precisely because it looks like an authentication problem. It is
         * not: the secret is correct and never gets read. Declaring JSON takes the request out of
         * the simple-request category and the origin check no longer applies.
         *
         * Taproot's own CMS sends exactly this content-type to its sibling route, which is why that
         * one has always worked and why this trap only appears when a second caller is added.
         */
        "content-type": "application/json",
        [SECRET_HEADER]: secret,
      },
      /* Ignored by the handler — it purges everything. Present so the request is honest JSON. */
      body: JSON.stringify({ reason: "catalog-deploy" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const message = `Could not reach the marketing site: ${error.message}`;
    console.warn(`[purge-marketing-site] ${message}`);
    utils.status.show({ title: "Marketing cache not purged", summary: message });
    return;
  }

  /*
   * 404 is called out separately because it is the one failure that looks like success from the
   * outside and has a specific cause: the marketing Worker answers 404 rather than 401 when its own
   * `CATALOG_PURGE_SECRET` is unset, precisely so an unconfigured site does not advertise that there
   * is an endpoint here worth guessing at. Reported as "the other side is not configured" rather
   * than "the URL is wrong", because that is far more often what it means.
   */
  if (response.status === 404) {
    const message =
      "The marketing site answered 404. Either the URL is wrong, or CATALOG_PURGE_SECRET is not " +
      "set on that Worker — it answers 404 rather than 401 when unconfigured.";
    console.warn(`[purge-marketing-site] ${message}`);
    utils.status.show({ title: "Marketing cache not purged", summary: message });
    return;
  }

  if (!response.ok) {
    const message = `The marketing site answered ${response.status}.`;
    console.warn(`[purge-marketing-site] ${message}`);
    utils.status.show({ title: "Marketing cache not purged", summary: message });
    return;
  }

  console.log("[purge-marketing-site] Marketing site cache purged.");
  utils.status.show({
    title: "Marketing cache purged",
    summary: "vhcc.edu program pages will re-read this catalog on their next render.",
  });
};
