"use client";

// The live part of Contribution City: the stats, the 3D city and its timeline. Starts from the data the server
// rendered and switches to newer data from the minute-by-minute poll (lib/live). It's remounted when the data
// changes (keyed by a fingerprint), so the page's count-up and WebGL setup start clean on the new numbers.
import { fmtDay, fmtMonth, summarise, type Day } from "@/lib/contrib";
import type { PullRequest } from "@/lib/content";
import { fingerprint, newer, useLive } from "@/lib/live";
import CityMount from "./gl/CityMount";
import CityTime from "./CityTime";

export const level = (c: number) => (c === 0 ? 0 : c <= 2 ? 1 : c <= 6 ? 2 : c <= 14 ? 3 : 4);
const fills = ["#1b1c1e", "#3a3d35", "#666b5c", "#a5aa98", "#ff2e4c"];
const NO_PRS: PullRequest[] = [];

export default function ActivityLive({ days: initial, fetchedAt }: { days: Day[]; fetchedAt: string }) {
  const days = newer(useLive(), fetchedAt)?.days ?? initial;
  const contrib = summarise(days);
  const weeks = Math.ceil(days.length / 7);
  const cell = 10, gap = 3;
  const w = weeks * (cell + gap) - gap, h = 7 * (cell + gap) - gap;
  return (
      <div className="activity__grid" key={fingerprint({ days, pullRequests: NO_PRS })}>
        <div className="stats">
          <div className="stat stat--xl">
            <span className="hud">Contributions <span>12 mo</span></span>
            <b className="count" data-to={contrib.total}>{contrib.total.toLocaleString("en-US")}</b>
          </div>
          <div className="stat">
            <span className="hud">Active days</span>
            <b><span className="count" data-to={contrib.active}>{contrib.active}</span><small>/{contrib.span}</small></b>
          </div>
          <div className="stat">
            <span className="hud">Longest streak</span>
            <b><span className="count" data-to={contrib.longest}>{contrib.longest}</span><small> days</small></b>
          </div>
          <div className="stat">
            <span className="hud">Best day</span>
            <b className="count" data-to={contrib.best.count}>{contrib.best.count}</b>
            <em className="hud">{fmtDay(contrib.best.date)}</em>
          </div>
          <div className="stat">
            <span className="hud">Busiest month</span>
            <b className="count" data-to={contrib.bestMonthCount}>{contrib.bestMonthCount}</b>
            <em className="hud">{fmtMonth(contrib.bestMonth)}</em>
          </div>
        </div>

        <div className="activity__main">
        <figure className="map" id="cityMap" aria-label="3D chart of daily GitHub contributions">
          <span className="map__corner c1" /><span className="map__corner c2" /><span className="map__corner c3" /><span className="map__corner c4" />
          <div className="map__hud hud" aria-hidden="true">
            <span>Map // <b>Contribution city</b></span>
            <span className="map__help">{weeks} × 7 · drag to orbit · tap a tower</span>
          </div>
          <svg className="map__fallback" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${contrib.total} contributions on ${contrib.active} of ${contrib.span} days`}>
            {days.map((d, i) => (
              <rect key={d.date} x={Math.floor(i / 7) * (cell + gap)} y={(i % 7) * (cell + gap)} width={cell} height={cell} fill={fills[level(d.count)]} />
            ))}
          </svg>
          <CityMount days={days} />
          <div className="map__tip mono" id="cityTip" aria-hidden="true" />
          <figcaption className="map__legend hud">
            <span>Less</span>
            <span className="scale" aria-hidden="true">{fills.map((f) => <i key={f} style={{ background: f }} />)}</span>
            <span>More · red = 15+ in a day</span>
          </figcaption>
        </figure>
        <CityTime days={days} />
        </div>
      </div>
  );
}
