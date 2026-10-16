/*
 * The data the alternatives and head-to-head pages share, read once per
 * request. Server only: it reads the store.
 */
import { mergedTools } from "./listings";
import { read } from "./store";
import { rivalPairs } from "./rivals";

export async function rivalsData() {
  const [tools, discovery] = await Promise.all([mergedTools(), read("svt:discovery", {}).catch(() => ({}))]);
  return { tools, pairs: rivalPairs(tools, discovery || {}) };
}
