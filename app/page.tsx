import Activity from "@/components/Activity";
import Contact from "@/components/Contact";
import Experience from "@/components/Experience";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Intro from "@/components/Intro";
import Marquee from "@/components/Marquee";
import Guide from "@/components/Guide";
import OpenSource from "@/components/OpenSource";
import Profile from "@/components/Profile";
import Work from "@/components/Work";
import { getGitHub } from "@/lib/github";
import { buildKB } from "@/lib/guide-kb";
import { buildTour } from "@/lib/tour";
import type { Metadata } from "next";
import { links, person, stack } from "@/lib/content";
import { SITE_URL } from "@/lib/site";
import Tour from "@/components/Tour";
import Ctf from "@/components/Ctf";
import { CTF_CIPHER, CTF_HASH, CTF_TRANSMISSION } from "@/lib/ctf";

// GitHub data (contributions, pull requests, releases) is re-read every hour; see lib/github
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Search data: a ProfilePage about Oscar (schema.org Person), and the WebSite itself, so search engines show his name
 * as the site's name. Only facts and links the site itself shows.
 */
function searchData() {
  const sameAs = links.filter((l) => l.url).map((l) => l.url!);
  const knowsAbout = [...person.disciplines, ...stack.slice(0, 2).flatMap((s) => s.items.slice(0, 4))];
  const id = `${SITE_URL}/#person`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: `${SITE_URL}/`,
      name: "Oscar Man Shrestha · Software Engineer Portfolio",
      mainEntity: {
        "@type": "Person",
        "@id": id,
        name: person.name,
        alternateName: ["Oscar Shrestha", "oscarmanshrestha"],
        givenName: "Oscar",
        familyName: "Man Shrestha",
        jobTitle: person.role,
        description: person.about,
        url: `${SITE_URL}/`,
        image: `${SITE_URL}/og.png`,
        email: `mailto:${person.email}`,
        address: { "@type": "PostalAddress", addressLocality: person.base.split(",")[0], addressCountry: "IN" },
        sameAs,
        knowsAbout,
      },
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: person.name, alternateName: ["Oscar Man Shrestha Portfolio", "oscarmanshrestha"], url: `${SITE_URL}/`, author: { "@id": id } },
  ];
}

export default async function Page() {
  const gh = await getGitHub();
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(searchData()).replace(/</g, "\\u003c") }} />
      <a className="skip-link" href="#main">Skip to content</a>
      <Intro />
      <Header />
      <main id="main">
        <Hero prCount={gh.pullRequests.length} />
        <Marquee />
        <Work releases={gh.releases} />
        <Activity days={gh.days} />
        <OpenSource pullRequests={gh.pullRequests} fetchedAt={gh.fetchedAt} />
        <Profile />
        <Contact fetchedAt={gh.fetchedAt} />
      </main>
      <Guide kb={buildKB(gh)} />
      <Tour steps={buildTour(gh)} email={person.email} />
      <Ctf hash={CTF_HASH} email={person.email} />
      {/* the puzzle's stage 2 and 3 (React 19 moves these into <head>) */}
      <meta name="oms:transmission" content={CTF_TRANSMISSION} />
      <meta name="oms:cipher" content={CTF_CIPHER} />
      <div className="grain" aria-hidden="true" />
      <div className="cursor" aria-hidden="true">
        <span className="cursor__frame" />
        <span className="cursor__cross" />
        <span className="cursor__read" />
      </div>
      <Experience />
    </>
  );
}
