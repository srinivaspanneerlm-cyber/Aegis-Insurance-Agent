import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * `/api/` is disallowed because there is nothing there for a reader — it takes
 * form submissions and returns JSON. Crawling it wastes budget that should go
 * on the pages that answer questions.
 *
 * Everything else is open on purpose. This site exists to be found by someone
 * searching for an explanation of their own policy.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
