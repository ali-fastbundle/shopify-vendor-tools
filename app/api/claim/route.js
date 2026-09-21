import { sessionFrom, domainOf, isAdmin } from "@/lib/auth";
import { hasEditorInterest } from "@/lib/tools";
import { allow, ipOf } from "@/lib/ratelimit";
import { catalogueTools } from "@/lib/entries";
import { startClaim, checkDomain, markVerified, getClaims, VERIFY_PREFIX } from "@/lib/listings";
import { sendEvent } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const rootOf = (d) => String(d).replace(/^www\./, "").toLowerCase();

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in first", { status: 401 });

  const ip = ipOf(request);
  if (!(await allow("claim", ip, 15, 60 * 60_000))) {
    return new Response("Too many claim attempts this hour.", { status: 429 });
  }

  const { toolId, action } = await request.json();
  const tool = (await catalogueTools()).find((t) => t.id === toolId);
  if (!tool) return new Response("Unknown tool", { status: 400 });

  /*
   * An entry the editor has a commercial interest in is already controlled by
   * the person who maintains the directory, so there is nobody for a claim to
   * transfer it to. Refused here rather than only hidden in the UI, for the
   * reason invariant 7 gives about /admin: the page not offering a button is a
   * convenience, never the permission. 403 rather than 404, because unlike an
   * admin route this listing is public and there is nothing to be coy about.
   */
  if (hasEditorInterest(tool)) {
    return new Response(
      "This listing cannot be claimed. The directory's editor already controls it, "
      + "which is stated on the entry.",
      { status: 403 },
    );
  }

  const claims = await getClaims();
  const existing = claims[toolId];
  if (existing?.status === "verified" && existing.email !== session.email && !isAdmin(session.email)) {
    return new Response("This listing has already been claimed.", { status: 409 });
  }

  const origin = new URL(request.url).origin;

  /* ---- start: mint a token and tell them what to publish ---- */
  if (action === "start") {
    const { claim, error } = await startClaim(toolId, session.email);
    if (error) return new Response(error, { status: 409 });

    // An email at the tool's own domain is itself proof of control.
    if (rootOf(domainOf(session.email)) === rootOf(tool.domain)) {
      const done = await markVerified(toolId, session.email, "email-domain");
      await sendEvent("claim_verified", {
        origin, toolName: tool.name, domain: tool.domain,
        email: session.email, method: "email-domain",
      });
      return Response.json({ status: "verified", via: "email domain", claim: done });
    }
    return Response.json({
      status: "pending",
      token: claim.token,
      record: VERIFY_PREFIX + claim.token,
      instructions: {
        file: `https://${tool.domain}/.well-known/svt-verify.txt`,
        meta: `<meta name="svt-verify" content="${VERIFY_PREFIX + claim.token}">`,
      },
    });
  }

  /* ---- verify: go and look ---- */
  if (action === "verify") {
    const claim = existing;
    if (!claim || claim.email !== session.email) {
      return new Response("Start the claim first", { status: 400 });
    }
    const result = await checkDomain(tool.domain, claim.token);
    if (!result.ok) {
      return Response.json({
        status: "pending",
        message: `Could not find ${VERIFY_PREFIX + claim.token} on ${tool.domain}. Publish it, wait for your cache to clear, then check again.`,
      }, { status: 200 });
    }
    const done = await markVerified(toolId, session.email, "domain");
    await sendEvent("claim_verified", {
      origin, toolName: tool.name, domain: tool.domain,
      email: session.email, method: "domain", via: result.via,
    });
    return Response.json({ status: "verified", via: result.via, claim: done });
  }

  return new Response("Unknown action", { status: 400 });
}
