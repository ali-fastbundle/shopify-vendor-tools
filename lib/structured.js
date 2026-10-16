/*
 * Proposed structured data per tool: attributes, pricing tiers and
 * integrations, drafted on 2026-10-16 from each entry's own text in
 * lib/tools.js (note, price, watch, tags) and nothing else. No site was
 * fetched. Anything the text does not state is "unknown".
 *
 * A proposal is never public. It is what the Structured data tab on /admin
 * shows beside the note, with `evidence` (the quote each value rests on) and
 * `doubts` (what the drafting could not settle). Confirming it there writes
 * the reviewed version to Redis (lib/structuredStore.js), and only that is
 * shown on the site. Shapes and rules: lib/categories.js.
 */
export const PROPOSED = {
  "appjubilee": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": 30,
      "competitorAlerts": "unknown",
      "listingAudit": "unknown",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 49,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Agency",
          "amount": 499,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "By number of apps"
    },
    "evidence": {
      "appsPerPlan": "up to $499 for 30 on the agency tier",
      "pricing": "Pricing is by the number of apps: $49 for one, up to $499 for 30 on the agency tier."
    },
    "doubts": [
      "\"Tracks 1,200+ App Store keywords a day\" is a site-wide count by its own claim, not a per-plan limit, so keywordsTracked is left unknown.",
      "Intermediate tiers between $49 (1 app) and $499 (30 apps) are implied by \"up to\" but not listed.",
      "\"Maps the full set of competing apps\" and \"correlates listing changes with ranking movement\" are not stated as alerts or a listing audit, so both are unknown."
    ]
  },
  "appstorepulse": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": "unknown",
      "competitorAlerts": true,
      "listingAudit": true,
      "api": "unknown"
    },
    "integrations": [
      "partner-api"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Paid tier price not stated"
    },
    "evidence": {
      "competitorAlerts": "daily detection of competitor changes to pricing and listings",
      "listingAudit": "an AI listing audit against the top 10 in your category",
      "partner-api": "Connect a Partner account and it adds live MRR, ARR, churn, trials",
      "pricing": "Free tier, then paid"
    },
    "doubts": [
      "Catalogue price is \"Free tier, then paid\": paid amounts are not in the text, so tiers are empty though pricing is not stated to be unpublished.",
      "partner-api is inferred from \"Connect a Partner account\"; the text does not say \"Partner API\" verbatim.",
      "keywordsTracked and appsPerPlan are only stated for the free tier (3 keywords, 1 app), not the largest plan.",
      "\"Detection of competitor changes\" is read as competitor alerts; the text does not say how detections are delivered."
    ]
  },
  "tracksami": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": "unknown",
      "competitorAlerts": "unknown",
      "listingAudit": "unknown",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 8,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": ""
    },
    "evidence": {
      "pricing": "$8 per month"
    },
    "doubts": [
      "Pricing conflict: the catalogue records \"$8 per month\" (comment says read from the homepage 2026-10-13), but the editor believes SAMI publishes no pricing. The catalogue figure is recorded here; confirm before publishing.",
      "The 27,000+ figure is the size of its curated keyword database, not a per-plan tracking limit, so keywordsTracked is left unknown.",
      "\"Compare up to 40 apps side by side\" is a comparison limit, not apps per plan, so appsPerPlan is left unknown.",
      "Category pulse (daily gainers and losers) is not described as alerts, so competitorAlerts is unknown."
    ]
  },
  "bestappify": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": "unknown",
      "competitorAlerts": true,
      "listingAudit": "unknown",
      "api": "unknown"
    },
    "integrations": [
      "mcp"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Paid plan price not stated"
    },
    "evidence": {
      "competitorAlerts": "with daily competitor checks",
      "mcp": "exposed as an MCP server",
      "pricing": "Free plan available"
    },
    "doubts": [
      "\"Daily competitor checks\" (plus an \"alerts\" tag) is read as competitor alerts; the text does not say a notification is sent.",
      "Whether a paid plan exists and what it costs is not in the text.",
      "MCP access is recorded as mcp, not as a REST API, so api stays unknown."
    ]
  },
  "letsmetrix": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": "unknown",
      "competitorAlerts": "unknown",
      "listingAudit": "unknown",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "pricing": "Category rankings and collections, free on both sides."
    },
    "doubts": [
      "\"Developer analytics sit behind a login\": the text does not say whether that part is paid."
    ]
  },
  "appnavigator": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": "unknown",
      "competitorAlerts": false,
      "listingAudit": "unknown",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "competitorAlerts": "Read-only. No alerts and no tracking of your own listing.",
      "pricing": "The easiest way to check a competitor without paying anything."
    },
    "doubts": [
      "\"No tracking of your own listing\" suggests no listing audit, but does not say so, so listingAudit is left unknown.",
      "\"Most of it open without signing up\" leaves open whether any part needs an account or payment."
    ]
  },
  "sasi": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": "unknown",
      "competitorAlerts": true,
      "listingAudit": "unknown",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Winding down with Mantle"
    },
    "evidence": {
      "competitorAlerts": "app and keyword following, and change notifications",
      "pricing": "Free"
    },
    "doubts": [
      "Change notifications on followed apps are read as competitor alerts; the text does not say the followed apps are competitors specifically.",
      "The product is winding down (dying: true), so any value may stop being true."
    ]
  },
  "ranksy": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": "unknown",
      "competitorAlerts": "unknown",
      "listingAudit": "unknown",
      "api": "unknown"
    },
    "integrations": [
      "partner-api"
    ],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": 7,
      "tiers": [
        {
          "name": "Starter",
          "amount": 39,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Studio",
          "amount": 89,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": ""
    },
    "evidence": {
      "partner-api": "joins BigQuery listing traffic to Shopify Partner API revenue",
      "pricing": "Starter is $39 a month for 3 apps, and Studio is $89 for a team."
    },
    "doubts": [
      "appsPerPlan: Starter is 3 apps but the largest plan (Studio) states no app count, so it is unknown.",
      "BigQuery is required but is not in the INTEGRATIONS vocabulary, so it is not recorded.",
      "No free plan, yet the Chrome extension and app lookup are free; free is recorded as false per the plan."
    ]
  },
  "rankbase": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": 20,
      "competitorAlerts": "unknown",
      "listingAudit": "unknown",
      "api": true
    },
    "integrations": [
      "ga4",
      "slack",
      "rest-api",
      "csv"
    ],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "Growth",
          "amount": 49,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Business",
          "amount": 99,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "Growth 5 apps, Business 20"
    },
    "evidence": {
      "appsPerPlan": "Business is $99 for 20",
      "api": "a REST API",
      "ga4": "It needs a Google Analytics 4 connection and existing traffic.",
      "slack": "Slack and email alerts",
      "rest-api": "a REST API, CSV export, multiple apps and multiple languages are included",
      "csv": "CSV export",
      "pricing": "Growth is $49 a month for 5 apps, and Business is $99 for 20."
    },
    "doubts": [
      "\"Slack and email alerts\" are not said to cover competitor changes, so competitorAlerts is unknown.",
      "A \"changelog of listing edits\" is not a listing audit, so listingAudit is unknown.",
      "GA4 is a required data source rather than an optional integration."
    ]
  },
  "becketto": {
    "attrs": {
      "keywordsTracked": "unknown",
      "appsPerPlan": "unknown",
      "competitorAlerts": "unknown",
      "listingAudit": "unknown",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "pricing": "Free, with no pricing page and no paid tier anywhere on it."
    },
    "doubts": [
      "There is no pricing page, but the tool is stated to be free with no paid tier, so pricing is recorded as published and free rather than not published.",
      "No keyword or app limits are stated."
    ]
  },
  "applora": {
    "attrs": {
      "appsCovered": 28200,
      "reviewHistory": true,
      "rankingHistory": true,
      "api": true,
      "export": true
    },
    "integrations": [
      "mcp",
      "csv"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "Pro",
          "amount": 49,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": ""
    },
    "evidence": {
      "appsCovered": "28.2K apps tracked, with 27.8K currently listed and 365 delisted.",
      "reviewHistory": "1.1M reviews indexed",
      "rankingHistory": "Pro adds 365 days of history",
      "api": "15 live tools over remote MCP, plus published agent skills",
      "export": "Pro adds 365 days of history, CSV export and 5,000 MCP calls.",
      "mcp": "free on the web and over MCP",
      "csv": "CSV export",
      "pricing": "Free, Pro $49/mo"
    },
    "doubts": [
      "appsCovered uses the rounded 28.2K tracked figure; 27.8K are currently listed.",
      "The API is MCP. A REST API is not named in the text (only the tag \"api\"), so rest-api is not set; api=true rests on MCP access.",
      "\"365 days of history\" does not say which data it covers; rankingHistory and reviewHistory are read from it and the indexed reviews.",
      "Pro also includes 5,000 MCP calls; whether calls beyond that are billed is not stated."
    ]
  },
  "elevate": {
    "attrs": {
      "mrr": true,
      "churn": true,
      "ltv": true,
      "runsBilling": "unknown",
      "installAttribution": true
    },
    "integrations": [
      "partner-api"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "For approved Marmeto partners"
    },
    "evidence": {
      "mrr": "MRR, ARR, churn and retention for Shopify app companies.",
      "churn": "Revenue churn and customer churn are tracked separately.",
      "ltv": "It covers customer health and LTV",
      "installAttribution": "install-source analytics",
      "partner-api": "direct Shopify Partner account integration",
      "pricing": "Free for Marmeto partners"
    },
    "doubts": [
      "Pricing for non-partners is not stated; unclear whether it is available at all outside the partner programme.",
      "installAttribution read from \"install-source analytics\"; it may report sources rather than attribute installs to revenue."
    ]
  },
  "mantle": {
    "attrs": {
      "mrr": true,
      "churn": true,
      "ltv": "unknown",
      "runsBilling": true,
      "installAttribution": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": false,
      "free": false,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Winding down"
    },
    "evidence": {
      "mrr": "tags: \"billing\", \"mrr\", \"churn\"",
      "churn": "tags: \"billing\", \"mrr\", \"churn\"",
      "runsBilling": "Mantle wrapped Shopify's Billing API, so the subscriptions themselves live on Shopify.",
      "pricing": "price: \"Winding down\""
    },
    "doubts": [
      "mrr and churn come from tags only; the note and one-liner say \"analytics\" without naming metrics.",
      "runsBilling describes the past: Mantle Billing ran until 30 September 2026, which has passed as of 2026-10-16.",
      "free:false is the entry's own field; no price was ever stated in the text."
    ]
  },
  "fusionmetrics": {
    "attrs": {
      "mrr": true,
      "churn": true,
      "ltv": true,
      "runsBilling": "unknown",
      "installAttribution": true
    },
    "integrations": [
      "ga4",
      "partner-api"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 25,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 99,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Self-hosted license",
          "amount": 999,
          "currency": "USD",
          "period": "one-time",
          "unit": "flat"
        }
      ],
      "note": "Free under $5k MRR"
    },
    "evidence": {
      "mrr": "A revenue dashboard with MRR, churn, LTV and ARPU.",
      "churn": "A revenue dashboard with MRR, churn, LTV and ARPU.",
      "ltv": "A revenue dashboard with MRR, churn, LTV and ARPU.",
      "installAttribution": "ad click, App Store visit, install, then the revenue after it.",
      "ga4": "Puts Google Analytics 4 next to Shopify Partner data.",
      "partner-api": "Puts Google Analytics 4 next to Shopify Partner data.",
      "pricing": "free under $5k MRR, $25 a month above that, $99 above $10k, and custom above $1M ARR."
    },
    "doubts": [
      "The $99 tier's period is not stated explicitly; read as monthly from the $25 a month before it.",
      "\"$99 above $10k\" does not say $10k MRR; assumed MRR from context.",
      "partner-api inferred from \"Shopify Partner data\" and the tag \"partner api\"; the text does not say Partner API directly."
    ]
  },
  "saasinsights": {
    "attrs": {
      "mrr": true,
      "churn": true,
      "ltv": "unknown",
      "runsBilling": "unknown",
      "installAttribution": "unknown"
    },
    "integrations": [
      "partner-api",
      "slack"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": 14,
      "tiers": [
        {
          "name": "",
          "amount": 49,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 490,
          "currency": "USD",
          "period": "year",
          "unit": "flat"
        }
      ],
      "note": "Free under $2.5k a month in revenue"
    },
    "evidence": {
      "mrr": "MRR, ARR, ARPU, churn and trial conversion come from the Partner API",
      "churn": "MRR, ARR, ARPU, churn and trial conversion come from the Partner API",
      "partner-api": "MRR, ARR, ARPU, churn and trial conversion come from the Partner API",
      "slack": "custom reports, forecasting and Slack or email notifications",
      "pricing": "Free until an app earns $2.5k a month, then $49 a month or $490 a year."
    },
    "doubts": [
      "$49 a month and $490 a year are likely the same tier billed two ways, not two tiers.",
      "Whether the $2.5k free threshold is per app or per account is not stated.",
      "A 30% Mantle migration discount for three months is not modelled in the tiers."
    ]
  },
  "appvitals": {
    "attrs": {
      "mrr": true,
      "churn": true,
      "ltv": true,
      "runsBilling": "unknown",
      "installAttribution": true
    },
    "integrations": [
      "partner-api",
      "ga4",
      "slack"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 15,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "Free under $1k MRR, banded by MRR above"
    },
    "evidence": {
      "mrr": "MRR, ARR, churn, retention and LTV are recomputed from the append-only Partner event feed",
      "churn": "MRR, ARR, churn, retention and LTV are recomputed from the append-only Partner event feed",
      "ltv": "MRR, ARR, churn, retention and LTV are recomputed from the append-only Partner event feed",
      "installAttribution": "GA4 listing-traffic attribution from listing view to install to paying subscriber",
      "partner-api": "revenue analytics from the Shopify Partner API",
      "ga4": "GA4 listing-traffic attribution from listing view to install to paying subscriber",
      "slack": "Slack and email rules cover all of it.",
      "pricing": "free under $1,000 a month, $15 above that, rising in brackets to over $1M."
    },
    "doubts": [
      "Only the lowest paid band ($15) is stated; the higher brackets are not.",
      "\"One definition of MRR ... on your own bill\" refers to AppVitals billing you, not to running billing for your app, so runsBilling stays unknown.",
      "GA4 attribution needs a BigQuery export (BigQuery is not in the vocabulary)."
    ]
  },
  "affilitrak": {
    "attrs": {
      "attribution": "installs and revenue",
      "paysAffiliates": true,
      "partnerPortal": "unknown",
      "mantleImport": true,
      "platformFee": "20% of what you pay affiliates introduced by the Affilitrak marketplace (announced, not charged yet)"
    },
    "integrations": [
      "partner-api",
      "ga4"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "20% on marketplace affiliates, not charged yet"
    },
    "evidence": {
      "attribution": "Tracks installs and recurring revenue, runs commission rules and pays affiliates through PayPal.",
      "paysAffiliates": "pays affiliates through PayPal",
      "mantleImport": "It imports affiliates, referral codes, referral history and payout history from Mantle.",
      "platformFee": "a 20% cut of what you pay affiliates that the Affilitrak marketplace introduced you to",
      "partner-api": "Attribution uses the Partner API for installs and revenue, plus GA4 and BigQuery",
      "ga4": "Attribution uses the Partner API for installs and revenue, plus GA4 and BigQuery",
      "pricing": "It is free at $0 a month for unlimited apps, with no caps."
    },
    "doubts": [
      "The 20% marketplace fee is announced but not charged yet, so the platform fee and 'free' are not settled.",
      "BigQuery is named but is not in the INTEGRATIONS vocabulary, so it is not recorded."
    ]
  },
  "partnerdock": {
    "attrs": {
      "attribution": "installs",
      "paysAffiliates": "unknown",
      "partnerPortal": "unknown",
      "mantleImport": false,
      "platformFee": "0% commission on payouts"
    },
    "integrations": [
      "partner-api",
      "ga4",
      "csv"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 19,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 49,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 99,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": ""
    },
    "evidence": {
      "attribution": "Click-to-install matching uses the Shopify Partner API and GA4.",
      "mantleImport": "It offers a hands-on migration call, not a self-serve importer.",
      "platformFee": "0% commission on payouts and unlimited affiliates on every plan",
      "partner-api": "Click-to-install matching uses the Shopify Partner API and GA4.",
      "ga4": "Click-to-install matching uses the Shopify Partner API and GA4.",
      "csv": "PayPal mass-payout CSV export",
      "pricing": "Free, then $19 / $49 / $99"
    },
    "doubts": [
      "The price text gives no billing period for $19 / $49 / $99. Month is assumed and needs checking.",
      "Tier names are not stated.",
      "Only install matching is stated. Whether revenue is attributed is not said.",
      "It produces a PayPal mass-payout CSV export. Whether it pays affiliates itself or only prepares the file is unclear, so paysAffiliates is unknown.",
      "mantleImport is false because there is no self-serve importer, but a hands-on migration call is offered."
    ]
  },
  "shoffi": {
    "attrs": {
      "attribution": "unknown",
      "paysAffiliates": "unknown",
      "partnerPortal": "unknown",
      "mantleImport": "unknown",
      "platformFee": "unknown"
    },
    "integrations": [
      "partner-api",
      "ga4"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Until $100 a month referred"
    },
    "evidence": {
      "partner-api": "Tracking uses the Shopify Partner API and GA4, with no code.",
      "ga4": "Tracking uses the Shopify Partner API and GA4, with no code.",
      "pricing": "Free until $100/mo referred"
    },
    "doubts": [
      "Tracking is stated but not whether it attributes installs, revenue or both. The '$25M referred revenue' claim hints at revenue but does not state the method.",
      "It has 'payment tracking', which may or may not mean it pays affiliates.",
      "Pricing above $100/mo referred is not stated, so the platform fee is unknown."
    ]
  },
  "partnerjam": {
    "attrs": {
      "attribution": "unknown",
      "paysAffiliates": "unknown",
      "partnerPortal": "unknown",
      "mantleImport": "unknown",
      "platformFee": "unknown"
    },
    "integrations": [
      "partner-api"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "partner-api": "Free, cookie-independent, direct Partner API integration.",
      "pricing": "Free"
    },
    "doubts": [
      "The note mentions install attribution only as a general point about the App Store, not as a stated feature, so attribution is unknown.",
      "Entry is verified: false, so every figure comes from secondary sources.",
      "Free with no fee stated, but the text does not explicitly say there is no platform fee."
    ]
  },
  "orbit": {
    "attrs": {
      "attribution": "unknown",
      "paysAffiliates": true,
      "partnerPortal": true,
      "mantleImport": "unknown",
      "platformFee": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "For approved Marmeto partners"
    },
    "evidence": {
      "paysAffiliates": "It onboards partners, receives leads from them and pays commissions.",
      "partnerPortal": "White-label partner portals carry your branding.",
      "pricing": "Free for Marmeto partners"
    },
    "doubts": [
      "It pays commissions to partners in a PRM sense. Whether these are affiliates in the same sense as the trackers is not stated.",
      "Free applies to Marmeto partners. Pricing for anyone else is not stated.",
      "Lead-based PRM, so install or revenue attribution is not stated."
    ]
  },
  "krutva": {
    "attrs": {
      "attribution": "unknown",
      "paysAffiliates": "unknown",
      "partnerPortal": "unknown",
      "mantleImport": "unknown",
      "platformFee": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": false,
      "free": false,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "pricing": "Not published"
    },
    "doubts": [
      "free is false from the entry's field. The text never says there is no free plan.",
      "Least evidenced listing in the directory, and it is not confirmed to serve Shopify app vendors."
    ]
  },
  "partnerstack": {
    "attrs": {
      "attribution": "unknown",
      "paysAffiliates": true,
      "partnerPortal": "unknown",
      "mantleImport": "unknown",
      "platformFee": "unknown"
    },
    "integrations": [
      "slack"
    ],
    "pricing": {
      "published": false,
      "free": false,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Set per program in a demo"
    },
    "evidence": {
      "paysAffiliates": "automated commission payouts across partner types",
      "slack": "lead submission from email and Slack",
      "pricing": "Pricing is not published at all. It is set per program during a demo"
    },
    "doubts": [
      "The watch says there is no install attribution and no Partner API connection. It does full-funnel reporting, but revenue attribution is not stated, so attribution is unknown rather than 'revenue'.",
      "free is false from the entry's field. The text does not explicitly say there is no free plan.",
      "Not Shopify-specific (shopifyExclusive: false)."
    ]
  },
  "storeleads": {
    "attrs": {
      "storesCovered": 3027144,
      "platforms": "Shopify and 408 other platforms (409 in all)",
      "installHistory": true,
      "contactsIncluded": "unknown",
      "export": true,
      "crmIntegrations": "HubSpot"
    },
    "integrations": [
      "hubspot",
      "rest-api"
    ],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 75,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 250,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 450,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 950,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": ""
    },
    "evidence": {
      "storesCovered": "3,027,144 Shopify stores of 13,727,714 total across 409 platforms (Shopify figure used)",
      "platforms": "13,727,714 total across 409 platforms",
      "installHistory": "a historic changelog of installs and uninstalls",
      "export": "tags: export",
      "crmIntegrations": "HubSpot native",
      "hubspot": "HubSpot native",
      "rest-api": "tags: api",
      "pricing": "$75 / $250 / $450 / $950 per month"
    },
    "doubts": [
      "Export and API rest only on the tags \"export\" and \"api\"; the note and watch never mention either.",
      "No contacts are mentioned either way."
    ]
  },
  "storecensus": {
    "attrs": {
      "storesCovered": 4000000,
      "platforms": "Shopify, WooCommerce",
      "installHistory": "unknown",
      "contactsIncluded": true,
      "export": true,
      "crmIntegrations": "Apollo, Instantly, SmartLead"
    },
    "integrations": [
      "apollo"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Then $49 / $99, billing period not stated"
    },
    "evidence": {
      "storesCovered": "4M+ Shopify and WooCommerce stores",
      "platforms": "4M+ Shopify and WooCommerce stores",
      "contactsIncluded": "Founder and CMO contacts are built in, SMTP-verified.",
      "export": "pick a competitor app, export the stores running it",
      "crmIntegrations": "It pushes to Apollo, Instantly and SmartLead.",
      "apollo": "It pushes to Apollo, Instantly and SmartLead.",
      "pricing": "Free plan, then $49 / $99"
    },
    "doubts": [
      "4M+ is a combined Shopify and WooCommerce figure; no Shopify-only figure is given.",
      "The $49 and $99 tiers have no stated billing period, so no tiers were built.",
      "Instantly and SmartLead are outreach tools rather than CRMs; Apollo is the only one in the vocabulary.",
      "8,500+ app install detection is current detection; no install history is stated.",
      "Export format (CSV or other) is not stated, so csv was not added."
    ]
  },
  "storeinspect": {
    "attrs": {
      "storesCovered": 1400000,
      "platforms": "Shopify",
      "installHistory": "unknown",
      "contactsIncluded": true,
      "export": true,
      "crmIntegrations": "unknown"
    },
    "integrations": [
      "csv",
      "rest-api"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": 7,
      "tiers": [
        {
          "name": "Pro",
          "amount": 49,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Pro",
          "amount": 468,
          "currency": "USD",
          "period": "year",
          "unit": "flat"
        },
        {
          "name": "Business",
          "amount": 149,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Enterprise",
          "amount": 349,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": ""
    },
    "evidence": {
      "storesCovered": "A searchable database of 1,400,000+ Shopify stores and 1,440,000+ contacts.",
      "platforms": "1.4M Shopify stores, filtered by the apps they already run.",
      "contactsIncluded": "1,400,000+ Shopify stores and 1,440,000+ contacts",
      "export": "Pro is $49 a month, or $468 a year, for 1,000 reveals, 10,000 store exports, CSV and API.",
      "csv": "10,000 store exports, CSV and API",
      "rest-api": "10,000 store exports, CSV and API",
      "pricing": "Pro is $49 a month, or $468 a year"
    },
    "doubts": [
      "Business ($149) and Enterprise ($349) are not given a period in the note; read as monthly from context.",
      "The 7-day trial applies only where a company email qualifies.",
      "Export, CSV and API are paid-plan only; the free tier has none.",
      "Filters by apps installed but no install history is stated."
    ]
  },
  "alertcommerce": {
    "attrs": {
      "storesCovered": "unknown",
      "platforms": "Shopify",
      "installHistory": true,
      "contactsIncluded": true,
      "export": "unknown",
      "crmIntegrations": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": 14,
      "tiers": [
        {
          "name": "",
          "amount": 199,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "Card required for the trial"
    },
    "evidence": {
      "platforms": "Watches live Shopify stores for the moment a merchant might switch.",
      "installHistory": "It watches for a competitor app installed or uninstalled",
      "contactsIncluded": "a decision-maker's name, role and verified email",
      "pricing": "14-day trial, then $199/mo"
    },
    "doubts": [
      "Store count conflicts on its own pages: 1M+ on About, 1.5M+ on Pricing, so storesCovered is unknown.",
      "installHistory is set from install and uninstall alerts; whether a historic record is browsable is not stated.",
      "It has a built-in pipeline, but no external CRM is named.",
      "Calls itself a private beta while charging."
    ]
  },
  "builtwith": {
    "attrs": {
      "storesCovered": 6672791,
      "platforms": "Any site: Shopify, WooCommerce, BigCommerce, Magento, Salesforce Commerce and more",
      "installHistory": "unknown",
      "contactsIncluded": "unknown",
      "export": true,
      "crmIntegrations": "unknown"
    },
    "integrations": [
      "rest-api"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": 0,
      "tiers": [
        {
          "name": "",
          "amount": 295,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 495,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 995,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "Free account does single lookups"
    },
    "evidence": {
      "storesCovered": "26M ecommerce sites and 6,672,791 live Shopify sites (Shopify figure used)",
      "platforms": "It finds merchants running WooCommerce, BigCommerce, Magento or Salesforce Commerce",
      "export": "Lists, exports and the API need a plan.",
      "rest-api": "Lists, exports and the API need a plan.",
      "pricing": "Free lookups, then $295 / $495 / $995 a month"
    },
    "doubts": [
      "20 years of adoption history is technology-level, and the watch says it lists no individual app detection, so app install history is left unknown.",
      "trialDays 0 from \"There is no free trial either\"; the free single-site lookup is permanent.",
      "Export format not stated, so csv was not added."
    ]
  },
  "cartinsight": {
    "attrs": {
      "storesCovered": 392849,
      "platforms": "Shopify, WooCommerce, BigCommerce, Magento, Amazon, Etsy, eBay, Walmart and about fifteen smaller carts",
      "installHistory": "unknown",
      "contactsIncluded": true,
      "export": true,
      "crmIntegrations": "HubSpot, Salesforce, Pipedrive, Copper, Insightly, Capsule"
    },
    "integrations": [
      "hubspot"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 0.083,
          "currency": "USD",
          "period": "one-time",
          "unit": "per lead"
        }
      ],
      "note": "250 to 10,000 leads a month"
    },
    "evidence": {
      "storesCovered": "524,047 stores by its own count on 23 August 2026. That is 392,849 Shopify (Shopify figure used)",
      "platforms": "392,849 Shopify, 74,191 WooCommerce, 23,106 BigCommerce and 19,834 Magento, plus Amazon, Etsy, eBay and Walmart sellers",
      "contactsIncluded": "It includes 75,000+ human-researched contacts",
      "export": "You buy downloads, not seats, from 250 to 10,000 a month",
      "crmIntegrations": "It pushes to HubSpot, Salesforce, Pipedrive, Copper, Insightly and Capsule",
      "hubspot": "It pushes to HubSpot, Salesforce, Pipedrive, Copper, Insightly and Capsule",
      "pricing": "$0.083 a lead, on download tiers from 250 to 10,000 a month. Free account to start"
    },
    "doubts": [
      "Contacts cover 75,000 of 524,047 stores, so most rows have no person attached.",
      "No reverse lookup of which stores run a given app is shown; install history unknown.",
      "Per-lead tier prices of each download tier are not given, only the $0.083 rate.",
      "Download format not stated, so csv was not added.",
      "Ownership stated two ways (Ready Innovations Inc. and Better Industries Inc.)."
    ]
  },
  "etailinsights": {
    "attrs": {
      "storesCovered": 500000,
      "platforms": "unknown",
      "installHistory": "unknown",
      "contactsIncluded": true,
      "export": "unknown",
      "crmIntegrations": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": false,
      "free": false,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Quoted, 3% added to card payments"
    },
    "evidence": {
      "storesCovered": "500,000+ online retailers, 750+ technologies tracked and 190,000+ verified contacts by its own count.",
      "contactsIncluded": "190,000+ verified contacts by its own count",
      "pricing": "Not published. Quoted on an order form, with 3% added to card payments"
    },
    "doubts": [
      "500,000+ is online retailers across all platforms; no Shopify figure is given.",
      "\"has CRM integration\" but no CRM is named, so crmIntegrations is unknown.",
      "A trial signup is mentioned but its length is not.",
      "Platforms are tracked as stack data but none are named.",
      "No individual Shopify app detection is shown; install history unknown."
    ]
  },
  "storeradar": {
    "attrs": {
      "storesCovered": 400000,
      "platforms": "Shopify",
      "installHistory": "unknown",
      "contactsIncluded": true,
      "export": true,
      "crmIntegrations": "unknown"
    },
    "integrations": [
      "csv"
    ],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 99,
          "currency": "USD",
          "period": "one-time",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 299,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "",
          "amount": 699,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "$99 one-time is 500 stores"
    },
    "evidence": {
      "storesCovered": "An agent scores 400,000+ live Shopify storefronts against them",
      "platforms": "400,000+ live Shopify storefronts",
      "contactsIncluded": "a contact address from the store's own contact, about or policy pages",
      "export": "only matched rows come back, as a CSV by email in minutes",
      "csv": "as a CSV by email in minutes",
      "pricing": "$99 one-time for 500 stores, then $299 or $699 a month"
    },
    "doubts": [
      "Contacts are store contact addresses scraped from the store's pages, not named decision-makers.",
      "The $99 sample is described as the trial; no trial in days.",
      "API is on the roadmap, so rest-api was not added.",
      "App detection covers a handful of large apps only; no install history stated."
    ]
  },
  "shopscan": {
    "attrs": {
      "detectsApps": true,
      "detectsTheme": true,
      "browserExtension": true,
      "freeChecks": "Free",
      "api": true
    },
    "integrations": [
      "rest-api"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "API paid, price not stated"
    },
    "evidence": {
      "detectsApps": "App and theme detector with a wide free tool set.",
      "detectsTheme": "App and theme detector with a wide free tool set.",
      "browserExtension": "Chrome, Firefox and Edge extensions.",
      "freeChecks": "Free, API paid",
      "api": "Free, API paid",
      "rest-api": "Free, API paid",
      "pricing": "Free, API paid"
    },
    "doubts": [
      "No limit on free checks is stated",
      "API price and whether it is a REST API are not stated"
    ]
  },
  "welookup": {
    "attrs": {
      "detectsApps": true,
      "detectsTheme": "unknown",
      "browserExtension": true,
      "freeChecks": "Free",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "detectsApps": "Extension-first store analysis, 7,548 apps and tools.",
      "browserExtension": "The extension is the product.",
      "freeChecks": "Free",
      "pricing": "Free"
    },
    "doubts": [
      "Theme detection is not mentioned",
      "No limit on free checks is stated"
    ]
  },
  "copyfy": {
    "attrs": {
      "detectsApps": true,
      "detectsTheme": "unknown",
      "browserExtension": false,
      "freeChecks": "Free, no sign-up, one store at a time",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "detectsApps": "lists the apps whose code it finds there",
      "browserExtension": "A web page, not an extension.",
      "freeChecks": "Free, no sign-up",
      "pricing": "Free, no sign-up"
    },
    "doubts": [
      "A theme detector is a separate sibling tool, not this detector",
      "freeChecks has no stated numeric limit, only one store at a time"
    ]
  },
  "sellercenter": {
    "attrs": {
      "storesCovered": 2400000,
      "platforms": "Shopify",
      "installHistory": "unknown",
      "contactsIncluded": "unknown",
      "export": true,
      "crmIntegrations": "unknown"
    },
    "integrations": [
      "csv"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "Basic",
          "amount": 9.99,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Pro",
          "amount": 29.99,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Expert",
          "amount": 99.99,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "100 free credits a month, half price yearly"
    },
    "evidence": {
      "storesCovered": "A searchable database of 2.4M+ Shopify stores by its own count.",
      "platforms": "A searchable database of 2.4M+ Shopify stores by its own count.",
      "export": "paid plans have CSV export",
      "csv": "paid plans have CSV export",
      "pricing": "100 free credits a month, then $9.99 / $29.99 / $99.99 a month, half that billed yearly"
    },
    "doubts": [
      "It filters on whether a store shows an email, but contacts as such are not stated.",
      "The app filter is only whether a store has apps installed, not which app; no install history.",
      "Export is paid plans only; free accounts cannot export.",
      "Search results capped at 300 on free and Basic, 1,000 on Expert."
    ]
  },
  "winninghunter": {
    "attrs": {
      "storesCovered": 5000000,
      "platforms": "Shopify",
      "installHistory": "unknown",
      "contactsIncluded": "unknown",
      "export": "unknown",
      "crmIntegrations": "unknown"
    },
    "integrations": [
      "rest-api",
      "mcp"
    ],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "Basic",
          "amount": 49,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Standard",
          "amount": 79,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Enterprise",
          "amount": 249,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "15% off quarterly, 40% off yearly"
    },
    "evidence": {
      "storesCovered": "Ad spy platform whose store explorer filters 5M+ stores by installed app.",
      "platforms": "A Shopify Store Explorer sits underneath.",
      "rest-api": "An HTTP API and an MCP server use the same key",
      "mcp": "An HTTP API and an MCP server use the same key",
      "pricing": "$49 / $79 / $249 a month, 15% off quarterly, 40% off yearly"
    },
    "doubts": [
      "5M+ stores is self-reported and not stated as Shopify-only.",
      "A free trial with no card exists but its length is not stated.",
      "API is described as HTTP, mapped to rest-api.",
      "store_apps filters current installed apps; no install history stated."
    ]
  },
  "koalainspector": {
    "attrs": {
      "detectsApps": true,
      "detectsTheme": true,
      "browserExtension": true,
      "freeChecks": "15 analyses a month",
      "api": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "Premium",
          "amount": 22,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "15 free checks a month, token packs from $3.99"
    },
    "evidence": {
      "detectsApps": "it returns the installed apps, the active theme",
      "detectsTheme": "it returns the installed apps, the active theme",
      "browserExtension": "Chrome extension reading a store's apps, theme and estimated numbers.",
      "freeChecks": "The free plan is 15 analyses a month and does not expire.",
      "pricing": "Free, 15 checks a month. Premium $22/mo, token packs from $3.99"
    },
    "doubts": []
  },
  "ppspy": {
    "attrs": {
      "detectsApps": true,
      "detectsTheme": true,
      "browserExtension": true,
      "freeChecks": "unknown",
      "api": true
    },
    "integrations": [
      "rest-api"
    ],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "Standard",
          "amount": 39,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Pro",
          "amount": 99,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Business",
          "amount": 299,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "30% off yearly"
    },
    "evidence": {
      "detectsApps": "with app, theme and pixel detection",
      "detectsTheme": "with app, theme and pixel detection",
      "browserExtension": "an ad tracker and a Chrome extension",
      "api": "the Shop Explorer, which filters the same store set by revenue, keywords and search volume, and the API",
      "rest-api": "Dropshipper spy tool, with a store explorer and an API behind it.",
      "pricing": "Free plan, then $39 / $99 / $299 a month"
    },
    "doubts": [
      "Free tier exists but its check allowance is not stated",
      "Trial length not stated",
      "API type and price not stated",
      "Detection coverage figures are its own count"
    ]
  },
  "marmeto": {
    "attrs": {
      "products": 12,
      "covers": "Partner and app tools (revenue analytics, partner programs, feedback, logistics API, payouts, NPS) and brand tools (analytics, marketplaces, checkout, OTP login",
      "freeForPartners": true
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Most tools, for approved partners"
    },
    "evidence": {
      "products": "Twelve products across the partner side and the merchant side.",
      "covers": "Six products for partners, apps and agencies ... Six more for brands",
      "freeForPartners": "Most of it is free only if you register as a Marmeto partner",
      "pricing": "Most tools free for approved partners"
    },
    "doubts": [
      "freeForPartners is \"most\", not all; Logistics and Payouts are white-label infrastructure whose cost is not stated.",
      "Logistics is described as \"one API for courier integrations\" and the tags include \"api\", but that is a resold product, not an API to the suite's data, so rest-api is not set.",
      "published:true with no tiers rests on the free-for-partners statement; arguably no price is published."
    ]
  },
  "meridian": {
    "attrs": {
      "products": "unknown",
      "covers": "Hosting, billing and a plan builder on Shopify Billing, CRM, automations, emails, reports, App Store analytics, keywords and reviews",
      "freeForPartners": "unknown"
    },
    "integrations": [
      "webhooks",
      "mcp"
    ],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "",
          "amount": 69,
          "currency": "USD",
          "period": "month",
          "unit": "per app"
        },
        {
          "name": "",
          "amount": 169,
          "currency": "USD",
          "period": "month",
          "unit": "per app"
        }
      ],
      "note": ""
    },
    "evidence": {
      "covers": "Whole app lifecycle: hosting, billing, CRM, email, ASO.",
      "webhooks": "Hosting with webhooks, logs and secrets managed for you.",
      "mcp": "tags: \"sdk\", \"mcp\"",
      "pricing": "$69 / $169 per app per month"
    },
    "doubts": [
      "The number of products is not stated; it is described as one product with modules.",
      "\"Every feature on every plan\" leaves unclear what separates the $69 and $169 tiers.",
      "webhooks are part of managed hosting for your app, not necessarily a webhook integration out of Meridian.",
      "mcp comes from the tags only; the note does not mention MCP."
    ]
  },
  "appstoreresearch": {
    "attrs": {
      "panelSize": 3000,
      "minCostPerCall": 150,
      "screening": true,
      "salesCalls": true
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "Research call",
          "amount": 150,
          "currency": "USD",
          "period": "one-time",
          "unit": "per call"
        },
        {
          "name": "Sales call",
          "amount": 500,
          "currency": "USD",
          "period": "one-time",
          "unit": "per call"
        }
      ],
      "note": "Starting prices, per completed call"
    },
    "evidence": {
      "panelSize": "3,000+ Shopify brands in the network",
      "minCostPerCall": "Research calls start at $150 and sales calls at $500",
      "screening": "Scheduling, screening and incentives are handled",
      "salesCalls": "It sells sales calls alongside research calls",
      "pricing": "Free account, from $150 per research call"
    },
    "doubts": [
      "Research calls 'start at $150', yet the cheapest worked example is $165 ($100 incentive plus $65 recruitment) and the minimum incentive is $85. The $150 floor does not obviously reconcile with these.",
      "The free account gives access only. Every call is paid.",
      "panelSize counts brands (3,000+), a lower bound."
    ]
  },
  "dtcmvp": {
    "attrs": {
      "panelSize": 1000,
      "minCostPerCall": "unknown",
      "screening": true,
      "salesCalls": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": false,
      "free": false,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Quote only, plus a payment to each brand per call"
    },
    "evidence": {
      "panelSize": "It says 1,000+ operators are enrolled",
      "screening": "It vets brand operators, matches them to you, books the calls and pays the brand after each one.",
      "pricing": "Quote only, plus a payment to each brand per call"
    },
    "doubts": [
      "panelSize counts enrolled operators (people), not brands or merchants, and is the vendor's own figure.",
      "The watch says the call format is closer to sales discovery than research, but it does not say dtcmvp sells sales calls as a product, so salesCalls is unknown.",
      "Invite only. free is false from the entry's field."
    ]
  },
  "storetasker": {
    "attrs": {
      "whoPays": "unknown",
      "vetted": true,
      "appDevelopers": true,
      "takePublished": false
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Freelancers quote, projects from $400"
    },
    "evidence": {
      "vetted": "reviewed over 15,000 developers, designers and marketers and admits under 5%",
      "appDevelopers": "There is a Shopify app developer category next to the theme and marketing talent.",
      "takePublished": "What Storetasker takes is not published anywhere on the site.",
      "pricing": "Free to get matched, projects from $400"
    },
    "doubts": [
      "Who pays the platform is unknown: the hirer pays the freelancer, and any platform margin is not published",
      "free:true covers matching only, the work itself is paid"
    ]
  },
  "shopexperts": {
    "attrs": {
      "whoPays": "the expert",
      "vetted": true,
      "appDevelopers": "unknown",
      "takePublished": true
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": true,
      "trialDays": "unknown",
      "tiers": [],
      "note": "Experts pay to be listed"
    },
    "evidence": {
      "whoPays": "The side that pays is the expert, not you.",
      "vetted": "They come from 205 vetted experts covering agencies, freelancers and consultants.",
      "takePublished": "Verified Pro, at $799 a year or $249 a quarter, buys Official Partner status",
      "pricing": "Free to get matched; experts pay to be listed"
    },
    "doubts": [
      "App developers are not named as a category of expert. App companies appear as clients",
      "takePublished read as true because hiring is stated as no commission and the expert fee is priced"
    ]
  },
  "kollectify": {
    "attrs": {
      "whoPays": "unknown",
      "vetted": "unknown",
      "appDevelopers": "unknown",
      "takePublished": "unknown"
    },
    "integrations": [],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": "unknown",
      "tiers": [
        {
          "name": "Content retainer",
          "amount": 1957,
          "currency": "GBP",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Content retainer",
          "amount": 3250,
          "currency": "GBP",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "Ads and SEO support from £1,500"
    },
    "evidence": {
      "pricing": "Content retainers £1,957 and £3,250 a month, SEO and App Store ads support from £1,500."
    },
    "doubts": [
      "An agency, not a marketplace, so the talent attributes mostly do not apply",
      "It sells marketing to app teams, not app development. Not stated as absent, so left unknown",
      "Period of the £1,500 SEO and App Store ads support is not stated"
    ]
  },
  "apricotcx": {
    "attrs": {
      "hours": "24/7",
      "inYourHelpdesk": "unknown",
      "reviewRecovery": true,
      "whiteLabel": true
    },
    "integrations": [],
    "pricing": {
      "published": false,
      "free": false,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "hours": "covering a merchant queue around the clock",
      "reviewRecovery": "negative review recovery by direct outreach on low-star reviews",
      "whiteLabel": "tags: white-label",
      "pricing": "No price is published anywhere on the site"
    },
    "doubts": [
      "White-label is stated only in tags, not in the note",
      "Helpdesk appears only as a tag, not whether it works inside yours"
    ]
  },
  "kivosupport": {
    "attrs": {
      "hours": "4 hours a day 5 days (Starter) to 24/7 (Professional)",
      "inYourHelpdesk": "unknown",
      "reviewRecovery": "unknown",
      "whiteLabel": true
    },
    "integrations": [
      "slack"
    ],
    "pricing": {
      "published": true,
      "free": false,
      "trialDays": 0,
      "tiers": [
        {
          "name": "Starter",
          "amount": 299,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Growth",
          "amount": 1499,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        },
        {
          "name": "Professional",
          "amount": 2999,
          "currency": "USD",
          "period": "month",
          "unit": "flat"
        }
      ],
      "note": "Custom above the top tier"
    },
    "evidence": {
      "hours": "It covers 4 hours a day across 5 days",
      "whiteLabel": "White-label support for Shopify apps, with the tiers actually priced.",
      "slack": "a dedicated team and lead, 1,000+ conversations, helpdesk setup, Slack and SLAs",
      "pricing": "$299 / $1,499 / $2,999 per month, then custom"
    },
    "doubts": [
      "Hours vary by tier: Starter 4 hours a day across 5 days, Growth 8 hours a day, Professional 24/7",
      "Enterprise includes helpdesk setup, not stated as working inside your existing helpdesk",
      "Review request and response management (Professional up) is not clearly review recovery",
      "Slack is on the Enterprise tier only"
    ]
  },
  "supportheroes": {
    "attrs": {
      "hours": "24/7",
      "inYourHelpdesk": "unknown",
      "reviewRecovery": "unknown",
      "whiteLabel": true
    },
    "integrations": [],
    "pricing": {
      "published": false,
      "free": false,
      "trialDays": "unknown",
      "tiers": [],
      "note": ""
    },
    "evidence": {
      "hours": "66 people supporting 44 Shopify apps, 24/7",
      "whiteLabel": "tags: white-label",
      "pricing": "Nothing about the commercial side is published. There is no price"
    },
    "doubts": [
      "White-label is stated only in tags, not in the note",
      "No SLA or response-time commitment published"
    ]
  }
};
