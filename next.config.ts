import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  /**
   * The visitor module used to live at `/dashboard/gate/*`.
   *
   * These rules are not a courtesy for bookmarks alone. Every notification the
   * backend has written for the last 90 days carries a `link` of the old shape
   * — `/dashboard/gate/log?id=…`, `/dashboard/gate/approvals?id=…` — and the
   * rename does not rewrite rows already in the database. A resident opening a
   * three-week-old "someone is at your door" notice lands here. So these
   * outlive the backend's `/api/v1/gate` alias: retire that after one release,
   * retire these when the oldest notification has aged out.
   *
   * Order matters. Next takes the first match, and `:path*` means *zero* or
   * more segments, so `/dashboard/gate/:path*` also matches the bare
   * `/dashboard/gate` — which would send the console to a directory with no
   * page. The two exact rules therefore come first.
   *
   * `permanent: false` (307) on purpose: a 308 is cached by the browser
   * indefinitely and cannot be taken back if the module ever moves again. The
   * extra round trip is worth staying able to change our mind.
   */
  async redirects() {
    return [
      // The console kept the word "gate" — that is the physical post the guard
      // stands at, which is the correct word. It was the module name that was
      // confusing, not the word.
      {
        source: "/dashboard/gate",
        destination: "/dashboard/visitors/gate-desk",
        permanent: false,
      },
      // There is no index page under /visitors; the console is the landing spot.
      {
        source: "/dashboard/visitors",
        destination: "/dashboard/visitors/gate-desk",
        permanent: false,
      },
      // approvals, blocklist, gates, log, passes, preferences, scan, settings,
      // vehicles. Query strings ride along to the destination automatically,
      // which is what carries the `?id=` on a stored notification link.
      {
        source: "/dashboard/gate/:path*",
        destination: "/dashboard/visitors/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
