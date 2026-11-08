import Activity from "@/components/Activity";
import Contact from "@/components/Contact";
import Experience from "@/components/Experience";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Intro from "@/components/Intro";
import Marquee from "@/components/Marquee";
import OpenSource from "@/components/OpenSource";
import Profile from "@/components/Profile";
import Work from "@/components/Work";

export default function Page() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Intro />
      <Header />
      <main id="main">
        <Hero />
        <Marquee />
        <Work />
        <Activity />
        <OpenSource />
        <Profile />
        <Contact />
      </main>
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
