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
import { person } from "@/lib/content";
import Tour from "@/components/Tour";

// GitHub data (contributions, pull requests, releases) is re-read every hour; see lib/github
export const revalidate = 3600;

export default async function Page() {
  const gh = await getGitHub();
  return (
    <>
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
        <Contact />
      </main>
      <Guide kb={buildKB(gh)} />
      <Tour steps={buildTour(gh)} email={person.email} />
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
