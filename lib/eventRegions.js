/*
 * Regions for the monthly events digest. A subscriber picks one when they sign
 * up, so somebody in Europe does not get a digest that is mostly North America.
 *
 * An event's region comes from its country, through the table below, because
 * a country is what the organiser states and a table is easy to check. Where
 * the country is missing or not in the table, the city-level coordinates from
 * lib/eventCoords.js decide it, by rough boxes. An online event belongs to
 * every region: where you are does not decide whether you can attend.
 *
 * Pure and client-safe: the follow box imports the list.
 */
export const REGIONS = [
  ["all", "All events"],
  ["europe", "Europe"],
  ["north-america", "North America"],
  ["latin-america", "Latin America"],
  ["asia-pacific", "Asia and Pacific"],
  ["middle-east-africa", "Middle East and Africa"],
];

export const regionLabel = (id) => (REGIONS.find(([r]) => r === id) || [])[1] || "";
export const isRegion = (id) => REGIONS.some(([r]) => r === id);

const COUNTRY = {
  europe: ["UK", "United Kingdom", "Ireland", "France", "Germany", "Netherlands", "Belgium", "Luxembourg",
    "Spain", "Portugal", "Italy", "Switzerland", "Austria", "Poland", "Czechia", "Czech Republic", "Slovakia",
    "Hungary", "Romania", "Bulgaria", "Greece", "Croatia", "Slovenia", "Serbia", "Denmark", "Sweden", "Norway",
    "Finland", "Iceland", "Estonia", "Latvia", "Lithuania", "Ukraine", "Türkiye", "Turkey", "Cyprus", "Malta"],
  "north-america": ["USA", "United States", "Canada"],
  "latin-america": ["Mexico", "Brazil", "Argentina", "Chile", "Colombia", "Peru", "Uruguay", "Costa Rica"],
  "asia-pacific": ["India", "Vietnam", "Singapore", "Australia", "New Zealand", "Japan", "South Korea", "China",
    "Hong Kong", "Taiwan", "Indonesia", "Malaysia", "Thailand", "Philippines", "Pakistan", "Bangladesh", "Sri Lanka"],
  "middle-east-africa": ["UAE", "United Arab Emirates", "Saudi Arabia", "Qatar", "Israel", "Egypt", "Jordan",
    "South Africa", "Nigeria", "Kenya", "Morocco", "Ghana"],
};
const BY_COUNTRY = Object.fromEntries(Object.entries(COUNTRY).flatMap(([r, cs]) => cs.map((c) => [c.toLowerCase(), r])));

/* Rough boxes, for an event whose country the table does not know. */
function regionFromCoords(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  if (lng < -30) return lat > 15 ? "north-america" : "latin-america";
  if (lat > 35 && lng < 45) return "europe";
  if (lng >= 60 || (lat < 0 && lng > 100)) return "asia-pacific";
  return "middle-east-africa";
}

export const isOnline = (e = {}) => /\b(online|virtual|remote)\b/i.test(`${e.city || ""} ${e.venue || ""} ${e.format || ""}`);

/** "europe", "north-america", ..., "online", or "" when nothing says. */
export function regionOf(e = {}) {
  if (isOnline(e)) return "online";
  return BY_COUNTRY[String(e.country || "").trim().toLowerCase()] || regionFromCoords(e.lat, e.lng);
}

/** Whether a subscriber to `region` hears about this event. */
export function inRegion(e, region) {
  if (!region || region === "all") return true;
  const r = regionOf(e);
  return r === "online" || r === region;
}
