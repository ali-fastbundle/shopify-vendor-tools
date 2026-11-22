/*
 * The data the alternatives and head-to-head pages share, read once per
 * request. Server only: it reads the store, through the page cache
 * (lib/pageData.js), since only those two pages call it.
 */
import * as React from "react";
import { pageTools, pageDiscovery } from "./pageData";
import { rivalPairs } from "./rivals";

const cache = typeof React.cache === "function" ? React.cache : (fn) => fn;

export const rivalsData = cache(async () => {
  const [tools, discovery] = await Promise.all([pageTools(), pageDiscovery().catch(() => ({}))]);
  return { tools, pairs: rivalPairs(tools, discovery || {}) };
});
