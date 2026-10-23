/*
 * Events.
 *
 * The fifth catalogue and the fifth shape. An event is not a tool, a
 * newsletter or a podcast with different words in it: it is judged on when it
 * is, where it is, who is actually in the room, and who is selling what to
 * whom while you are there. Most of what an app vendor wants to know about a
 * conference is in that last clause, which is why `watch` matters here as much
 * as anywhere.
 *
 * Shared with every other kind, because it is the directory's editorial
 * contract: `id`, `name`, `url`, `one`, `watch`, `social`, `updated`, `draft`.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 *  id            permanent, and per series rather than per edition, so the
 *                next edition is an edit to the dates and not a new entry.
 *  name          as the organiser calls it, edition year included where the
 *                organiser includes it.
 *  organizer     who runs it.
 *  dateRaw       the date as the organiser states it. It is the label for an
 *                imprecise date, so it is never reformatted into something
 *                that looks more certain than it is.
 *  datePrecision "exact" | "month" | "season" | "year" | "unknown".
 *  startDate     YYYY-MM-DD for exact, YYYY-MM for month and season (the
 *                season's first month), YYYY for year, null for unknown.
 *  endDate       YYYY-MM-DD, exact only. Absent on a one-day event.
 *  lastHeld      optional, YYYY-MM-DD. The last edition whose date is known,
 *                for an entry whose next date is not. It is what an inferred
 *                placement is computed from, and it is always shown next to it.
 *  annual        optional. At least two consecutive yearly editions were found,
 *                or the organiser has said there will be another. Only an
 *                annual series gets an inferred date: a meetup that runs
 *                several times a year has no anniversary to infer from, and
 *                a one-off has no next edition at all.
 *  discontinued  optional. The organiser has stopped running it. Listed as
 *                past, never as unscheduled: "no date yet" and "no more
 *                dates" are different answers.
 *  launched      the first edition of the series, from the organizer's own
 *                pages: "YYYY-MM-DD", "YYYY-MM", "YYYY" or "unknown". Shown as
 *                "First held 2016". Never computed from an edition count.
 *                lib/launched.js.
 *  city, country, venue
 *  audience      who it is for, in the organiser's words.
 *  attendees     optional. The organiser's own claim, stated as one.
 *  relevance     "high" | "medium" | "low": for an app vendor, checked
 *                against the event's own site rather than imported.
 *  focus         what the programme is about.
 *  url, one, watch, social, updated, draft
 *  domain        optional. The site whose favicon stands in for a logo. Set by
 *                hand, never derived from `url`, because a good share of these
 *                are listed on Eventbrite or Luma and the favicon of the
 *                ticketing platform is not the event's mark. Absent means
 *                straight to the lettermark.
 *  logo          optional path under /public/logos/, from the organiser's own
 *                site. Same chain as tools: logo, favicon, lettermark.
 *  calendarUrl   optional. The organiser's own page listing its current events,
 *                declared by hand and never guessed. The monthly refresh
 *                (lib/eventRefresh.js) checks the event is still on it.
 *  format        optional: "in-person", "online" or "hybrid". Absent reads as
 *                in-person. An online event reaches every region of the
 *                monthly digest (lib/eventRegions.js).
 *  notes         internal research notes. Never rendered.
 *
 * There is deliberately no `status` field. Past, imminent and upcoming are a
 * function of the date and today, and a stored status is wrong from the day
 * after it is written: the spreadsheet these came from had a Status column
 * that was already wrong for six of them. `placeEvent` derives it at render.
 */

import { published } from "./drafts";
import { EVENT_COORDS as COORDS } from "./eventCoords";

