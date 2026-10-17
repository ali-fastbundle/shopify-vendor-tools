/*
 * Published contact addresses for listed vendors, for the Outreach tab on
 * /admin. Server only: imported by app/admin/page.js after the admin check
 * and by /api/admin/outreach, never by a client component, so no address
 * ships in a public bundle.
 *
 * Read from each vendor's own site on 2026-10-16: the footer, contact,
 * about, privacy, terms and legal pages. An address is here only if it is
 * printed there (or on the parent company's site, which `note` says). None is
 * guessed from a pattern like info@domain: a wrong address bounces, and the
 * bounce counts against the domain the sign-in links come from.
 *
 *   email    the best published address, or null when none is published
 *   source   the exact page it was found on, so it is auditable
 *   others   other published addresses, with their pages
 *   looked   the pages checked
 *   caution  a reason to look twice; such an address is copy only, never
 *            sent through Resend
 *
 * No address: write on LinkedIn instead (the tool's `social.li`).
 */
export const CONTACTS = {
  "affilitrak": {
    "email": "hello@affilitrak.com",
    "source": "https://affilitrak.com/privacy-policy",
    "checked": "2026-10-16",
    "note": "found in privacy policy; MX present",
    "looked": [
      "https://affilitrak.com/for-apps",
      "https://affilitrak.com/",
      "https://affilitrak.com/contact",
      "https://affilitrak.com/contact-us",
      "https://affilitrak.com/about",
      "https://affilitrak.com/support",
      "https://affilitrak.com/privacy",
      "https://affilitrak.com/privacy-policy",
      "https://affilitrak.com/terms",
      "https://affilitrak.com/legal",
      "https://affilitrak.com/imprint",
      "https://affilitrak.com/affiliate-terms"
    ]
  },
  "alertcommerce": {
    "email": "sales@alertcommerce.com",
    "source": "https://alertcommerce.com/contact/",
    "checked": "2026-10-16",
    "note": "sales/hello/help in site footer and contact page; hello@ is the footer mailto. Ignored sam@mapleandhide.com (a customer on the page, not the vendor)",
    "others": [
      {
        "email": "hello@alertcommerce.com",
        "source": "https://alertcommerce.com"
      },
      {
        "email": "help@alertcommerce.com",
        "source": "https://alertcommerce.com/contact/"
      },
      {
        "email": "privacy@alertcommerce.com",
        "source": "https://alertcommerce.com/privacy/"
      }
    ],
    "looked": [
      "https://alertcommerce.com",
      "https://alertcommerce.com/contact",
      "https://alertcommerce.com/contact/",
      "https://alertcommerce.com/contact-us",
      "https://alertcommerce.com/about",
      "https://alertcommerce.com/data-contact/",
      "https://alertcommerce.com/support",
      "https://alertcommerce.com/privacy",
      "https://alertcommerce.com/privacy/",
      "https://alertcommerce.com/privacy-policy",
      "https://alertcommerce.com/terms",
      "https://alertcommerce.com/legal"
    ]
  },
  "appjubilee": {
    "email": "support@appjubilee.io",
    "source": "https://www.appjubilee.io/privacy",
    "checked": "2026-10-16",
    "note": "support@ in privacy and terms. Homepage FAQ mailto prints hello@appjubilee.com, but appjubilee.com has no MX record, so that one would bounce; do not use it",
    "others": [
      {
        "email": "hello@appjubilee.com",
        "source": "https://www.appjubilee.io/"
      }
    ],
    "looked": [
      "https://www.appjubilee.io/",
      "https://www.appjubilee.io/contact",
      "https://www.appjubilee.io/contact-us",
      "https://www.appjubilee.io/about",
      "https://www.appjubilee.io/support",
      "https://www.appjubilee.io/privacy",
      "https://www.appjubilee.io/privacy-policy",
      "https://www.appjubilee.io/terms",
      "https://www.appjubilee.io/legal",
      "https://www.appjubilee.io/imprint",
      "https://www.appjubilee.io/compare"
    ]
  },
  "applora": {
    "email": "hello@applora.ai",
    "source": "https://applora.ai",
    "checked": "2026-10-16",
    "note": "hello@ is a mailto on the homepage pricing (custom plan); support@ in footer and privacy/terms",
    "others": [
      {
        "email": "support@applora.ai",
        "source": "https://applora.ai/privacy"
      }
    ],
    "looked": [
      "https://applora.ai",
      "https://applora.ai/contact",
      "https://applora.ai/contact-us",
      "https://applora.ai/about",
      "https://applora.ai/support",
      "https://applora.ai/privacy",
      "https://applora.ai/privacy-policy",
      "https://applora.ai/terms",
      "https://applora.ai/legal",
      "https://applora.ai/imprint"
    ]
  },
  "appnavigator": {
    "email": "support@ablestar.com",
    "source": "https://www.ablestar.com/privacy-policy/",
    "checked": "2026-10-16",
    "note": "no address on appnavigator.io; footer says (c) Ablestar LLC and its privacy link goes to ablestar.com/privacy-policy, which prints support@ablestar.com (parent company). ablestar.com/contact is a form",
    "looked": [
      "https://appnavigator.io",
      "https://appnavigator.io/",
      "https://appnavigator.io/contact",
      "https://appnavigator.io/contact-us",
      "https://appnavigator.io/about",
      "https://appnavigator.io/about-us",
      "https://appnavigator.io/support",
      "https://appnavigator.io/privacy",
      "https://appnavigator.io/privacy-policy",
      "https://appnavigator.io/terms",
      "https://appnavigator.io/legal",
      "https://appnavigator.io/imprint"
    ],
    "caution": "The parent company Ablestar's support address, not one on appnavigator.io."
  },
  "appstorepulse": {
    "email": "mat@appstorepulse.com",
    "source": "https://www.appstorepulse.com/",
    "checked": "2026-10-16",
    "note": "footer mailto 'Contact Us' on homepage; privacy and terms print addresses on the founder's matdesousa.com domain",
    "others": [
      {
        "email": "contact@matdesousa.com",
        "source": "https://www.appstorepulse.com/privacy"
      },
      {
        "email": "mat@matdesousa.com",
        "source": "https://www.appstorepulse.com/terms"
      }
    ],
    "looked": [
      "https://www.appstorepulse.com",
      "https://www.appstorepulse.com/",
      "https://www.appstorepulse.com/contact",
      "https://www.appstorepulse.com/contact-us",
      "https://www.appstorepulse.com/about",
      "https://www.appstorepulse.com/about-us",
      "https://www.appstorepulse.com/support",
      "https://www.appstorepulse.com/privacy",
      "https://www.appstorepulse.com/privacy-policy",
      "https://www.appstorepulse.com/terms",
      "https://www.appstorepulse.com/legal",
      "https://www.appstorepulse.com/imprint"
    ]
  },
  "appstoreresearch": {
    "email": "hello@appstoreresearch.com",
    "source": "https://appstoreresearch.com/contact",
    "checked": "2026-10-16",
    "note": "hello@ in site-wide footer; MX present",
    "others": [
      {
        "email": "support@appstoreresearch.com",
        "source": "https://appstoreresearch.com/contact-us"
      },
      {
        "email": "admin@appstoreresearch.com",
        "source": "https://appstoreresearch.com/privacy"
      }
    ],
    "looked": [
      "https://appstoreresearch.com/",
      "https://appstoreresearch.com/contact",
      "https://appstoreresearch.com/contact-us",
      "https://appstoreresearch.com/about",
      "https://appstoreresearch.com/support",
      "https://appstoreresearch.com/privacy",
      "https://appstoreresearch.com/privacy-policy",
      "https://appstoreresearch.com/terms",
      "https://appstoreresearch.com/legal",
      "https://appstoreresearch.com/imprint"
    ]
  },
  "appvitals": {
    "email": "support@appvitals.io",
    "source": "https://appvitals.io",
    "checked": "2026-10-16",
    "note": "support@ in homepage org data and privacy; info@ is the privacy/DPO contact",
    "others": [
      {
        "email": "info@appvitals.io",
        "source": "https://appvitals.io/privacy"
      }
    ],
    "looked": [
      "https://appvitals.io",
      "https://appvitals.io/contact",
      "https://appvitals.io/about",
      "https://appvitals.io/support",
      "https://appvitals.io/privacy",
      "https://appvitals.io/terms",
      "https://appvitals.io/legal",
      "https://appvitals.io/imprint"
    ]
  },
  "prys": {
    "email": "connect@prys.io",
    "source": "https://prys.io",
    "checked": "2026-10-17",
    "note": "in the footer of the homepage, /pricing and /about",
    "looked": [
      "https://prys.io",
      "https://prys.io/pricing",
      "https://prys.io/about",
      "https://prys.io/privacy",
      "https://prys.io/terms"
    ]
  },
  "ecdb": {
    "email": null,
    "source": null,
    "checked": "2026-10-17",
    "note": "ecdb.com did not respond from here (curl and fetch both failed), so no address could be read on its site",
    "looked": [
      "https://ecdb.com/",
      "https://www.ecdb.com/"
    ]
  },
  "apricotcx": {
    "email": "hi@acxt.am",
    "source": "https://acxt.am/contact",
    "checked": "2026-10-16",
    "note": "on homepage, /contact, /about and /privacy-policy",
    "looked": [
      "https://acxt.am",
      "https://acxt.am/",
      "https://acxt.am/contact",
      "https://acxt.am/contact-us",
      "https://acxt.am/about",
      "https://acxt.am/about-us",
      "https://acxt.am/support",
      "https://acxt.am/privacy",
      "https://acxt.am/privacy-policy",
      "https://acxt.am/terms",
      "https://acxt.am/legal",
      "https://acxt.am/imprint"
    ]
  },
  "becketto": {
    "email": null,
    "source": null,
    "checked": "2026-10-16",
    "note": "no address printed on homepage, rank-tracker page or their JS bundles; contact/privacy/terms pages all 404",
    "looked": [
      "https://becketto.com/rank-tracker",
      "https://becketto.com/",
      "https://becketto.com/contact",
      "https://becketto.com/contact-us",
      "https://becketto.com/about",
      "https://becketto.com/about-us",
      "https://becketto.com/support",
      "https://becketto.com/privacy",
      "https://becketto.com/privacy-policy",
      "https://becketto.com/terms",
      "https://becketto.com/legal",
      "https://becketto.com/imprint"
    ]
  },
  "bestappify": {
    "email": "business@bestappify.com",
    "source": "https://bestappify.com/contact",
    "checked": "2026-10-16",
    "note": "mailto on /contact and homepage footer; also in privacy and terms",
    "looked": [
      "https://bestappify.com",
      "https://bestappify.com/contact",
      "https://bestappify.com/about",
      "https://bestappify.com/privacy",
      "https://bestappify.com/terms"
    ]
  },
  "builtwith": {
    "email": "support@builtwith.com",
    "source": "https://builtwith.com/contact-us",
    "checked": "2026-10-16",
    "note": "support@ on homepage, contact-us, privacy and terms; /contact served a human-verification challenge",
    "looked": [
      "https://builtwith.com",
      "https://builtwith.com/contact",
      "https://builtwith.com/contact-us",
      "https://builtwith.com/about",
      "https://builtwith.com/support",
      "https://builtwith.com/privacy",
      "https://builtwith.com/terms"
    ]
  },
  "cartinsight": {
    "email": "info@readycontacts.com",
    "source": "https://www.cartinsight.io/contact-us/",
    "checked": "2026-10-16",
    "note": "only address printed is a ReadyContacts address (Cloudflare-obfuscated, decoded) in CartInsight's privacy policy; cartinsight.io itself has no MX. Suggests ReadyContacts operates it, unconfirmed. also printed on /contact-us/ once it loaded after retries",
    "looked": [
      "https://www.cartinsight.io/",
      "https://www.cartinsight.io/contact",
      "https://www.cartinsight.io/contact-us",
      "https://www.cartinsight.io/about",
      "https://www.cartinsight.io/support",
      "https://www.cartinsight.io/privacy",
      "https://www.cartinsight.io/privacy-policy",
      "https://www.cartinsight.io/terms",
      "https://www.cartinsight.io/legal",
      "https://www.cartinsight.io/imprint",
      "https://www.cartinsight.io/about-us/",
      "https://www.cartinsight.io/contact-us/"
    ],
    "caution": "Printed on cartinsight.io, but it is a readycontacts.com address. cartinsight.io has no mail server, so the operator is probably ReadyContacts. Not confirmed."
  },
  "copyfy": {
    "email": "contact@copyfy.io",
    "source": "https://www.copyfy.io/en/privacy-policy",
    "checked": "2026-10-16",
    "note": "Cloudflare-obfuscated address in privacy policy contact section, decoded",
    "looked": [
      "https://www.copyfy.io/en/tools/shopify-apps-detector",
      "https://www.copyfy.io/",
      "https://www.copyfy.io/contact",
      "https://www.copyfy.io/contact-us",
      "https://www.copyfy.io/about",
      "https://www.copyfy.io/about-us",
      "https://www.copyfy.io/support",
      "https://www.copyfy.io/privacy",
      "https://www.copyfy.io/privacy-policy",
      "https://www.copyfy.io/terms",
      "https://www.copyfy.io/legal",
      "https://www.copyfy.io/imprint"
    ]
  },
  "dtcmvp": {
    "email": "sean@dtcmvp.com",
    "source": "https://dtcmvp.com/contact",
    "checked": "2026-10-16",
    "note": "in site footer on every page and /contact; founder's address, only one published",
    "looked": [
      "https://dtcmvp.com",
      "https://dtcmvp.com/",
      "https://dtcmvp.com/contact",
      "https://dtcmvp.com/contact-us",
      "https://dtcmvp.com/about",
      "https://dtcmvp.com/about-us",
      "https://dtcmvp.com/support",
      "https://dtcmvp.com/privacy",
      "https://dtcmvp.com/privacy-policy",
      "https://dtcmvp.com/terms",
      "https://dtcmvp.com/legal",
      "https://dtcmvp.com/imprint"
    ]
  },
  "elevate": {
    "email": "hi@marmeto.com",
    "source": "https://marmeto.com/privacy",
    "checked": "2026-10-16",
    "note": "parent company Marmeto; mailto in privacy policy; nothing on the Elevate page or homepage",
    "looked": [
      "https://marmeto.com/elevate",
      "https://marmeto.com",
      "https://marmeto.com/contact",
      "https://marmeto.com/about",
      "https://marmeto.com/privacy",
      "https://marmeto.com/terms"
    ],
    "caution": "Marmeto's general address, shared with Orbit and Marmeto. Write once for all three."
  },
  "etailinsights": {
    "email": "info@etailinsights.com",
    "source": "https://www.etailinsights.com/privacy",
    "checked": "2026-10-16",
    "note": "mailto on privacy page; not on homepage, /contact 404",
    "looked": [
      "https://www.etailinsights.com",
      "https://www.etailinsights.com/",
      "https://www.etailinsights.com/contact",
      "https://www.etailinsights.com/contact-us",
      "https://www.etailinsights.com/about",
      "https://www.etailinsights.com/about-us",
      "https://www.etailinsights.com/support",
      "https://www.etailinsights.com/privacy",
      "https://www.etailinsights.com/privacy-policy",
      "https://www.etailinsights.com/terms",
      "https://www.etailinsights.com/legal",
      "https://www.etailinsights.com/imprint"
    ]
  },
  "fusionmetrics": {
    "email": "alex@fusionmetrics.com",
    "source": "https://fusionmetrics.com/",
    "checked": "2026-10-16",
    "note": "client-rendered; mailto in pricing section ('Talk to Alex about Enterprise') and privacy page shell, read from the site's own JS bundle. Only address published (founder)",
    "looked": [
      "https://fusionmetrics.com",
      "https://fusionmetrics.com/",
      "https://fusionmetrics.com/contact",
      "https://fusionmetrics.com/contact-us",
      "https://fusionmetrics.com/about",
      "https://fusionmetrics.com/about-us",
      "https://fusionmetrics.com/support",
      "https://fusionmetrics.com/privacy",
      "https://fusionmetrics.com/privacy-policy",
      "https://fusionmetrics.com/terms",
      "https://fusionmetrics.com/legal",
      "https://fusionmetrics.com/imprint"
    ]
  },
  "kivosupport": {
    "email": "support@kivosupport.com",
    "source": "https://kivosupport.com",
    "checked": "2026-10-16",
    "note": "on homepage, /contact and /about (also in page schema contactPoint); other addresses on the site are placeholders",
    "looked": [
      "https://kivosupport.com",
      "https://kivosupport.com/contact",
      "https://kivosupport.com/contact-us",
      "https://kivosupport.com/about",
      "https://kivosupport.com/support",
      "https://kivosupport.com/privacy",
      "https://kivosupport.com/privacy-policy",
      "https://kivosupport.com/terms",
      "https://kivosupport.com/legal",
      "https://kivosupport.com/imprint"
    ]
  },
  "koalainspector": {
    "email": "hello@koala-apps.io",
    "source": "https://koala-apps.io/contact",
    "checked": "2026-10-16",
    "note": "on /contact, privacy policy and terms; MX present",
    "looked": [
      "https://koala-apps.io/koala-inspector/",
      "https://koala-apps.io/",
      "https://koala-apps.io/contact",
      "https://koala-apps.io/contact-us",
      "https://koala-apps.io/about",
      "https://koala-apps.io/support",
      "https://koala-apps.io/privacy",
      "https://koala-apps.io/privacy-policy",
      "https://koala-apps.io/terms",
      "https://koala-apps.io/legal",
      "https://koala-apps.io/imprint",
      "https://koala-apps.io/about-us/"
    ]
  },
  "kollectify": {
    "email": "hello@kollectify.com",
    "source": "https://kollectify.com/privacy-policy",
    "checked": "2026-10-16",
    "note": "only in privacy policy; homepage and about have no address; MX present",
    "looked": [
      "https://kollectify.com/",
      "https://kollectify.com/contact",
      "https://kollectify.com/contact-us",
      "https://kollectify.com/about",
      "https://kollectify.com/support",
      "https://kollectify.com/privacy",
      "https://kollectify.com/privacy-policy",
      "https://kollectify.com/terms",
      "https://kollectify.com/legal",
      "https://kollectify.com/imprint",
      "https://kollectify.com/about-us"
    ]
  },
  "krutva": {
    "email": "hello@krutva.com",
    "source": "https://www.krutva.com/",
    "checked": "2026-10-16",
    "note": "in site footer on every page incl. /contact-us",
    "looked": [
      "https://www.krutva.com",
      "https://www.krutva.com/",
      "https://www.krutva.com/contact",
      "https://www.krutva.com/contact-us",
      "https://www.krutva.com/about",
      "https://www.krutva.com/about-us",
      "https://www.krutva.com/support",
      "https://www.krutva.com/privacy",
      "https://www.krutva.com/privacy-policy",
      "https://www.krutva.com/terms",
      "https://www.krutva.com/legal",
      "https://www.krutva.com/imprint"
    ]
  },
  "letsmetrix": {
    "email": "contact@letsmetrix.com",
    "source": "https://letsmetrix.com/contact-us",
    "checked": "2026-10-16",
    "note": "found on /contact-us (Cloudflare-obfuscated, decoded); MX present",
    "others": [
      {
        "email": "privacy@letsmetrix.com",
        "source": "https://letsmetrix.com/privacy-policy"
      },
      {
        "email": "security@letsmetrix.com",
        "source": "https://letsmetrix.com/privacy-policy"
      }
    ],
    "looked": [
      "https://letsmetrix.com/",
      "https://letsmetrix.com/contact",
      "https://letsmetrix.com/contact-us",
      "https://letsmetrix.com/about",
      "https://letsmetrix.com/support",
      "https://letsmetrix.com/privacy",
      "https://letsmetrix.com/privacy-policy",
      "https://letsmetrix.com/terms",
      "https://letsmetrix.com/legal",
      "https://letsmetrix.com/imprint",
      "https://letsmetrix.com/contact-us"
    ]
  },
  "mantle": {
    "email": "legal@heymantle.com",
    "source": "https://heymantle.com/privacy",
    "checked": "2026-10-16",
    "note": "only address printed is legal@ in the privacy policy; no contact/partnership address; /help-desk timed out",
    "looked": [
      "https://heymantle.com/",
      "https://heymantle.com/contact",
      "https://heymantle.com/contact-us",
      "https://heymantle.com/about",
      "https://heymantle.com/support",
      "https://heymantle.com/privacy",
      "https://heymantle.com/privacy-policy",
      "https://heymantle.com/terms",
      "https://heymantle.com/legal",
      "https://heymantle.com/imprint",
      "https://heymantle.com/help-desk"
    ],
    "caution": "Only the legal inbox is published, and Mantle is winding down."
  },
  "marmeto": {
    "email": "hi@marmeto.com",
    "source": "https://marmeto.com/privacy",
    "checked": "2026-10-16",
    "note": "in privacy policy as the general contact address; homepage footer has none, /contact 404",
    "looked": [
      "https://marmeto.com",
      "https://marmeto.com/contact",
      "https://marmeto.com/contact-us",
      "https://marmeto.com/about",
      "https://marmeto.com/support",
      "https://marmeto.com/privacy",
      "https://marmeto.com/privacy-policy",
      "https://marmeto.com/terms",
      "https://marmeto.com/legal",
      "https://marmeto.com/imprint"
    ]
  },
  "meridian": {
    "email": "support@the-meridian.ai",
    "source": "https://www.the-meridian.ai/contact",
    "checked": "2026-10-16",
    "note": "support mailto on /contact; sales is a form, no sales address",
    "others": [
      {
        "email": "careers@the-meridian.ai",
        "source": "https://www.the-meridian.ai/contact"
      },
      {
        "email": "privacy@the-meridian.ai",
        "source": "https://www.the-meridian.ai/privacy-policy"
      },
      {
        "email": "security@the-meridian.ai",
        "source": "https://www.the-meridian.ai/contact"
      }
    ],
    "looked": [
      "https://www.the-meridian.ai",
      "https://www.the-meridian.ai/contact",
      "https://www.the-meridian.ai/about",
      "https://www.the-meridian.ai/privacy-policy"
    ]
  },
  "orbit": {
    "email": "hi@marmeto.com",
    "source": "https://marmeto.com/privacy",
    "checked": "2026-10-16",
    "note": "parent company (Marmeto) address in its privacy policy mailto; no Orbit-specific address",
    "looked": [
      "https://marmeto.com/orbit",
      "https://marmeto.com/",
      "https://marmeto.com/contact",
      "https://marmeto.com/contact-us",
      "https://marmeto.com/about",
      "https://marmeto.com/support",
      "https://marmeto.com/privacy",
      "https://marmeto.com/privacy-policy",
      "https://marmeto.com/terms",
      "https://marmeto.com/legal",
      "https://marmeto.com/imprint",
      "https://marmeto.com/about-us"
    ],
    "caution": "Marmeto's general address, shared with Elevate and Marmeto. Write once for all three."
  },
  "partnerdock": {
    "email": "support@getpartnerdock.com",
    "source": "https://getpartnerdock.com/about",
    "checked": "2026-10-16",
    "note": "mailto on /about, /privacy and /terms; only address published",
    "looked": [
      "https://getpartnerdock.com",
      "https://getpartnerdock.com/",
      "https://getpartnerdock.com/contact",
      "https://getpartnerdock.com/contact-us",
      "https://getpartnerdock.com/about",
      "https://getpartnerdock.com/about-us",
      "https://getpartnerdock.com/support",
      "https://getpartnerdock.com/privacy",
      "https://getpartnerdock.com/privacy-policy",
      "https://getpartnerdock.com/terms",
      "https://getpartnerdock.com/legal",
      "https://getpartnerdock.com/imprint"
    ]
  },
  "partnerjam": {
    "email": "partners@digismoothie.com",
    "source": "https://www.partnerjam.com",
    "checked": "2026-10-16",
    "note": "footer mailto on partnerjam.com; address is on parent Digismoothie's domain",
    "looked": [
      "https://www.partnerjam.com",
      "https://www.partnerjam.com/about-us",
      "https://www.partnerjam.com/privacy",
      "https://www.partnerjam.com/contact"
    ]
  },
  "partnerstack": {
    "email": "privacy@partnerstack.com",
    "source": "https://partnerstack.com/legal/privacy-policy",
    "checked": "2026-10-16",
    "note": "only a privacy address (Cloudflare-obfuscated, decoded) in the privacy policy; no sales or contact address, demo form only. Weak choice for outreach",
    "looked": [
      "https://partnerstack.com",
      "https://partnerstack.com/contact",
      "https://partnerstack.com/contact-us",
      "https://partnerstack.com/about",
      "https://partnerstack.com/support",
      "https://partnerstack.com/privacy",
      "https://partnerstack.com/privacy-policy",
      "https://partnerstack.com/legal",
      "https://partnerstack.com/legal/partner",
      "https://partnerstack.com/legal/privacy-policy",
      "https://partnerstack.com/terms",
      "https://partnerstack.com/imprint"
    ],
    "caution": "The only published address is the privacy inbox. A pitch there is likely to be ignored."
  },
  "ppspy": {
    "email": "service@ppspy.com",
    "source": "https://www.ppspy.com/",
    "checked": "2026-10-16",
    "note": "on homepage and privacy policy; only address published (support-type)",
    "looked": [
      "https://www.ppspy.com",
      "https://www.ppspy.com/",
      "https://www.ppspy.com/contact",
      "https://www.ppspy.com/contact-us",
      "https://www.ppspy.com/about",
      "https://www.ppspy.com/about-us",
      "https://www.ppspy.com/support",
      "https://www.ppspy.com/privacy",
      "https://www.ppspy.com/privacy-policy",
      "https://www.ppspy.com/terms",
      "https://www.ppspy.com/legal",
      "https://www.ppspy.com/imprint"
    ]
  },
  "rankbase": {
    "email": "farid@rankbase.io",
    "source": "https://rankbase.io/",
    "checked": "2026-10-16",
    "note": "founder address in homepage, also in privacy and terms; only address published; MX present",
    "looked": [
      "https://rankbase.io/",
      "https://rankbase.io/contact",
      "https://rankbase.io/contact-us",
      "https://rankbase.io/about",
      "https://rankbase.io/support",
      "https://rankbase.io/privacy",
      "https://rankbase.io/privacy-policy",
      "https://rankbase.io/terms",
      "https://rankbase.io/legal",
      "https://rankbase.io/imprint"
    ]
  },
  "ranksy": {
    "email": "goran@ranksyapp.com",
    "source": "https://ranksyapp.com/contact",
    "checked": "2026-10-16",
    "note": "/contact names goran@ as the address the contact form sends to (founder); help@ is the support address in privacy and terms",
    "others": [
      {
        "email": "help@ranksyapp.com",
        "source": "https://ranksyapp.com/privacy-policy"
      }
    ],
    "looked": [
      "https://ranksyapp.com",
      "https://ranksyapp.com/contact",
      "https://ranksyapp.com/about",
      "https://ranksyapp.com/privacy-policy",
      "https://ranksyapp.com/terms"
    ]
  },
  "saasinsights": {
    "email": null,
    "source": null,
    "checked": "2026-10-16",
    "note": "contact form only, no address printed",
    "looked": [
      "https://saasinsights.com",
      "https://saasinsights.com/contact",
      "https://saasinsights.com/contact-us",
      "https://saasinsights.com/about",
      "https://saasinsights.com/support",
      "https://saasinsights.com/privacy",
      "https://saasinsights.com/privacy-policy",
      "https://saasinsights.com/terms",
      "https://saasinsights.com/terms-of-use",
      "https://saasinsights.com/legal",
      "https://saasinsights.com/imprint"
    ]
  },
  "sasi": {
    "email": "legal@heymantle.com",
    "source": "https://heymantle.com/privacy",
    "checked": "2026-10-16",
    "note": "nothing on sasi subdomain; only address is parent Mantle's legal@ in its privacy policy, not a sales or partner inbox",
    "looked": [
      "https://sasi.heymantle.com",
      "https://sasi.heymantle.com/contact",
      "https://sasi.heymantle.com/contact-us",
      "https://sasi.heymantle.com/about",
      "https://sasi.heymantle.com/support",
      "https://sasi.heymantle.com/privacy",
      "https://sasi.heymantle.com/privacy-policy",
      "https://sasi.heymantle.com/terms",
      "https://sasi.heymantle.com/legal",
      "https://sasi.heymantle.com/imprint",
      "https://heymantle.com",
      "https://heymantle.com/privacy"
    ],
    "caution": "No address on SASI itself. This is Mantle's legal inbox, and Mantle is winding down."
  },
  "sellercenter": {
    "email": "service@inbox.sellercenter.io",
    "source": "https://sellercenter.io/contact-us",
    "checked": "2026-10-16",
    "note": "contact-us and terms say service@inbox.; privacy policy says service@info. (different subdomain). Contact page version preferred; one of the two may bounce",
    "others": [
      {
        "email": "service@info.sellercenter.io",
        "source": "https://sellercenter.io/privacy"
      }
    ],
    "looked": [
      "https://sellercenter.io",
      "https://sellercenter.io/contact",
      "https://sellercenter.io/contact-us",
      "https://sellercenter.io/about",
      "https://sellercenter.io/aboutus",
      "https://sellercenter.io/support",
      "https://sellercenter.io/privacy",
      "https://sellercenter.io/privacy-policy",
      "https://sellercenter.io/terms",
      "https://sellercenter.io/legal",
      "https://sellercenter.io/imprint"
    ],
    "caution": "The site prints two different addresses (inbox.sellercenter.io on contact and terms, info.sellercenter.io on privacy). One may bounce."
  },
  "shoffi": {
    "email": "support@shoffi.app",
    "source": "https://shoffi.app/contact-support",
    "checked": "2026-10-16",
    "note": "Cloudflare-obfuscated address, decoded; also in privacy policy and terms",
    "looked": [
      "https://shoffi.app",
      "https://shoffi.app/contact",
      "https://shoffi.app/contact-us",
      "https://shoffi.app/contact-support",
      "https://shoffi.app/about",
      "https://shoffi.app/support",
      "https://shoffi.app/privacy",
      "https://shoffi.app/privacy-policy",
      "https://shoffi.app/terms",
      "https://shoffi.app/terms-of-service",
      "https://shoffi.app/legal",
      "https://shoffi.app/imprint"
    ]
  },
  "shopexperts": {
    "email": "hello@shopexperts.com",
    "source": "https://shopexperts.com/contact",
    "checked": "2026-10-16",
    "note": "/contact says 'Email us at hello@shopexperts.com'",
    "looked": [
      "https://shopexperts.com",
      "https://shopexperts.com/contact",
      "https://shopexperts.com/about",
      "https://shopexperts.com/about-us"
    ]
  },
  "shopscan": {
    "email": "contact@shopscan.app",
    "source": "https://www.shopscan.app",
    "checked": "2026-10-16",
    "note": "in homepage structured data (Organization email); other paths 404",
    "looked": [
      "https://www.shopscan.app",
      "https://www.shopscan.app/contact",
      "https://www.shopscan.app/privacy",
      "https://www.shopscan.app/terms"
    ]
  },
  "storecensus": {
    "email": "support@storecensus.com",
    "source": "https://www.storecensus.com/contact",
    "checked": "2026-10-16",
    "note": "on /contact, /about, /support, privacy and terms; only address published",
    "looked": [
      "https://www.storecensus.com/",
      "https://www.storecensus.com/contact",
      "https://www.storecensus.com/contact-us",
      "https://www.storecensus.com/about",
      "https://www.storecensus.com/support",
      "https://www.storecensus.com/privacy",
      "https://www.storecensus.com/privacy-policy",
      "https://www.storecensus.com/terms",
      "https://www.storecensus.com/legal",
      "https://www.storecensus.com/imprint"
    ]
  },
  "storeinspect": {
    "email": "support@storeinspect.com",
    "source": "https://storeinspect.com/",
    "checked": "2026-10-16",
    "note": "in site footer on every page; only address published",
    "looked": [
      "https://storeinspect.com",
      "https://storeinspect.com/",
      "https://storeinspect.com/contact",
      "https://storeinspect.com/contact-us",
      "https://storeinspect.com/about",
      "https://storeinspect.com/about-us",
      "https://storeinspect.com/support",
      "https://storeinspect.com/privacy",
      "https://storeinspect.com/privacy-policy",
      "https://storeinspect.com/terms",
      "https://storeinspect.com/legal",
      "https://storeinspect.com/imprint"
    ]
  },
  "storeleads": {
    "email": "support@storeleads.app",
    "source": "https://storeleads.app/privacy",
    "checked": "2026-10-16",
    "note": "printed obfuscated in privacy policy as 'support <at> storeleads <dot> app'; /contact is a form only",
    "looked": [
      "https://storeleads.app",
      "https://storeleads.app/contact",
      "https://storeleads.app/privacy",
      "https://storeleads.app/terms",
      "https://storeleads.app/about"
    ]
  },
  "storeradar": {
    "email": "hello@storeradar.co",
    "source": "https://storeradar.co/support",
    "checked": "2026-10-16",
    "note": "hello@ mailto on support page; legal@ also on homepage",
    "others": [
      {
        "email": "legal@storeradar.co",
        "source": "https://storeradar.co/legal"
      },
      {
        "email": "privacy@storeradar.co",
        "source": "https://storeradar.co/legal"
      }
    ],
    "looked": [
      "https://storeradar.co",
      "https://storeradar.co/contact",
      "https://storeradar.co/contact-us",
      "https://storeradar.co/about",
      "https://storeradar.co/support",
      "https://storeradar.co/privacy",
      "https://storeradar.co/privacy-policy",
      "https://storeradar.co/terms",
      "https://storeradar.co/legal",
      "https://storeradar.co/imprint"
    ]
  },
  "storetasker": {
    "email": "support@storetasker.com",
    "source": "https://www.storetasker.com/privacy",
    "checked": "2026-10-16",
    "note": "both in privacy policy and terms; admin@ is the legal-notice address",
    "others": [
      {
        "email": "admin@storetasker.com",
        "source": "https://www.storetasker.com/terms-of-service"
      }
    ],
    "looked": [
      "https://www.storetasker.com",
      "https://www.storetasker.com/contact",
      "https://www.storetasker.com/contact-us",
      "https://www.storetasker.com/about",
      "https://www.storetasker.com/support",
      "https://www.storetasker.com/privacy",
      "https://www.storetasker.com/privacy-policy",
      "https://www.storetasker.com/terms",
      "https://www.storetasker.com/terms-of-service",
      "https://www.storetasker.com/legal",
      "https://www.storetasker.com/imprint"
    ]
  },
  "supportheroes": {
    "email": "admin@thesupportheroes.com",
    "source": "https://www.thesupportheroes.com/policies/privacy-policy",
    "checked": "2026-10-16",
    "note": "homepage and /pages/contact answer 429; address is printed in the site footer and the privacy policy",
    "looked": [
      "https://thesupportheroes.com",
      "https://thesupportheroes.com/contact",
      "https://thesupportheroes.com/pages/contact",
      "https://www.thesupportheroes.com/policies/privacy-policy"
    ]
  },
  "tracksami": {
    "email": null,
    "source": null,
    "checked": "2026-10-16",
    "note": "blocked: every page 403, retried",
    "looked": [
      "https://www.tracksami.com",
      "https://www.tracksami.com/contact",
      "https://www.tracksami.com/contact-us",
      "https://www.tracksami.com/about",
      "https://www.tracksami.com/support",
      "https://www.tracksami.com/privacy",
      "https://www.tracksami.com/privacy-policy",
      "https://www.tracksami.com/terms",
      "https://www.tracksami.com/legal",
      "https://www.tracksami.com/imprint"
    ]
  },
  "welookup": {
    "email": "support@welookup.info",
    "source": "https://welookup.info",
    "checked": "2026-10-16",
    "note": "homepage footer mailto; only address published",
    "looked": [
      "https://welookup.info/",
      "https://welookup.info/contact",
      "https://welookup.info/contact-us",
      "https://welookup.info/about",
      "https://welookup.info/support",
      "https://welookup.info/privacy",
      "https://welookup.info/privacy-policy",
      "https://welookup.info/terms",
      "https://welookup.info/legal",
      "https://welookup.info/imprint",
      "https://welookup.info/privacy-policy.html"
    ]
  },
  "winninghunter": {
    "email": "support@winninghunter.com",
    "source": "https://winninghunter.com/contact",
    "checked": "2026-10-16",
    "note": "printed on /contact, homepage and privacy; only a support address",
    "looked": [
      "https://winninghunter.com",
      "https://winninghunter.com/contact",
      "https://winninghunter.com/privacy",
      "https://winninghunter.com/terms"
    ]
  }
};
