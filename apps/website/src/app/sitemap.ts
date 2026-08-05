import type { MetadataRoute } from "next";
import { SITE, SITEMAP_ROUTES } from "@/lib/site";

/**
 * Generated from the route table in `lib/site.ts` rather than typed out here,
 * so a new page cannot be added to the navigation and forgotten in the sitemap
 * — which is the usual way a page ends up unindexed for months.
 *
 * `careers` and `blog` are present but low priority: they are `noindex` today
 * and will stop being so the moment they have content, and a crawler that
 * already knows the URL picks that change up sooner.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return SITEMAP_ROUTES.map((route) => ({
    url: `${SITE.url}${route.path === "/" ? "" : route.path}`,
    lastModified,
    changeFrequency: route.priority >= 0.8 ? "weekly" : "monthly",
    priority: route.priority,
  }));
}