export const ALL_EVENTS = [
  /* ---------------------------------------------------------------- */
  /*  Built for people who build on Shopify                            */
  /* ---------------------------------------------------------------- */
  {
    id: "dotdev",
    name: "DotDev",
    organizer: "Shopify",
    ownership: { id: "shopify", name: "Shopify" },
    dateRaw: "Next edition not announced. Last held 21 to 22 July 2026",
    datePrecision: "unknown",
    startDate: null,
    lastHeld: "2026-07-21",
    annual: true,
    city: "Toronto",
    country: "Canada",
    venue: "105 Princes' Blvd",
    audience: "Shopify developers, app builders and partners",
    relevance: "high",
    focus: "Shopify's developer conference",
    url: "https://dotdev.shopify.com/",
    domain: "dotdev.shopify.com",
    one: "shopify's own developer conference, attended by the platform's engineering teams",
    watch: "Tickets were $499, and the 2026 edition sold out with a waitlist. So the hard part is getting a ticket, not the price. No date for the next one yet. The site only offers a sign-up for news about it.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "2026: Jul 21-22, sold out. Third parties report a cap of six tickets per partner org and that it replaced Editions.dev; neither is on Shopify's page.",
  },
  {
    id: "the-wide-event",
    name: "The Wide Event",
    organizer: "Mat De Sousa",
    /* He runs The Wide Company (lib/owners.js), which makes WideBundle and
       AppstorePulse. The event is his, so the line names him and the owner
       page states the relationship. Checked 2026-10-23. */
    ownership: { id: "the-wide-company", name: "Mat De Sousa", verb: "organized by",
      note: "Organized by Mat De Sousa, who runs The Wide Company." },
    dateRaw: "Next edition not announced. Last held 18 May 2026",
    datePrecision: "unknown",
    startDate: null,
    lastHeld: "2026-05-18",
    annual: true,
    city: "Paris",
    country: "France",
    venue: "",
    audience: "Shopify merchants, app founders, agencies and developers",
    attendees: "250",
    relevance: "high",
    focus: "Shopify partner meetup",
    url: "https://www.eventbrite.fr/e/the-wide-event-2026-a-shopify-partner-event-for-merchants-and-partners-tickets-1730972929629",
    one: "a paris meetup for people who build shopify apps or sell on shopify, run by an app vendor",
    watch: "Run by Mat De Sousa, whose company makes WideBundle, a bundle app, and AppstorePulse, an App Store tracker listed here. So a bundle app or a rank tracker vendor who attends is at a competitor's event. It is announced through Eventbrite and his personal X account, so the next date is usually announced late. Held in May in 2024, 2025 and 2026, at a different venue each year.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-23",
    notes: "2024-05-27 Le Salon des Miroirs; 2025-05-12 Espace Saint Martin (200, organiser X); 2026-05-18 Kimpton St Honore (250 tickets).",
  },
  {
    id: "shop-quest",
    name: "Shop Quest",
    organizer: "FoxSell",
    dateRaw: "Next edition not announced. Last held 3 October 2026",
    datePrecision: "unknown",
    startDate: null,
    lastHeld: "2026-10-03",
    annual: true,
    city: "Bengaluru",
    country: "India",
    venue: "JW Marriott Bengaluru",
    audience: "Shopify developers, founders, agencies, freelancers and commerce builders",
    relevance: "high",
    focus: "Shopify developer and builder event, India",
    url: "https://foxsell.com/pages/shop-quest",
    domain: "shop-quest.com",
    one: "india's shopify builder event, for developers, agencies and app founders",
    watch: "Run by FoxSell, which sells a Shopify bundle app. A bundle app vendor who attends is attending a competitor's event. The 2026 edition sold out, and no ticket price was shown.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "2026-10-03 JW Marriott (organiser page, shop-quest.com). 2025 reportedly 2025-09-27 Ritz-Carlton Bangalore, search snippet only. Sponsors included STOQ, Shopify, Tiny SEO, Zapiet, Appmaker.",
  },
  {
    id: "nexfal-freelancers-meetup",
    name: "Shopify Freelancers Meetup by Nexfal",
    organizer: "Nexfal",
    dateRaw: "Sunday 25 October 2026, 10:00 to 12:00",
    datePrecision: "exact",
    startDate: "2026-10-25",
    endDate: "2026-10-25",
    city: "Surat",
    country: "India",
    venue: "",
    audience: "Shopify freelance developers, who get first priority for seats",
    relevance: "low",
    focus: "Shopify freelancer meetup, Surat",
    url: "https://luma.com/4xug5i4e",
    domain: "nexfal.com",
    one: "a free two-hour morning meetup for shopify freelance developers in surat, run by an app vendor",
    watch: "Run by Nexfal, which sells the Shopify apps Rivyo, Wishlist Club and Editly. Its partner program pays developers and agencies up to 20% commission for referrals. So the people in the room are the people Nexfal wants to sign up. Seats need the host's approval, and the address is shown only after you register.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-17",
    notes: "From the Luma event data on 2026-10-17: start_at 2026-10-25T04:30Z, end 06:30Z, Asia/Kolkata (10:00 to 12:00 local), offline, Naginawadi, Surat, Gujarat. Free, require_approval true, 5 going. Host Nexfal, website nexfal.com, instagram thenexfal. Page calls it private and invite-only. Nexfal apps and partner program (up to 20% commission, 20% lifetime affiliate) from nexfal.com and nexfal.com/pages/partner, same day. No earlier editions found on the page. domain is the organiser's own site, since the event has none.",
  },

  {
    id: "shopify-partner-meetup-warsaw",
    name: "Shopify Partner Meetup Warsaw",
    organizer: "Shopify",
    ownership: { id: "shopify", name: "Shopify" },
    dateRaw: "Wednesday 21 October 2026, 14:00 to 17:00",
    datePrecision: "exact",
    startDate: "2026-10-21",
    endDate: "2026-10-21",
    city: "Warsaw",
    country: "Poland",
    venue: "Google Campus, Plac Konesera 10",
    audience: "Shopify partners in Warsaw",
    relevance: "high",
    focus: "Shopify partner meetup with a keynote and networking",
    url: "https://shopifypartnermeetupwarsaw.splashthat.com/",
    domain: "shopify.com",
    one: "an afternoon meetup in warsaw for shopify partners, run by shopify",
    watch: "Sign-up is a waitlist, so a place is not confirmed. The one partner talk is Synerise, on its own Shopify integration. The page gives no price and no size. Its page description still says Montréal, so the page was copied from another city's meetup.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-20",
    notes: "Splash page read 2026-10-20 in a browser. 21 Oct 2026, doors 13:30, keynote with Shopify 14:00, Synerise x Shopify Integration 14:30, break 15:15, networking 15:45, close 17:00. Google Campus, Plac Konesera 10, Warszawa. RSVP button reads Add To Waitlist. Meta description: 'Montreal's partner community is building something special' (template reuse). No year-on-year history found, so not annual.",
  },

  /* ---------------------------------------------------------------- */
  /*  Shopify merchant events with app vendors in the room             */
  /* ---------------------------------------------------------------- */
  {
    id: "dtc-aperitivo",
    name: "The DTC Aperitivo",
    organizer: "Zipchat",
    dateRaw: "Wednesday 23 September 2026, 17:30 to 20:00",
    datePrecision: "exact",
    startDate: "2026-09-23",
    endDate: "2026-09-23",
    city: "London",
    country: "UK",
    venue: "The Cocktail Club Canary Wharf, 9 Cabot Square",
    audience: "Ecommerce brands, agencies, and apps and software, including Shopify app teams",
    attendees: "150",
    relevance: "medium",
    focus: "An evening drinks event during eCommerce Expo London, no talks",
    url: "https://dtcaperitivo.com/",
    domain: "dtcaperitivo.com",
    one: "a free evening drinks event in london during ecommerce expo, hosted by app and service vendors",
    watch: "Run by the vendors who sell to the people in the room: Zipchat and ABsolutely host it, with Omnisend, Thrivelia, hypefill and FForder as co-hosts. It names Shopify app teams in its audience. There are no talks, so the value is who turns up. The site gives no earlier edition and does not say it will run again.",
    social: {},
    launched: "unknown", /* no earlier edition on the site (checked 2026-10-23) */
    updated: "2026-10-23",
    notes: "dtcaperitivo.com read 2026-10-23. 'Wednesday 23 September 2026', 5:30pm to 8pm, The Cocktail Club Canary Wharf, 9 Cabot Square, London E14 4EB. Free, 'Drinks and finger food are on the hosts'. Expo pass not required. RSVP, capacity 150, confirmed by email. Footer: 'Hosted by Zipchat and ABsolutely', during eCommerce Expo London 23 to 24 September 2026, ExCeL. Co-hosts Omnisend (stand E10), Thrivelia, hypefill (E12), FForder. Audience: brands, agencies, 'Apps and software (Shopify app teams, ecommerce software vendors)'. No social links for the event itself. Not annual: no past edition stated.",
  },
  {
    id: "holiday-a-list",
    name: "The Holiday A-List",
    organizer: "Shoplift",
    dateRaw: "Tuesday 8 December 2026, 19:00 to 22:00 EST",
    datePrecision: "exact",
    startDate: "2026-12-08",
    endDate: "2026-12-08",
    city: "New York",
    country: "USA",
    venue: "Zero Bond, 0 Bond St",
    audience: "Founders, senior brand and ecommerce leaders, influencer marketers, creators and partners",
    attendees: "50 to 60",
    relevance: "medium",
    focus: "Holiday gala with audience-voted ecommerce awards",
    url: "https://luma.com/gaext4tb",
    domain: "shoplift.ai",
    one: "a small new york holiday gala for brand and ecommerce leaders, with audience-voted awards, run by a shopify app",
    watch: "Run by Shoplift, which sells an A/B testing app for Shopify. The room is 50 to 60 guests, and every request needs the host's approval. An app vendor gets in mainly as a sponsor, one per category, with two guest places. The 15 awards are for brands and people, voted by the audience, and none is for an app. This is the first edition, and the date has already moved once, from 11 to 8 December.",
    social: {},
    launched: "2026", /* first edition. holiday-a-list.fondfly1.chatgpt.site/: "THE 2026 FOUNDING CLASS ... the inaugural class" (checked 2026-10-23) */
    updated: "2026-10-23",
    notes: "Luma event data read again 2026-10-23: start 2026-12-09T00:00Z, end 03:00Z, America/New_York, so Tuesday 2026-12-08 19:00-22:00 EST (it was Friday 2026-12-11 18:30-21:30 on 2026-10-21; the page had said the date might move within the second week of December). Gala site (holiday-a-list.fondfly1.chatgpt.site) read 2026-10-21. Zero Bond, 0 Bond St, NYC 10012. Free Standard ticket, approval required. Host on Luma: Raynee Henderson (Raynee@Shoplift.ai). 50-60 invited guests. 15 audience-voted awards in Brands, People, Standout work, plus a Golden 'Ecommerce Leader of the Year'; self-nomination allowed; 'Sponsors receive visibility, not influence over the results.' Sponsorship is category-exclusive (wanted: creators and affiliates, subscriptions, marketing, analytics, CX, commerce, fulfillment), with two guest places. 'Founding Class of 2026', so the first edition; not annual. Shoplift (shoplift.ai): Shopify A/B testing, Shopify Plus Certified App, claims 2,000+ Plus brands. Not added to awards: no category an app vendor can enter.",
  },
  {
    id: "shopify-meetup-dublin",
    name: "Shopify Meetup Dublin 2026",
    organizer: "Vevol Media",
    dateRaw: "Thursday 22 October 2026, 18:00 to 21:00",
    datePrecision: "exact",
    startDate: "2026-10-22",
    endDate: "2026-10-22",
    annual: true,
    city: "Dublin",
    country: "Ireland",
    venue: "Liberties Suite, Aloft Dublin City",
    audience: "Merchants, agencies, software providers and freelancers working on Shopify stores in Ireland",
    relevance: "medium",
    focus: "Evening Shopify meetup with partner talks and a panel",
    url: "https://www.eventbrite.ie/e/shopify-meetup-dublin-2026-tickets-1984486042173",
    domain: "vevolmedia.com",
    one: "an evening shopify meetup in dublin for merchants, agencies and app vendors, run by an agency",
    watch: "Run by Vevol Media, a Shopify Plus agency that also builds apps and sells a theme. Growave gives the keynote as its premier partner. eDesk, ServeApps and Omniconvert give the lightning talks. One panelist runs a brand listed in Vevol Media's own portfolio. Tickets are 20 to 77 euros with no refunds.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-17",
    notes: "Eventbrite event data read 2026-10-17: 2026-10-22 18:00 to 21:00 +01:00, Liberties Suite at Aloft Dublin City, 1 Mill Street, D08 XK58. AggregateOffer EUR 20 to 77, no refunds. FAQ: for merchants, agencies, software providers and freelancers; others may be cancelled. Says it 'returns' and links last year's edition (YouTube eoB9hhq9_R4), so annual. Host Dan Nistor, co-founder and CEO. Lineup: Growave (premier partner), Shopify, Mollie, Clustie, StoreHero, IPERA, Hugh Maguire Butchers (in vevolmedia.com's project list). Giveaway by Slash Themes (BundleBox). Afterparty at The Camden. vevolmedia.com: Certified Shopify Plus Partners, Shopify apps, Noblesse theme; no separate event page.",
  },
  {
    id: "wecanfly-flight-club",
    name: "Flight Club: E-commerce Retention Meetup",
    organizer: "wecanfly",
    dateRaw: "22 October 2026, 15:00 to 20:00",
    datePrecision: "exact",
    startDate: "2026-10-22",
    endDate: "2026-10-22",
    city: "Warsaw",
    country: "Poland",
    venue: "Mysia 3",
    audience: "Founders, CEOs, heads of ecommerce and CTOs of brands on Shopify Plus, mid-migration or on another platform",
    relevance: "medium",
    focus: "Ecommerce retention: loyalty, subscriptions, checkout and fulfilment",
    url: "https://retention.wecanflyagency.com/en-pl",
    domain: "wecanflyagency.com",
    one: "an afternoon meetup in warsaw on ecommerce retention, for merchants, run by a shopify plus agency",
    watch: "Run by wecanfly, a Shopify Plus agency, for its merchant community. The four talks are given by vendors: Shopify with wecanfly, Love Loyalty, Juo and Base.com, with Klaviyo on the panel. A loyalty or subscription app vendor would watch a competitor on stage. Vendor seats are capped at about 10, cost 1,399 zł and were sold out on 19 October 2026. Merchant seats are 99 zł.",
    social: {
      linkedin: "https://www.linkedin.com/company/wecanfly-shopify",
    },
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-19",
    notes: "Organiser page read 2026-10-19 in a browser (plain fetches get a Cloudflare 429). 22/10/2026 15:00-20:00, Mysia 3, 00-496 Warszawa. Agenda: Shopify (Apsara Chidambaram) and wecanfly (Kamil Frejlich) on checkout; Love Loyalty (Marton Kosdi-Kovacs); Juo (Alina Prelicz) on subscriptions in Poland; Base.com (Wojciech Jedral) on fulfilment; panel with Love Loyalty, Juo and Klaviyo. Tickets: Merchant 99 PLN, 16 seats only; Vendor 1,399 PLN, sold out; applications company-verified. Flight Club is wecanfly's closed Shopify Plus community (flightclub.wecanfly.pl); earlier editions were Shopify Plus VIP dinners in Warsaw, Krakow, Wroclaw and Warsaw again. Several a year, no anniversary, so not annual. Footer says (c) 2026 mohi.to.",
  },
  {
    id: "successify",
    name: "Successify",
    organizer: "Pixel Kicks",
    dateRaw: "Next date not announced. Last held 15 October 2026",
    datePrecision: "unknown",
    startDate: null,
    lastHeld: "2026-10-15",
    city: "Manchester",
    country: "UK",
    venue: "",
    audience: "Merchants, agencies and technology partners on Shopify in Manchester and the North of England",
    relevance: "medium",
    focus: "Shopify meetup with short talks and networking",
    url: "https://www.pixelkicks.co.uk/successify/",
    domain: "pixelkicks.co.uk",
    one: "a free afternoon shopify meetup in manchester for merchants, agencies and technology partners",
    watch: "Run by Pixel Kicks, a Shopify agency in Manchester and part of the PushON Commerce Group. Most of the room is the merchants an agency wants as clients. It started in 2025 and meets a few times a year, so there is no annual date to expect. The page names no date after 15 October 2026.",
    social: {},
    launched: "2025", /* first edition. www.pixelkicks.co.uk/successify/: "Successify was launched in 2025 by Pixel Kicks" (checked 2026-10-23) */
    updated: "2026-10-17",
    notes: "Organiser page read 2026-10-17: Thursday 15 October 2026, 13:00 to 16:00, Social Refuge, Ancoats, free, Eventbrite registration (eventbrite.co.uk/e/...-tickets-1997677462065). Launched 2025, 'will continue to run throughout 2026', plans to expand into London. Past speakers it names: Shopify, DotDigital, Mark Leach, Chris Buckley, Conor Jafaari. 'Proudly part of the PushON Commerce Group' is in the site footer.",
  },
  {
    id: "merchant-inspiration-talks",
    name: "Merchant Inspiration Talks",
    organizer: "Merchant Inspiration UG",
    dateRaw: "2027, date not announced. Last held 17 September 2026",
    datePrecision: "unknown",
    startDate: null,
    lastHeld: "2026-09-17",
    annual: true,
    city: "Berlin",
    country: "Germany",
    venue: "Festsaal Kreuzberg",
    audience: "E-commerce decision makers at Shopify brands in the DACH region, with agencies as partners",
    attendees: "About 500",
    relevance: "medium",
    focus: "DACH Shopify merchant conference",
    url: "https://merchantinspirationtalks.com/",
    domain: "merchantinspirationtalks.com",
    one: "a german-language conference for shopify merchants in the dach region",
    watch: "Mainly a merchant conference. Agencies and vendors take part as paying partners, so an app vendor is there to meet buyers, not peers. The program is in German. There is a 2027 save-the-date sign-up but no date.",
    social: {},
    launched: "2019", /* first edition. merchantinspirationtalks.com/pages/uber-uns: "MIT19 Das erste Mal" (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "Absorbs the sheet's separate 'Merchant Inspiration (Registration page)' row: merchantinspiration.com/anmeldung redirects here and then 404s.",
  },
  {
    id: "shopx",
    name: "ShopX",
    organizer: "GemCommerce",
    dateRaw: "Next edition not announced. Last held 17 September 2026",
    datePrecision: "unknown",
    startDate: null,
    lastHeld: "2026-09-17",
    annual: true,
    city: "Ho Chi Minh City",
    country: "Vietnam",
    venue: "New World Saigon Hotel",
    audience: "Founders, operators and builders in the APAC Shopify ecosystem: merchants, agencies, apps and SaaS",
    relevance: "medium",
    focus: "APAC Shopify and AI commerce summit",
    url: "https://2026.shopxevent.com/",
    domain: "shopxevent.com",
    one: "an apac shopify summit in ho chi minh city, mostly merchants, with apps and agencies named in the audience",
    watch: "Organized by GemCommerce, the company behind the GemPages page builder. GemCommerce also sponsored the $149 delegate pass, which made the pass free. An app vendor in page building is a guest at a competitor's event.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "2025 edition: 250+ operators, 18 speakers, 17 sponsors (organiser's claim). Co-organiser EFE appears only in third-party sources.",
  },

  {
    id: "nxt-commerce-summit",
    name: "NXT:Commerce Summit 2026",
    organizer: "Ask Phill",
    dateRaw: "Nov 5, 2026",
    datePrecision: "exact",
    startDate: "2026-11-05",
    annual: true,
    city: "Amsterdam",
    country: "Netherlands",
    venue: "Felix Meritis",
    audience: "Brand founders and owners, heads of ecommerce, marketers and CMOs, heads of tech and CTOs",
    relevance: "medium",
    focus: "Commerce summit for fashion, lifestyle and beauty brands",
    url: "https://nxtcommercesummit.com/",
    domain: "nxtcommercesummit.com",
    one: "an amsterdam summit for fashion, lifestyle and beauty brands, run by a shopify agency",
    watch: "Run by Ask Phill, a Shopify agency in Amsterdam, for the kind of brands it builds stores for. The site shows no ticket price, no speaker names and no sponsor names. It says 2,600+ people have attended over seven years, which is a few hundred per edition.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-15",
    notes: "2026 is the 8th edition per the site. Formerly the D2C Summit. 2024: 7 Nov, De Rode Hoed, about 400 visitors (Emerce). 2025: 7 Nov (Gorgias and Elevar event listings, both Shopify apps). askphill.com answered 429 on 2026-10-15; 'Shopify Plus partner, Platinum since 2025, fashion, lifestyle and beauty brands' is from search results quoting askphill.com/pages/about.",
  },

  /* ---------------------------------------------------------------- */
  /*  Merchant, retail and general events                              */
  /* ---------------------------------------------------------------- */
  {
    id: "retail-tech-summit",
    name: "Retail Tech Summit 2026",
    organizer: "The Retail Bulletin",
    ownership: { id: "retail-bulletin", name: "The Retail Bulletin" },
    dateRaw: "Wednesday 4 November 2026, from 09:15",
    datePrecision: "exact",
    startDate: "2026-11-04",
    endDate: "2026-11-04",
    city: "London",
    country: "UK",
    venue: "Cavendish Conference Centre, 22 Duchess Mews",
    audience: "Retail leaders. Free places are for retailers and brands only",
    attendees: "150+",
    relevance: "low",
    focus: "AI and unified commerce for UK retailers",
    url: "https://www.theretailbulletin.com/retail-events/retail-technology-summit/",
    domain: "theretailbulletin.com",
    one: "a one-day london summit on retail technology for uk retailers, run by a retail trade publication",
    watch: "Free for retailers and brands only. The organizer voids registrations from anyone else, so a vendor gets in as a paying partner through its partnerships team. The speakers are UK high-street retailers, not ecommerce software people. Registering means agreeing that sponsors may contact you after the event.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-21",
    notes: "Event and register pages read 2026-10-21. 4 Nov 2026, start 09:15, Cavendish Conference Centre, 22 Duchess Mews, London W1G 9DT. '150+ retail leaders', elsewhere 'up to 200 retail professionals at each event'. Retailer ticket free; 'Registrations from non-retailers will be voided. If you are a vendor and wish to join the event, please contact our partnerships team'. Consent box: event partners may contact delegates. Speakers include ASOS, Central Co-op, Victorinox, Specsavers, Lincolnshire Co-op, Matalan, Footasylum. Highlighted on theretailbulletin.com's homepage. Sponsorship contact Karen Howard (MD). No prior-year date found, so not annual.",
  },
  {
    id: "ongefilterd",
    name: "Ongefilterd: De feed die je webshop opvreet",
    organizer: "De Nieuwe Zaak",
    dateRaw: "Thursday 19 November 2026, 10:00 to 18:00",
    datePrecision: "exact",
    startDate: "2026-11-19",
    endDate: "2026-11-19",
    city: "Amsterdam",
    country: "Netherlands",
    venue: "Heineken Experience, Stadhouderskade 78",
    audience: "People who lead marketing or ecommerce at brands, retailers and wholesalers",
    relevance: "low",
    focus: "Social commerce and agentic AI in the customer journey",
    url: "https://www.denieuwezaak.nl/ongefilterd/de-feed-die-je-webshop-opvreet",
    domain: "denieuwezaak.nl",
    one: "a free one-day dutch event for brands and retailers on social commerce and ai shopping agents, run by an agency",
    watch: "Run by De Nieuwe Zaak, a Dutch agency that builds on BigCommerce, Shopify Plus and Intershop. The main sponsor is Commerce, the company behind BigCommerce, and one talk is theirs. It is for brands and retailers. The organizer says it may cancel sign-ups from outside that group, so an app vendor may be turned away. Entry is free, but a no-show costs €50. Signing up means agreeing to marketing email from both companies. The page is in Dutch.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-20",
    notes: "Organiser page read 2026-10-20. Thu 19 Nov 2026, 10:00-18:00 incl. networking drinks, Heineken Experience, Stadhouderskade 78, 1072 AE Amsterdam. Free, limited places; EUR 50 no-show fee unless cancelled 24h before. Sign-ups outside the target group (marketing or ecommerce leads at brands, retailers, wholesalers) may be cancelled. Consent to marketing email from De Nieuwe Zaak and Commerce is required to register. Speakers: John Lin, Howard Saunders, Jasper Koekoek (DNZ), Kristina Pototska (Commerce), Geri Kirovska (Google), host Christ Coolen. Main sponsor Commerce; partners United Playgrounds, Spotler, Utonomy. A recap video was uploaded 2026-06-16, so there was an earlier edition; cadence not stated, so not annual. DNZ lists BigCommerce, Shopify Plus and Intershop as its platforms.",
  },
  {
    id: "ecommerce-warsaw-expo",
    name: "E-commerce Warsaw Expo 2026",
    organizer: "Infoguru",
    dateRaw: "Friday 23 October 2026",
    datePrecision: "exact",
    startDate: "2026-10-23",
    endDate: "2026-10-23",
    city: "Warsaw",
    country: "Poland",
    venue: "EXPO XXI, Prądzyńskiego 12/14",
    audience: "Online store owners and staff, and ecommerce, marketing and sales managers",
    attendees: "3,000",
    relevance: "low",
    focus: "Polish ecommerce trade fair with an expo floor and talks",
    url: "https://ecommercewarsaw.com/visit",
    domain: "ecommercewarsaw.com",
    one: "a one-day ecommerce trade fair in warsaw for polish online stores, with about 100 exhibitors",
    watch: "A general trade fair for the Polish market. Most exhibitors sell marketplaces, logistics and payments, and few are Shopify apps. Klaviyo and the agency wecanfly are among them. A standard ticket is 196 zł plus VAT. It drops to 49 zł if you pick an exhibitor as patron, and that exhibitor then gets your contact details. The 3,000 visitors figure is the organizer's own.",
    social: {
      linkedin: "https://www.linkedin.com/showcase/ecommercewarsaw/",
    },
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-20",
    notes: "ecommercewarsaw.com/visit and en.ecommercewarsaw.com read 2026-10-20. 30th edition, 23.10.2026, EXPO XXI Warszawa, Pradzynskiego 12/14. Organiser per visitor rules: Infoguru Sp. z o.o., Poznan, KRS 0000452046. Claims 3K visitors, 100 exhibitors, 40 speakers, 20 masterclasses, 'largest e-commerce event in the CEE region'. Tickets net of 23% VAT: standard 196 PLN, 49 PLN with an exhibitor as patron (the patron's logo goes on your badge and they are told who you are), VIP / provider 1,000 PLN for non-exhibiting vendors. Exhibitors include Allegro, Base.com, Klaviyo, IdoSell, TikTok, PayU, GetResponse, wecanfly (stand S4). Speakers include Mateusz Witkowski and Tomasz Runowicz of wecanfly. Editions per year not confirmed, so not annual.",
  },
  {
    id: "shoptalk-us",
    name: "Shoptalk Spring 2027",
    organizer: "Shoptalk (Hyve Group)",
    ownership: { id: "shoptalk", name: "Shoptalk (Hyve Group)" },
    dateRaw: "Mar 22 to 24, 2027",
    datePrecision: "exact",
    startDate: "2027-03-22",
    endDate: "2027-03-24",
    city: "Las Vegas",
    country: "USA",
    venue: "Mandalay Bay",
    audience: "Retailers, brands and retail technology providers",
    attendees: "10,000+",
    relevance: "low",
    focus: "Retail and ecommerce",
    url: "https://shoptalk.com/",
    domain: "shoptalk.com",
    one: "the large us retail conference, where brands attend and vendors pay to meet them",
    watch: "Qualifying retailers and brands can attend free, and technology providers pay. That is the business model: as an app vendor, you are the one paying for access. Not about Shopify apps. Worth it only if enterprise brands are your buyer.",
    social: {},
    launched: "2016-05", /* first edition. hyve.group/news/2019/acquisition-of-shoptalk-and-groceryshop/: "Shoptalk was launched in May 2016" (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "shoptalk-europe",
    name: "Shoptalk Europe 2027",
    organizer: "Shoptalk (Hyve Group)",
    ownership: { id: "shoptalk", name: "Shoptalk (Hyve Group)" },
    dateRaw: "Jun 1 to 3, 2027",
    datePrecision: "exact",
    startDate: "2027-06-01",
    endDate: "2027-06-03",
    city: "Barcelona",
    country: "Spain",
    venue: "Fira Gran Via",
    audience: "Senior retail executives, brands, investors and technology providers",
    attendees: "4,500+",
    relevance: "low",
    focus: "Retail and ecommerce",
    url: "https://europe.shoptalk.com/",
    domain: "europe.shoptalk.com",
    one: "shoptalk's european edition, for senior retail and brand executives",
    watch: "Same model as the US edition: free for qualifying retailers, paid for vendors, and the vendor price is not published. The audience is enterprise retail, not the Shopify app ecosystem.",
    social: {},
    launched: "2017", /* first edition. hyve.group/news/2019/acquisition-of-shoptalk-and-groceryshop/: "Shoptalk Europe in 2017" (checked 2026-10-23) */
    updated: "2026-10-07",
  },
  {
    id: "shoptalk-luxe",
    name: "Shoptalk Luxe 2027",
    organizer: "Shoptalk (Hyve Group)",
    ownership: { id: "shoptalk", name: "Shoptalk (Hyve Group)" },
    dateRaw: "Feb 2 to 4, 2027",
    datePrecision: "exact",
    startDate: "2027-02-02",
    endDate: "2027-02-04",
    city: "Abu Dhabi",
    country: "UAE",
    venue: "Emirates Palace Mandarin Oriental",
    audience: "Luxury and premium retailers and brands, technology providers and investors",
    attendees: "2,500+",
    relevance: "low",
    focus: "Luxury retail",
    url: "https://luxe.shoptalk.com/home",
    domain: "luxe.shoptalk.com",
    one: "shoptalk's luxury retail edition in abu dhabi",
    watch: "Built for luxury brands. Vendors pay to attend, at a price that is not published. Only relevant if luxury merchants are who you sell to.",
    social: {},
    launched: "2026-01", /* first edition. hyve.group/news/2026/shoptalk-luxe-debuts-in-abu-dhabi-as-hyve-accelerates-global-growth-through-geo-cloning/: "the successful debut of Shoptalk Luxe" (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "web-summit",
    name: "Web Summit 2026",
    organizer: "Web Summit",
    dateRaw: "Nov 9 to 12, 2026",
    datePrecision: "exact",
    startDate: "2026-11-09",
    endDate: "2026-11-12",
    city: "Lisbon",
    country: "Portugal",
    venue: "",
    audience: "Tech companies, startups, investors and media",
    relevance: "low",
    focus: "General technology",
    url: "https://websummit.com/",
    domain: "websummit.com",
    one: "General tech conference in Lisbon, for startups, investors and media",
    watch: "Nothing on the program is about Shopify or ecommerce apps specifically. At this size, you will not meet your buyers by chance. Go for investors or press, not merchants.",
    social: {},
    launched: "2009", /* first edition. websummit.com/careers: "Since starting out in 2009" (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "worldef-antalya",
    name: "WORLDEF Prime Antalya 2026",
    organizer: "WORLDEF (Incmice)",
    ownership: { id: "worldef", name: "WORLDEF (Incmice)" },
    dateRaw: "Dec 8 to 10, 2026",
    datePrecision: "exact",
    startDate: "2026-12-08",
    endDate: "2026-12-10",
    city: "Antalya",
    country: "Türkiye",
    venue: "Kremlin Palace",
    audience: "Retail and ecommerce decision makers, with AI-driven meeting matchmaking",
    attendees: "3,000+",
    relevance: "low",
    focus: "Ecommerce matchmaking summit",
    url: "https://prime.worldef.com/",
    domain: "prime.worldef.com",
    one: "a resort-hosted ecommerce summit built around pre-matched meetings",
    watch: "The Summit Pass is $540, or $740 with a stay. Partnership packages cost from $5,990 to $51,990, so vendors pay a lot for the meetings. Ecommerce in general, not Shopify.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "worldef-dubai",
    name: "WORLDEF Dubai 2027",
    organizer: "WORLDEF (Incmice)",
    ownership: { id: "worldef", name: "WORLDEF (Incmice)" },
    dateRaw: "Jan 26 to 28, 2027",
    datePrecision: "exact",
    startDate: "2027-01-26",
    endDate: "2027-01-28",
    city: "Dubai",
    country: "UAE",
    venue: "Dubai CommerCity",
    audience: "Marketplace operators, retail brands, technology and logistics companies",
    attendees: "18,000+",
    relevance: "low",
    focus: "Ecommerce and marketplaces, Middle East",
    url: "https://worldef.com/events/worldef-dubai-2027/",
    domain: "worldef.com",
    one: "a middle east ecommerce expo with a free general pass",
    watch: "General entry is free, with Executive passes from $199 and VIP from $999. Marketplace-led, with Amazon, Alibaba and noon among the partners, so Shopify's share of the attendees is small.",
    social: {},
    launched: "2024", /* first edition. worldef.com/events/worldef-dubai-2027/: "2024 First edition" (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "worldef-istanbul",
    name: "WORLDEF Istanbul 2027",
    organizer: "WORLDEF (Incmice)",
    ownership: { id: "worldef", name: "WORLDEF (Incmice)" },
    dateRaw: "Jun 17 to 19, 2027",
    datePrecision: "exact",
    startDate: "2027-06-17",
    endDate: "2027-06-19",
    city: "Istanbul",
    country: "Türkiye",
    venue: "WOW Istanbul",
    audience: "Ecommerce sellers, marketplaces, retail brands and technology companies",
    attendees: "30,000+",
    relevance: "low",
    focus: "Ecommerce expo",
    url: "https://worldef.com/events/worldef-global-summit-2026/",
    domain: "worldef.com",
    one: "worldef's flagship istanbul expo for sellers, marketplaces and their suppliers",
    watch: "The business is selling exhibitor and sponsor places. The 30,000 figure is the organizer's. It focuses on sellers and marketplaces, not Shopify, so most attendees do not run a Shopify store.",
    social: {},
    launched: "2015", /* first edition. worldef.com/about/: "Since 2015 ... What started as a small conference in Istanbul" (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "2026 edition Jun 11-13 at Yenikapi. 2027 dates and venue from the same organiser page.",
  },
  {
    id: "webwinkel-vakdagen",
    name: "Webwinkel Vakdagen 2027",
    organizer: "Organisatie Groep Zuid",
    dateRaw: "Apr 7 to 8, 2027",
    datePrecision: "exact",
    startDate: "2027-04-07",
    endDate: "2027-04-08",
    annual: true,
    city: "Utrecht",
    country: "Netherlands",
    venue: "Jaarbeurs Utrecht",
    audience: "Ecommerce managers, webshop owners, retailers, wholesalers and logistics partners",
    attendees: "13,000+",
    relevance: "low",
    focus: "Digital commerce trade fair",
    url: "https://www.webwinkelvakdagen.nl/en/",
    domain: "webwinkelvakdagen.nl",
    one: "the largest dutch ecommerce trade fair, free to visit, with 290+ exhibitors",
    watch: "Free for visitors because the exhibitors pay for stands. Most conversations on the floor are sales pitches. Shopify itself had a stand in 2026, but the visitors run webshops on every platform. Tickets for 2027 are not open yet.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-15",
    notes: "Known as WWV. Runs for 18+ years per the site. 2026 exhibitor list: 334 named exhibitors, Shopify among them. 200+ speakers. Students only on a separate student afternoon.",
  },
  {
    id: "ecommerce-live",
    name: "E-commerce Live! 2027",
    organizer: "Emerce",
    dateRaw: "Jun 10, 2027",
    datePrecision: "exact",
    startDate: "2027-06-10",
    annual: true,
    city: "Rotterdam",
    country: "Netherlands",
    venue: "WTC Rotterdam",
    audience: "Ecommerce professionals and brands",
    attendees: "2,000+",
    relevance: "low",
    focus: "Ecommerce conference: AI, search and social commerce",
    url: "https://www.ecommercelive.nl/",
    domain: "ecommercelive.nl",
    one: "a one-day dutch ecommerce conference in rotterdam, run by emerce",
    watch: "Tickets are €195 to €295 before 21% VAT, and the price goes up as the date gets closer. The site and most session titles are in Dutch. Speakers come from Dutch retail and travel brands, and Shopify is not mentioned anywhere on the site.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-15",
    notes: "Organizer is not named on the page. Every contact address is at emerce.nl and the hashtag is #EmerceECL. 100+ speakers claimed. Ticket tiers: early bird to 5 May, regular to 2 June, late to 10 June.",
  },
  {
    id: "ecommerce-berlin-expo",
    name: "eCommerce Berlin Expo 2027",
    organizer: "eCommerce Berlin Expo",
    dateRaw: "Feb 17 to 18, 2027",
    datePrecision: "exact",
    startDate: "2027-02-17",
    endDate: "2027-02-18",
    city: "Berlin",
    country: "Germany",
    venue: "Messe Berlin",
    audience: "Ecommerce professionals, brands, agencies and SaaS vendors",
    attendees: "14,000+",
    relevance: "low",
    focus: "Ecommerce expo",
    url: "https://ecommerceberlin.com/",
    domain: "ecommerceberlin.com",
    one: "a large berlin ecommerce trade show, mostly brands and their suppliers",
    watch: "The site does not say which company runs it, and ticket prices are not shown. A general ecommerce show where Shopify is one platform among many.",
    social: {},
    launched: "2016", /* first edition. ecommerceberlin.com/about: "E-commerce Berlin Expo launched in 2016" (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "ecommerce-expo-london",
    name: "eCommerce Expo 2027",
    organizer: "CloserStill Media",
    dateRaw: "Sep 22 to 23, 2027",
    datePrecision: "exact",
    startDate: "2027-09-22",
    endDate: "2027-09-23",
    city: "London",
    country: "UK",
    venue: "ExCeL London",
    audience: "B2B and B2C ecommerce professionals",
    attendees: "10,000+",
    relevance: "low",
    focus: "Ecommerce expo",
    url: "https://www.ecommerceexpo.co.uk/",
    domain: "ecommerceexpo.co.uk",
    one: "a free-to-visit london ecommerce trade show",
    watch: "Free for visitors because exhibitors pay. Expect to hear as many sales pitches as you give. General ecommerce, not Shopify apps.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "2026 edition Sep 23-24.",
  },
  {
    id: "dmexco",
    name: "DMEXCO 2027",
    organizer: "Koelnmesse",
    dateRaw: "Sep 22 to 23, 2027",
    datePrecision: "exact",
    startDate: "2027-09-22",
    endDate: "2027-09-23",
    city: "Cologne",
    country: "Germany",
    venue: "Koelnmesse",
    audience: "Digital marketing, media, agencies and commerce technology",
    relevance: "low",
    focus: "Digital marketing",
    url: "https://dmexco.com/",
    domain: "dmexco.com",
    one: "europe's large digital marketing trade fair",
    watch: "A marketing and media show rather than a commerce one. Relevant to an app vendor only through the agencies that attend.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-07",
    notes: "2026 edition Sep 23-24; exact days from third-party listings, the organiser confirms September.",
  },
  {
    id: "ecomexpo-vilnius",
    name: "EcomExpo 2027",
    organizer: "APG Media",
    dateRaw: "Sep 30, 2027",
    datePrecision: "exact",
    startDate: "2027-09-30",
    endDate: "2027-09-30",
    city: "Vilnius",
    country: "Lithuania",
    venue: "Samsung Conference Center, Tech Zity",
    audience: "E-shop owners, marketing leaders, marketplace teams, agencies and technology providers",
    attendees: "700+",
    relevance: "low",
    focus: "Baltic ecommerce",
    url: "https://www.ecomexpo.eu/",
    domain: "ecomexpo.eu",
    one: "a one-day baltic ecommerce conference in vilnius",
    watch: "Early bird is €150 plus VAT, and the 2026 price reached €300. A regional merchant audience, few of them on Shopify.",
    social: {
      linkedin: "https://www.linkedin.com/company/ecomexpovilnius",
      x: "https://x.com/ecomexpoVln",
      youtube: "https://www.youtube.com/@ecomexpovilnius-y9i",
    },
    launched: "2013", /* first edition. www.ecomexpo.eu/: "held in Vilnius, Lithuania since 2013" (checked 2026-10-23) */
    updated: "2026-10-07",
    notes: "2026 edition Oct 1.",
  },
  {
    id: "accelerate",
    name: "Accelerate 27",
    organizer: "Pattern",
    dateRaw: "Apr 19 to 21, 2027",
    datePrecision: "exact",
    startDate: "2027-04-19",
    endDate: "2027-04-21",
    city: "Salt Lake City",
    country: "USA",
    venue: "",
    audience: "Brand leaders selling on Amazon, Walmart and TikTok Shop",
    relevance: "low",
    focus: "Marketplace selling",
    url: "https://pattern.com/accelerate",
    domain: "pattern.com",
    one: "a marketplace-selling summit run by pattern, mostly about amazon",
    watch: "Run by Pattern, which sells marketplace management to the brands attending, so the program is partly its sales pitch. Marketplaces rather than Shopify.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "Sheet had 'Accelerate 26, Shenzhen, Sep 21-22'; only in a search snippet. The 2026 flagship was May 21-22 at the Salt Palace (Pattern press release).",
  },
  {
    id: "acquiror-conference",
    name: "The Acquiror Conference",
    organizer: "The Fortia Group",
    dateRaw: "2027, date not announced. Last held 9 March 2026",
    datePrecision: "unknown",
    startDate: null,
    lastHeld: "2026-03-09",
    annual: true,
    city: "New York",
    country: "USA",
    venue: "1 Liberty Street",
    audience: "Acquirers of ecommerce brands: corporates, private equity, family offices and aggregators, plus selected brands",
    attendees: "100 to 150",
    relevance: "low",
    focus: "Ecommerce M&A",
    url: "https://thefortiagroup.com/2026-the-acquiror-conference/",
    domain: "thefortiagroup.com",
    one: "a small new york gathering of people who buy ecommerce brands",
    watch: "Run by a sell-side M&A advisory firm. The event is where its deal flow comes from. About buying merchants, not apps. Useful only if you are thinking about who would buy you.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "camp-commerce",
    name: "Camp Commerce 2026",
    organizer: "Shoplift",
    dateRaw: "Aug 7, 2026",
    datePrecision: "exact",
    startDate: "2026-08-07",
    endDate: "2026-08-07",
    city: "Southampton, NY",
    country: "USA",
    venue: "",
    audience: "Senior founders, operators and decision makers from consumer brands, by invitation",
    attendees: "200+",
    relevance: "low",
    focus: "Invite-only brand executive retreat",
    url: "https://www.campcommerce.nyc/",
    domain: "campcommerce.nyc",
    one: "an invite-only day for consumer brand executives in the hamptons",
    watch: "Powered by Shoplift, a Shopify A/B testing app, with Northbeam and Attentive as partners. It is an app vendor's own marketing event, so another app vendor attends as its guest. No sign yet of another edition.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "ecom-elevated",
    name: "Ecom Elevated, Fall 2026",
    organizer: "Commerce Catalyst",
    dateRaw: "Aug 24 to 25, 2026",
    datePrecision: "exact",
    startDate: "2026-08-24",
    endDate: "2026-08-25",
    city: "Salt Lake City",
    country: "USA",
    venue: "Hilton Salt Lake City Center",
    audience: "Ecommerce brand founders and operators, plus curated solution providers",
    relevance: "low",
    focus: "Brand operator event",
    url: "https://www.ccatalyst.co/events/ecom-elevated-fall-2026/",
    domain: "ccatalyst.co",
    one: "a two-day brand operator event in salt lake city, run twice a year",
    watch: "Funded by sponsors. Vendors are admitted by selection, not with an open ticket. Runs in spring and fall, and the spring 2027 date is not published.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "Spring 2026 was Apr 15-16 per the organiser's spring page in search results.",
  },
  {
    id: "a-new-era",
    name: "A New Era '26",
    organizer: "Charle",
    dateRaw: "Sep 17, 2026",
    datePrecision: "exact",
    startDate: "2026-09-17",
    endDate: "2026-09-17",
    city: "London",
    country: "UK",
    venue: "",
    audience: "Founders, operators and brand teams, by invitation",
    relevance: "low",
    focus: "Agency evening event",
    url: "https://www.charle.co.uk/new-era/",
    domain: "charle.co.uk",
    one: "a free invite-led evening for brand founders, hosted by a shopify agency",
    watch: "Charle's own marketing event, which included an announcement about the agency's future. The venue was shared only with confirmed guests.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-07",
  },
  {
    id: "suitetalks-shoptalk",
    name: "SUITETALKS at Shoptalk",
    organizer: "Avex",
    ownership: { id: "avex", name: "Avex" },
    dateRaw: "During Shoptalk, March 2024",
    datePrecision: "month",
    startDate: "2024-03",
    city: "Las Vegas",
    country: "USA",
    venue: "Mandalay Bay",
    audience: "Merchants looking for networking and consultations",
    relevance: "low",
    focus: "Agency suite at a retail conference",
    url: "https://www.avexdesigns.com/blog/suitetalks-exclusive-onsite-networking-event/",
    domain: "avexdesigns.com",
    one: "a shopify plus agency's hospitality suite running alongside shoptalk",
    watch: "A client-acquisition suite run by Avex with Shopify, Loop, Gorgias and Rebuy. The organiser's page gives no exact day, only that it ran during Shoptalk 2024.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-07",
  },
  {
    id: "ecomm-connect-denver",
    name: "EComm Connect Denver",
    organizer: "Avex",
    ownership: { id: "avex", name: "Avex" },
    dateRaw: "June 2023",
    datePrecision: "month",
    startDate: "2023-06",
    city: "Denver",
    country: "USA",
    venue: "Ocean Prime",
    audience: "Ecommerce merchants",
    relevance: "low",
    focus: "Agency networking dinner",
    url: "https://www.avexdesigns.com/blog/ecomm-connect-denvers-dining-and-networking/",
    domain: "avexdesigns.com",
    one: "a dinner for merchants hosted by a shopify plus agency",
    watch: "A one-off client dinner run by Avex with EcoCart and Retention.com, with no sign of a repeat. The write-up gives the month but not the day.",
    social: {},
    launched: "2023", /* first edition. www.avexdesigns.com/blog/ecomm-connect-denvers-dining-and-networking/: "organize its first event in Denver (post of June 2023)" (checked 2026-10-23) */
    updated: "2026-10-07",
  },
  {
    id: "shopify-unite",
    name: "Shopify Unite",
    organizer: "Shopify",
    ownership: { id: "shopify", name: "Shopify" },
    dateRaw: "2022",
    datePrecision: "year",
    startDate: "2022",
    discontinued: true,
    city: "",
    country: "",
    venue: "",
    audience: "Shopify developers and partners",
    focus: "Shopify's former partner and developer conference",
    url: "https://unite.shopify.com/",
    one: "shopify's old partner and developer conference, replaced by editions and now dotdev",
    watch: "Discontinued in practice, not by announcement. The last single Unite was a livestream in June 2021. In 2022 it was a series of two-day events in London, Toronto and Melbourne. Its old address was returning errors when checked.",
    social: {},
    launched: "2016-03", /* first edition. www.shopify.com/partners/blog/99860422-here-s-what-happened-at-unite-shopify-s-first-partner-and-developer-conference: "Last week we kicked-off our inaugural Partner and Developer Conference (post of 30 March 2016)" (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "ecom-collab-club",
    name: "eCom Collab Club",
    organizer: "eCom Collab Club",
    dateRaw: "Next date not announced. Last held 9 September 2026",
    datePrecision: "unknown",
    startDate: null,
    lastHeld: "2026-09-09",
    city: "London",
    country: "UK",
    venue: "",
    audience: "UK ecommerce professionals",
    relevance: "low",
    focus: "Morning panels and speed networking",
    url: "https://ecomcollabclub.com/",
    one: "a recurring uk morning meetup of panels and speed networking for ecommerce people",
    watch: "Dates are published only as Eventbrite listings, not on its own site, and the site does not say who runs it. It meets several times a year, so there is no annual date to expect.",
    social: {},
    launched: "2022-01", /* first edition. ecomcollabclub.com/about: "In January 2022, eCom Collab Club launched" (checked 2026-10-23) */
    updated: "2026-10-07",
    notes: "Last verified edition 2026-09-09, ODEON Luxe West End. Third parties say Blend Commerce's founders run it; not on the organiser's pages.",
  },
  {
    id: "dtc-dines-vancouver",
    name: "DTC Dines Vancouver",
    organizer: "DTC Media",
    ownership: { id: "dtc-media", name: "DTC Media" },
    dateRaw: "Thursday 29 October 2026",
    datePrecision: "exact",
    startDate: "2026-10-29",
    endDate: "2026-10-29",
    city: "Vancouver",
    country: "Canada",
    venue: "",
    audience: "A small group building and operating scaling e-commerce brands, by application",
    relevance: "low",
    focus: "Brand founder dinner",
    url: "https://luma.com/uug6187u",
    one: "an application-only dinner for ecommerce brand operators in vancouver",
    watch: "Sponsored by Klaviyo and Dataships, and the venue is disclosed only after your application is approved. Built for brand operators, so an app vendor would be applying to join a group of prospects.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-13",
    notes: "Date from the Luma event data: start_at 2026-10-30T01:30Z, America/Vancouver, i.e. 18:30 local on Thu 29 Oct. The page text shows no date; the earlier check missed it. This is the Vancouver edition, not a correction to NYC: the NYC listing (luma.com/fdrtqphl, sheet Sep 15) still 404s and stays a draft.",
  },

  /* ---------------------------------------------------------------- */
  /*  Drafts: could not be verified on a live organiser page            */
  /* ---------------------------------------------------------------- */
  {
    id: "dtc-dines-nyc",
    name: "DTC Dines NYC",
    organizer: "",
    dateRaw: "Sep 15, 2026",
    datePrecision: "exact",
    startDate: "2026-09-15",
    endDate: "2026-09-15",
    city: "Brooklyn, NY",
    country: "USA",
    venue: "",
    audience: "Ecommerce brand founders and operators",
    relevance: "low",
    focus: "Brand founder dinner",
    url: "https://luma.com/fdrtqphl",
    one: "a dinner for ecommerce brand operators in brooklyn",
    watch: "The Luma listing has been removed, so nothing here could be checked against the organiser.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-10",
    notes: "UNVERIFIED: luma.com/fdrtqphl 404s. Date, city and organiser are the sheet's.",
  },
  {
    id: "dotdigital-summit",
    name: "Dotdigital Summit",
    organizer: "Dotdigital",
    dateRaw: "TBD",
    datePrecision: "unknown",
    startDate: null,
    city: "London",
    country: "UK",
    venue: "",
    audience: "Marketers and Dotdigital customers",
    relevance: "low",
    focus: "Email and SMS marketing",
    url: "https://dotdigital.com/",
    one: "an email and sms platform's customer conference",
    watch: "A vendor's own customer event. The roadshow page is gone and the summit page redirects to the homepage.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-10",
    notes: "UNVERIFIED: /summit-roadshow/ 404s. Search shows a single Summit 2026-07-02 at Old Billingsgate, not a roadshow; not confirmed on a live organiser page.",
  },
  {
    id: "retailfest-connect",
    name: "RetailFest Connect",
    organizer: "NORA",
    dateRaw: "N/A",
    datePrecision: "unknown",
    startDate: null,
    city: "",
    country: "Australia",
    venue: "",
    audience: "Australian retail decision makers",
    relevance: "low",
    focus: "Retail membership event",
    url: "https://www.nora.org.au/",
    one: "an australian retail association's member event",
    watch: "Not on the association's current events page, and the old listing is gone.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-07",
    draft: true,
    notes: "UNVERIFIED: nora.org.au/event/retailfestconnect-4/ 404s; search title says 'Retail Reboot: 2025 Kick-Off Celebration'.",
  },
  {
    id: "digital-commerce-today-boston",
    name: "Digital Commerce Today Live, Boston Spring Summit 2023",
    organizer: "Trellis",
    dateRaw: "Spring 2023",
    datePrecision: "season",
    startDate: "2023-03",
    city: "Boston",
    country: "USA",
    venue: "",
    audience: "Digital commerce professionals",
    relevance: "low",
    focus: "Agency-run ecommerce summit",
    url: "https://trellis.co/",
    one: "an ecommerce agency's spring summit in boston",
    watch: "Trellis's own event, and its pages now redirect to Zaelab and 404.",
    social: {},
    launched: "unknown", /* first edition not stated by the organizer (checked 2026-10-23) */
    updated: "2026-10-10",
    notes: "UNVERIFIED: May 17-18, 2023 from search snippets only. If verified, this becomes exact rather than season.",
  },
];

/** The published list. Every consumer imports this name. */
export const EVENTS = published(ALL_EVENTS);

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

/** How far ahead "imminent" reaches. */
export const IMMINENT_DAYS = 30;

/*
 * An inferred date is only offered for an `annual` series that still looks
 * alive. One whose last known edition is more than two years old has skipped
 * at least a year, and projecting it forward again would be presenting a guess
 * about a series that has probably stopped. Those go to "Dates not announced",
 * where the last date is still shown.
 */
const INFER_WITHIN_DAYS = 730;

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Today as YYYY-MM-DD in UTC. One clock for the whole render. */
export const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);

