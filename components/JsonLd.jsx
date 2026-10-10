import React from "react";
import { withSiteNodes } from "@/lib/seo";

/*
 * The one way a page emits structured data. It adds the site, organization
 * and author nodes the page's graph refers to (withSiteNodes), so no page can
 * point at a node it does not define, and it escapes "<" so a string in the
 * data can never close the script tag early. Server-rendered, no state.
 */
export default function JsonLd({ data }) {
  const json = JSON.stringify(withSiteNodes(data)).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
