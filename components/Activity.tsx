import { fmtDay, summarise, type Day } from "@/lib/contrib";
import ActivityLive from "./ActivityLive";

export default function Activity({ days, fetchedAt }: { days: Day[]; fetchedAt: string }) {
  const contrib = summarise(days);
  return (
    <section className="sec activity" id="activity" aria-labelledby="activityTitle">
      <header className="sec__head sec__head--wide">
        <p className="sec__kicker hud"><span className="sq" />02 // 活動 // Player stats</p>
        <h2 className="sec__title split" data-echo="Contribution city" id="activityTitle">Contribution city</h2>
        <p className="sec__lede">Every tower is one day of my commits, pull requests and reviews on GitHub, {fmtDay(contrib.from)} to {fmtDay(contrib.to)}. Live: updates every minute.</p>
      </header>
      <ActivityLive days={days} fetchedAt={fetchedAt} />
    </section>
  );
}
