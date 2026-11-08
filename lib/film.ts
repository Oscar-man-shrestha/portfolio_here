// The intro film: "Who is Oscar?", a 43-second cyber-thriller Oscar made in Google Flow from his photos. The site
// copy has the logo-like emblem cut out and the corner AI mark removed; the footer credits Google Flow instead.
// File names carry a content hash: the site caches /video for a year, so a new cut must never reuse an old address.
export const FILM = {
  /** 1280×720, sound included (the page starts it muted; the Sound button turns it on). */
  wide: "/video/intro-db71f802.mp4",
  /** 406×720 centre crop for tall phone screens. */
  tall: "/video/intro-portrait-0ee9f94e.mp4",
  /** The first frame, shown before playback starts. */
  poster: "/video/poster-b247b0a7.jpg",
  /** His face is first seen clearly, smiling at the laptop: the name card comes in. */
  tName: 34.0,
  /** Every screen in the city has turned red: the red flash cuts to the site and its red sun. */
  tCut: 42.2,
} as const;
