import type { MetadataRoute } from "next";
import { projects } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

// /sitemap.xml: the home page and every project page, for search engines
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...projects.map((p) => ({ url: `${SITE_URL}/work/${p.id}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
