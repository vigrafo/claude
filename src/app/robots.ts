import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_SEARCH_INDEXING !== "true") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  // Auch bei Freigabe: nur öffentliche Präsentationsseiten, nie Mitgliederbereiche.
  return {
    rules: [{ userAgent: "*", allow: ["/$", "/preise", "/hilfe", "/seite/"], disallow: ["/app", "/admin", "/api", "/konto"] }],
  };
}
