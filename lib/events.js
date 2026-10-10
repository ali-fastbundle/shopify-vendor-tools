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
    one: "shopify's own developer conference, with the platform's engineering teams in the room",
    watch: "Tickets were $499 and the 2026 edition sold out with a waitlist, so the constraint is getting in rather than the price. No date for the next one yet; the site only offers a sign-up for news of it.",
    social: {},
    updated: "2026-10-07",
    notes: "2026: Jul 21-22, sold out. Third parties report a cap of six tickets per partner org and that it replaced Editions.dev; neither is on Shopify's page.",
  },
  {
    id: "the-wide-event",
    name: "The Wide Event",
    organizer: "Mat De Sousa",
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
    one: "a paris meetup for people who build shopify apps or sell on shopify, run by one person from the ecosystem",
    watch: "Run by an individual rather than a company, and announced through Eventbrite and the organiser's personal X account rather than a site of its own, so the next date tends to surface late. Held in May in 2024, 2025 and 2026, at a different venue each year.",
    social: {},
    updated: "2026-10-07",
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
    watch: "Run by FoxSell, which sells a Shopify bundle app, so a bundle app vendor attending is attending a competitor's event. The 2026 edition sold out and no ticket price was shown.",
    social: {},
    updated: "2026-10-07",
    notes: "2026-10-03 JW Marriott (organiser page, shop-quest.com). 2025 reportedly 2025-09-27 Ritz-Carlton Bangalore, search snippet only. Sponsors included STOQ, Shopify, Tiny SEO, Zapiet, Appmaker.",
  },

  /* ---------------------------------------------------------------- */
  /*  Shopify merchant events with app vendors in the room             */
  /* ---------------------------------------------------------------- */
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
    watch: "A merchant conference first: agencies and vendors take part as paying partners, so an app vendor is there to meet buyers, not peers. The programme is in German. There is a 2027 save-the-date sign-up but no date.",
    social: {},
    updated: "2026-10-07",
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
    watch: "Organised by GemCommerce, the company behind the GemPages page builder, which also sponsored the $149 delegate pass down to free. An app vendor in page building is a guest at a competitor's event.",
    social: {},
    updated: "2026-10-07",
    notes: "2025 edition: 250+ operators, 18 speakers, 17 sponsors (organiser's claim). Co-organiser EFE appears only in third-party sources.",
  },

  /* ---------------------------------------------------------------- */
  /*  Merchant, retail and general events                              */
  /* ---------------------------------------------------------------- */
  {
    id: "shoptalk-us",
    name: "Shoptalk Spring 2027",
    organizer: "Shoptalk (Hyve Group)",
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
    watch: "Qualifying retailers and brands can attend free and solution providers pay, which is the business model: as an app vendor you are the one buying access. Not about Shopify apps; worth it only if enterprise brands are your buyer.",
    social: {},
    updated: "2026-10-07",
  },
  {
    id: "shoptalk-europe",
    name: "Shoptalk Europe 2027",
    organizer: "Shoptalk (Hyve Group)",
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
    updated: "2026-10-07",
  },
  {
    id: "shoptalk-luxe",
    name: "Shoptalk Luxe 2027",
    organizer: "Shoptalk (Hyve Group)",
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
    watch: "Built for luxury brands, with vendors paying to be in the room at a price that is not published. Only relevant if luxury merchants are who you sell to.",
    social: {},
    updated: "2026-10-07",
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
    watch: "Nothing on the programme is about Shopify or ecommerce apps specifically, and at this size you will not find your buyers by chance. Go for investors or press, not merchants.",
    social: {},
    updated: "2026-10-10",
  },
  {
    id: "worldef-antalya",
    name: "WORLDEF Prime Antalya 2026",
    organizer: "WORLDEF (Incmice)",
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
    watch: "The Summit Pass is $540, or $740 with a stay, and partnership packages run from $5,990 to $51,990, so the vendor side pays heavily for the meetings. Ecommerce in general, not Shopify.",
    social: {},
    updated: "2026-10-07",
  },
  {
    id: "worldef-dubai",
    name: "WORLDEF Dubai 2027",
    organizer: "WORLDEF (Incmice)",
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
    watch: "General entry is free, with Executive passes from $199 and VIP from $999. Marketplace-led, with Amazon, Alibaba and noon among the partners, so the Shopify share of the room is small.",
    social: {},
    updated: "2026-10-07",
  },
  {
    id: "worldef-istanbul",
    name: "WORLDEF Istanbul 2027",
    organizer: "WORLDEF (Incmice)",
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
    watch: "Exhibitor and sponsor sales are the business, and the 30,000 figure is the organiser's. Seller and marketplace focused rather than Shopify, so most of the room is not running a Shopify store.",
    social: {},
    updated: "2026-10-07",
    notes: "2026 edition Jun 11-13 at Yenikapi. 2027 dates and venue from the same organiser page.",
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
    watch: "The site does not say which company runs it, and ticket prices are not shown. A general ecommerce floor where Shopify is one platform among many.",
    social: {},
    updated: "2026-10-07",
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
    watch: "Free for visitors because exhibitors pay, so expect to be pitched as much as to pitch. General ecommerce, not Shopify apps.",
    social: {},
    updated: "2026-10-07",
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
    watch: "Run by Pattern, which sells marketplace management to the brands attending, so the programme is partly its pitch. Marketplaces rather than Shopify.",
    social: {},
    updated: "2026-10-07",
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
    watch: "Run by a sell-side M&A advisory firm, and the event is where its deal flow comes from. About buying merchants, not apps; useful only if you are thinking about who would buy you.",
    social: {},
    updated: "2026-10-07",
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
    watch: "Powered by Shoplift, a Shopify A/B testing app, with Northbeam and Attentive as partners: an app vendor's own marketing event, so another app vendor attends as a guest of it. No sign yet of another edition.",
    social: {},
    updated: "2026-10-07",
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
    watch: "Sponsor-funded, with solution providers admitted on a curated basis rather than an open ticket. Runs in spring and fall, and the spring 2027 date is not published.",
    social: {},
    updated: "2026-10-07",
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
    updated: "2026-10-07",
  },
  {
    id: "suitetalks-shoptalk",
    name: "SUITETALKS at Shoptalk",
    organizer: "Avex",
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
    updated: "2026-10-07",
  },
  {
    id: "ecomm-connect-denver",
    name: "EComm Connect Denver",
    organizer: "Avex",
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
    updated: "2026-10-07",
  },
  {
    id: "shopify-unite",
    name: "Shopify Unite",
    organizer: "Shopify",
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
    watch: "Discontinued in practice rather than by announcement: the last single Unite was a livestream in June 2021, and 2022 was a series of two-day events in London, Toronto and Melbourne. Its old address was returning errors when checked.",
    social: {},
    updated: "2026-10-07",
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
    updated: "2026-10-07",
    notes: "Last verified edition 2026-09-09, ODEON Luxe West End. Third parties say Blend Commerce's founders run it; not on the organiser's pages.",
  },
  {
    id: "dtc-dines-vancouver",
    name: "DTC Dines Vancouver",
    organizer: "DTC Media",
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
    watch: "Sponsored by Klaviyo and Dataships, and the venue is disclosed only after your application is approved. Built for brand operators, so an app vendor would be applying to a room of prospects.",
    social: {},
    updated: "2026-10-07",
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
