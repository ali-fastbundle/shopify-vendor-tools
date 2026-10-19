import { C, S, F, TRACK } from "@/lib/tools";
import NotFoundActions from "@/components/NotFoundActions";

/*
 * The 404, for any address that matches nothing and for every notFound() a
 * route calls (a tool, category or event id that does not exist).
 *
 * It does not dead-end: the box sends the question to the matcher, or to the
 * suggest form if the thing is not listed. A missing page is often somebody
 * looking for a tool we do not have yet, which is the one suggestion worth
 * the most.
 */
export const metadata = {
  title: "Page not found | watchfor.tools",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 640, padding: "0 16px" }}>
        <header style={{ marginTop: S["3xl"] }}>
          <p className="tnum" style={{ fontSize: F.sm, color: C.muted, margin: 0 }}>Error 404</p>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: `${S.xs}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
            Nothing at this address.
          </h1>
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0` }}>
            We checked twice. This is a directory, so checking is most of the job.
          </p>
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0` }}>
            The link may be old, or there is a typo in it. Or the thing you want is not
            listed yet. We would like to hear about that last one.
          </p>
        </header>

        <NotFoundActions />

        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.lg}px 0 ${S["3xl"]}px` }}>
          Or <a href="/" style={{ color: C.accentInk, fontWeight: 600 }}>browse the directory</a>.
        </p>
      </div>
    </main>
  );
}