const toTime = (iso) => Date.parse(`${iso}T00:00:00Z`);
const addDays = (iso, n) => new Date(toTime(iso) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((toTime(b) - toTime(a)) / DAY);
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const isMonth = (s) => /^\d{4}-\d{2}$/.test(String(s || ""));

/** Last day of a YYYY-MM month. */
const monthEnd = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-");
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`;
};
export const monthShort = (ym) => MONTHS[Number(String(ym).split("-")[1]) - 1];

/** "2 June 2025" */
export const dayLabel = (iso) => {
  if (!isDay(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
};

const weekday = (iso) => WEEKDAYS[new Date(toTime(iso)).getUTCDay()];

/** "9 to 12 Nov 2026", "17 Sep 2026", "30 Nov to 2 Dec 2026". No dashes. */
export function rangeLabel(start, end) {
  if (!isDay(start)) return "";
  const [y1, m1, d1] = start.split("-").map(Number);
  if (!isDay(end) || end === start) return `${d1} ${MONTHS[m1 - 1]} ${y1}`;
  const [y2, m2, d2] = end.split("-").map(Number);
  if (y1 !== y2) return `${d1} ${MONTHS[m1 - 1]} ${y1} to ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} to ${d2} ${MONTHS[m2 - 1]} ${y1}`;
  return `${d1} to ${d2} ${MONTHS[m1 - 1]} ${y1}`;
}

/*
 * Status over a span of days. Past once the last day is behind us, imminent
 * from thirty days before the first day until the last, upcoming otherwise. An
 * event that is on today is imminent: it is the most actionable state there is.
 */
function statusOf(first, last, today) {
  if (last < today) return "past";
  if (first <= addDays(today, IMMINENT_DAYS)) return "imminent";
  return "upcoming";
}

/*
 * The next anniversary of a known date that is still ahead of today. "Last
 * held 2 June 2025" read on 7 October 2026 lands on 2 June 2027: the coming
 * edition, not the one that has already gone by unannounced.
 */
function nextAnniversary(iso, today) {
  const [, m, d] = iso.split("-");
  let y = Number(today.slice(0, 4));
  let candidate = `${y}-${m}-${d}`;
  if (!isDay(candidate) || candidate <= today) candidate = `${y + 1}-${m}-${d}`;
  /* 29 February in a year without one. */
  if (Number.isNaN(toTime(candidate))) candidate = `${candidate.slice(0, 4)}-02-28`;
  return candidate;
}

/*
 * Where an event sits on the calendar, and how sure we are about it.
 *
 *  mode "exact"        on its days.
 *  mode "approx"       in its month, labelled with the organiser's own words.
 *  mode "inferred"     at the anniversary of the last known edition, and
 *                      labelled as not confirmed. Never presented as
 *                      scheduled.
 *  mode "year"         discontinued, and only the year of the last edition
 *                      is known.
 *  mode "unscheduled"  nowhere on the calendar: "Dates not announced".
 *
 * `date` is the sort key, `month` the agenda bucket, `status` derived here and
 * nowhere else. A discontinued event is past whatever its dates say.
 */
export function placeEvent(e, today = todayISO()) {
  const p = e.datePrecision;

  if (e.discontinued) {
    if (isDay(e.lastHeld)) {
      return {
        mode: "exact", date: e.lastHeld, end: e.lastHeld, month: e.lastHeld.slice(0, 7),
        status: "past", discontinued: true, weekday: weekday(e.lastHeld),
        label: `Discontinued, last held ${dayLabel(e.lastHeld)}`,
      };
    }
    /* Only the year is known. Sorted to the start of it and labelled with it,
       never given a month nobody announced. */
    const y = /^\d{4}/.exec(String(e.startDate || e.dateRaw || ""));
    return {
      mode: "year", date: y ? `${y[0]}-01-01` : "0000-01-01", month: y ? `${y[0]}-01` : null,
      year: y ? y[0] : "", status: "past", discontinued: true,
      label: y ? `Discontinued, last held in ${y[0]}` : "Discontinued",
    };
  }

  if (p === "exact" && isDay(e.startDate)) {
    const end = isDay(e.endDate) ? e.endDate : e.startDate;
    return {
      mode: "exact", date: e.startDate, end, month: e.startDate.slice(0, 7),
      status: statusOf(e.startDate, end, today),
      label: rangeLabel(e.startDate, end),
      days: daysBetween(today, e.startDate),
      weekday: weekday(e.startDate),
    };
  }

  if ((p === "month" || p === "season") && isMonth(e.startDate)) {
    const first = `${e.startDate}-01`;
    /* A season spans three months, and a past one should not read as
       imminent because its first month has gone by. */
    const lastMonth = p === "season"
      ? new Date(Date.UTC(Number(e.startDate.slice(0, 4)), Number(e.startDate.slice(5)) + 1, 1)).toISOString().slice(0, 7)
      : e.startDate;
    return {
      mode: "approx", date: first, month: e.startDate,
      status: statusOf(first, monthEnd(lastMonth), today),
      label: e.dateRaw,
    };
  }

  if (e.annual && isDay(e.lastHeld) && daysBetween(e.lastHeld, today) <= INFER_WITHIN_DAYS) {
    const at = nextAnniversary(e.lastHeld, today);
    return {
      mode: "inferred", date: at, month: at.slice(0, 7),
      status: statusOf(at, at, today),
      label: `Date not confirmed, last held ${dayLabel(e.lastHeld)}`,
      lastHeld: e.lastHeld,
    };
  }

  return {
    mode: "unscheduled", date: null, month: null, status: "unscheduled",
    label: isDay(e.lastHeld) ? `Last held ${dayLabel(e.lastHeld)}` : e.dateRaw && !/^(n\/a|tbd)/i.test(e.dateRaw) ? e.dateRaw : "",
    lastHeld: e.lastHeld || null,
  };
}

/*
 * The events with their placement attached, so a render reads one object.
 * `notes` is research scaffolding and leaves here: the index hands these to a
 * client island, and anything on them is in the page source.
 */
export const placed = (events = EVENTS, today = todayISO()) =>
  events.map(({ notes, ...e }) => ({ ...e, ...coordsFor(e), at: placeEvent(e, today) }));

/*
 * City-level `lat` and `lng`, from lib/eventCoords.js, which
 * scripts/geocode-events.mjs writes once and which is committed. Applied only
 * while the entry's city and country still match the ones the row was looked
 * up from: an event that moves city loses its coordinates until the script is
 * run again, rather than being shown at the distance of the old one.
 *
 * Returns {} when there is nothing to add, so callers can spread it.
 */
export function coordsFor(e) {
  const c = COORDS[e.id];
  if (!c || c.city !== String(e.city || "").trim() || c.country !== String(e.country || "").trim()) return {};
  return { lat: c.lat, lng: c.lng };
}

const byDate = (a, b) => (a.at.date < b.at.date ? -1 : a.at.date > b.at.date ? 1 : a.name.localeCompare(b.name));

/*
 * Everything the index renders, in one pass:
 *
 *  strip       the next twelve months starting with this one, each with a
 *              count of dated events and, apart, of unconfirmed ones,
 *              including the zeros. The zeros are the point: a strip that
 *              skipped empty months would hide exactly what it is for.
 *  timeline    every event with a place on the calendar, past and future, in
 *              one chronological run of month groups, oldest first. Past
 *              events stay in their months rather than moving to a list of
 *              their own: the calendar is one timeline you scroll back
 *              through, not a split between what happened and what has not.
 *              A discontinued event known only to the year groups under the
 *              year, never under a month nobody announced.
 *  nowMonth    this month's key, which is where the timeline opens.
 *  unscheduled no date and no recent edition to infer one from.
 */
export function agenda(events = EVENTS, today = todayISO()) {
  const all = placed(events, today);

  const dated = all.filter((e) => e.at.status !== "unscheduled").sort(byDate);
  const ahead = dated.filter((e) => e.at.status === "imminent" || e.at.status === "upcoming");
  const unscheduled = all.filter((e) => e.at.status === "unscheduled")
    .sort((a, b) => a.name.localeCompare(b.name));

  const timeline = [];
  for (const e of dated) {
    const key = e.at.mode === "year" ? e.at.year : e.at.month;
    let g = timeline[timeline.length - 1];
    if (!g || g.key !== key) {
      timeline.push(g = { key, label: e.at.mode === "year" ? e.at.year : monthLabel(key), items: [] });
    }
    g.items.push(e);
  }

  const strip = [];
  const [y0, m0] = today.split("-").map(Number);
  for (let i = 0; i < 12; i++) {
    const ym = new Date(Date.UTC(y0, m0 - 1 + i, 1)).toISOString().slice(0, 7);
    const inMonth = ahead.filter((e) => e.at.month === ym);
    /* An inferred date is not a scheduled one, so it is counted apart and
       never folded into the figure that says how busy a month is. */
    strip.push({
      month: ym,
      count: inMonth.filter((e) => e.at.mode !== "inferred").length,
      unconfirmed: inMonth.filter((e) => e.at.mode === "inferred").length,
    });
  }

  return {
    today, strip, timeline, unscheduled,
    nowMonth: today.slice(0, 7),
    imminent: ahead.filter((e) => e.at.status === "imminent").length,
  };
}

/** "In 12 days", "Today", "Tomorrow", "On now". Exact dates only. */
export function countdown(at, today = todayISO()) {
  if (at.mode !== "exact" || at.status !== "imminent") return "";
  const n = daysBetween(today, at.date);
  if (n > 1) return `In ${n} days`;
  if (n === 1) return "Tomorrow";
  if (n === 0) return "Today";
  return "On now";
}

/*
 * Relevance is ours, checked against each event's own site, not imported from
 * the sheet these came from. It is a statement about who the event is built
 * for, not about whether it is a good event.
 */
export const RELEVANCE_LABEL = {
  high: "Built for people who build on Shopify",
  medium: "A Shopify merchant event with app vendors in the room",
  low: "Not built for app vendors. Worth it only to meet the people who are there",
};
