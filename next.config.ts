import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  experimental: {
    // The film's start script sits in the HTML right after the <video>. With an external stylesheet, browsers hold
    // inline scripts until the CSS arrives, and the app bundle can run first (the audit measured a 488 ms task
    // delaying the film's first frame). Inlining the CSS removes that wait.
    inlineCss: true,
  },
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      {
        // The intro film and stills never change between deploys of the same file name.
        source: "/(video|img)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
