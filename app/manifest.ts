import type { MetadataRoute } from "next";

// /manifest.webmanifest: the site's name and icon when it's saved to a phone's home screen
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oscar Man Shrestha · Software Engineer Portfolio",
    short_name: "Oscar Man Shrestha",
    description: "Software engineer working across machine learning, security and the web.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090a",
    theme_color: "#09090a",
    icons: [{ src: "/img/avatar-pixel.webp", sizes: "480x480", type: "image/webp" }],
  };
}
