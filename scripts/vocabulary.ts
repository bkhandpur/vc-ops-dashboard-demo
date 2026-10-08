/**
 * The invented vocabulary the seed is built from.
 *
 * ── WHY IT LOOKS LIKE THIS ───────────────────────────────────────────────────
 * Every company name in this dataset is assembled from a coined prefix and a coined
 * ending, neither of which is a real word in any language. That is deliberate: a
 * plausible-sounding generator ("Bright" + "Flow") will eventually land on a real
 * startup by chance, and a demo dataset that accidentally names a real company —
 * and then attaches invented funding figures to it — is worse than a demo dataset
 * that reads slightly synthetic.
 *
 * Given names are real, because a first name on its own identifies nobody and a
 * dataset of unpronounceable people is unreadable. Surnames are coined by the same
 * machinery as the company names.
 */

export const NAME_PREFIXES = [
  "Av",
  "Bex",
  "Cal",
  "Dra",
  "Emb",
  "Fen",
  "Gla",
  "Har",
  "Ilv",
  "Jor",
  "Kel",
  "Lom",
  "Mar",
  "Nys",
  "Orv",
  "Pal",
  "Quo",
  "Rav",
  "Sab",
  "Tes",
  "Umb",
  "Vel",
  "Wex",
  "Xan",
  "Yar",
  "Zeph",
  "Cind",
  "Dorn",
  "Elst",
  "Fyr",
] as const;

export const NAME_ENDINGS = [
  "erlon",
  "worth",
  "luvia",
  "veln",
  "erik",
  "wold",
  "aselle",
  "owen",
  "anto",
  "vane",
  "vara",
  "vir",
  "owen",
  "tral",
  "exa",
  "anth",
  "rrin",
  "endel",
  "lon",
  "sorra",
  "rik",
  "orne",
  "ollow",
  "thir",
  "owan",
  "rin",
  "ralux",
  "hallow",
] as const;

/** Appended to some names so the set reads like a book of companies, not a word list. */
export const COMPANY_SUFFIXES = [
  "",
  "",
  "",
  "",
  " Labs",
  " Health",
  " Systems",
  " Bio",
  " Works",
  " Grid",
  " Care",
  " Freight",
  " Learning",
  " Foundry",
  " Diagnostics",
  " Energy",
] as const;

export const GIVEN_NAMES = [
  "Amara",
  "Priya",
  "Tomas",
  "Ines",
  "Rahul",
  "Noor",
  "Elena",
  "Jonas",
  "Mei",
  "Kwame",
  "Sofia",
  "Aleks",
  "Yusuf",
  "Clara",
  "Diego",
  "Hana",
  "Omar",
  "Lucia",
  "Nikhil",
  "Freya",
  "Sanjay",
  "Marta",
  "Idris",
  "Anouk",
  "Levi",
  "Farida",
  "Bruno",
  "Keiko",
  "Rosa",
  "Emil",
  "Zara",
  "Andres",
  "Lian",
  "Teodor",
  "Naomi",
  "Pavel",
  "Adaeze",
  "Ravi",
  "Signe",
  "Hugo",
  "Leila",
  "Kian",
  "Bettina",
  "Mateo",
  "Tsering",
  "Solveig",
  "Arjun",
  "Nadia",
  "Caleb",
  "Yara",
] as const;

export const SURNAME_ENDINGS = [
  "aker",
  "sund",
  "quist",
  "ronn",
  "vale",
  "mere",
  "beck",
  "holt",
  "wyn",
  "dahl",
  "strom",
  "ford",
  "ley",
  "moor",
  "sen",
  "kova",
  "ari",
  "eli",
  "ova",
  "ain",
] as const;

/** The five teammates who source founders. Fictional, and consistent across the seed. */
export const TEAM_MEMBERS = [
  "A. Vandermeer",
  "R. Okonjo",
  "S. Lindqvist",
  "M. Haddad",
  "T. Ferreira",
] as const;

export const CITIES = [
  "Denver, CO",
  "Austin, TX",
  "Boston, MA",
  "Seattle, WA",
  "Chicago, IL",
  "Toronto, ON",
  "London",
  "Berlin",
  "Lisbon",
  "Amsterdam",
  "Stockholm",
  "Nairobi",
  "Lagos",
  "Bengaluru",
  "Singapore",
  "São Paulo",
  "Mexico City",
  "Tel Aviv",
  "Sydney",
  "Dublin",
  "Copenhagen",
  "Zurich",
  "Paris",
  "Madrid",
  "Warsaw",
] as const;

/**
 * Archive-list cities are stored as a `location`-typed value rather than text, so this
 * list is kept separate: it is the one that gets emitted as {locality, region}.
 */
export const ARCHIVE_CITIES = [
  { locality: "Manchester", region: null },
  { locality: "Bristol", region: null },
  { locality: "Portland", region: "OR" },
  { locality: "Raleigh", region: "NC" },
  { locality: "Kraków", region: null },
  { locality: "Porto", region: null },
  { locality: "Tallinn", region: null },
  { locality: "Accra", region: null },
  { locality: "Pune", region: null },
  { locality: "Valencia", region: null },
  { locality: "Helsinki", region: null },
  { locality: "Ottawa", region: "ON" },
] as const;

// ---------------------------------------------------------------------------
// Three-level synthetic taxonomy.
// ---------------------------------------------------------------------------

/**
 * Theme → Canonical Sector → Sub-Sector.
 *
 * Level 1 and 2 are single-select on the company record, so counts at those levels are
 * exact distinct-company counts. Level 3 is a multiselect with 132 options, so counts
 * there are TAG counts and can sum above their parent. Every view that renders the
 * third level has to say which it is showing.
 *
 * The names are invented. The *shape* — a small set of themes, nine sectors, and a long
 * tail of sub-sectors that nobody would try to render on one chart — is the real shape,
 * and it is what forces the sunburst to drill rather than draw three rings.
 */
export const TAXONOMY: Record<string, Record<string, string[]>> = {
  "Care & Longevity": {
    "Clinical Care": [
      "Primary Care Delivery",
      "Specialty Clinics",
      "Virtual Care",
      "Care Navigation",
      "Chronic Disease Management",
      "Behavioral Health",
      "Maternal Health",
      "Oncology Care",
      "Cardiometabolic",
      "Post-Acute Care",
      "Palliative Care",
      "Pediatric Care",
      "Dental Delivery",
      "Rural Access",
      "Care Coordination",
    ],
    "Consumer Wellbeing": [
      "Sleep",
      "Nutrition",
      "Fitness Hardware",
      "Fitness Software",
      "Menopause",
      "Men's Health",
      "Women's Health",
      "Longevity Diagnostics",
      "Supplements",
      "Mindfulness",
      "Recovery",
      "Hearing",
      "Vision",
      "Skin Health",
    ],
    "Life Sciences Tools": [
      "Lab Automation",
      "Bioinformatics",
      "Assay Development",
      "Sample Logistics",
      "Clinical Trial Software",
      "Real-World Evidence",
      "Biomanufacturing",
      "Reagents",
      "Imaging Analysis",
      "Genomics Infrastructure",
      "Proteomics",
      "Cell Culture",
      "Regulatory Software",
      "Biobanking",
    ],
  },
  "Work & Craft": {
    "Workforce Software": [
      "Frontline Scheduling",
      "Payroll",
      "Benefits Administration",
      "Hiring Workflow",
      "Contractor Management",
      "Deskless Communications",
      "Performance Tooling",
      "Workforce Analytics",
      "Compliance Automation",
      "Field Service",
      "Time & Attendance",
      "Internal Mobility",
      "Onboarding",
      "Shift Marketplaces",
    ],
    "Learning & Skills": [
      "Vocational Training",
      "Apprenticeships",
      "Credentialing",
      "Corporate L&D",
      "Language Learning",
      "Early Years",
      "Tutoring Marketplaces",
      "Assessment",
      "Curriculum Tools",
      "Simulation Training",
      "Trade Schools",
      "Financial Literacy",
      "Instructor Tooling",
      "Alumni Networks",
    ],
    "Commerce Enablement": [
      "Merchant Payments",
      "Returns",
      "Storefront Tooling",
      "Wholesale Marketplaces",
      "Loyalty",
      "Pricing Software",
      "Catalog Management",
      "Fraud Prevention",
      "Subscription Billing",
      "Cross-Border Selling",
      "Inventory Planning",
      "Point of Sale",
      "Creator Commerce",
      "Retail Media",
    ],
  },
  "Planet & Resources": {
    "Energy Systems": [
      "Grid Software",
      "Distributed Storage",
      "Demand Response",
      "Solar Financing",
      "Heat Pumps",
      "Industrial Efficiency",
      "EV Charging",
      "Long-Duration Storage",
      "Nuclear Services",
      "Geothermal",
      "Energy Data",
      "Microgrids",
      "Fuel Switching",
      "Transmission Planning",
    ],
    "Built Environment": [
      "Construction Software",
      "Modular Build",
      "Retrofit",
      "Building Materials",
      "Facilities Operations",
      "Property Data",
      "Water Systems",
      "HVAC Controls",
      "Permitting",
      "Embodied Carbon",
      "Housing Finance",
      "Site Robotics",
      "Insulation",
      "Asset Monitoring",
    ],
    "Freight & Mobility": [
      "Freight Brokerage",
      "Last-Mile Delivery",
      "Fleet Electrification",
      "Rail Software",
      "Port Operations",
      "Cold Chain",
      "Warehouse Robotics",
      "Customs Software",
      "Micromobility",
      "Maritime Fuel",
      "Route Optimisation",
      "Driver Tooling",
      "Parcel Networks",
      "Yard Management",
    ],
  },
};

/** Second, distinct taxonomy — enrichment-side theme tags. Never charted in Statistics. */
export const INVESTMENT_THEME_TAGS = [
  "Ageing Population",
  "Labour Shortage",
  "Electrification",
  "Reshoring",
  "Preventative Care",
  "Automation",
  "Circularity",
  "Financial Inclusion",
  "Data Infrastructure",
  "Regulatory Tailwind",
] as const;

export const INDUSTRY_TAGS = [
  "Software",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Transportation",
  "Energy",
  "Education",
  "Construction",
  "Biotechnology",
  "Logistics",
  "Consumer Goods",
  "Professional Services",
] as const;

export const CATEGORY_TAGS = [
  "B2B SaaS",
  "Marketplace",
  "Hardware",
  "Devices",
  "Services",
  "Platform",
  "Data",
  "Infrastructure",
  "Consumer App",
  "API",
  "Robotics",
  "Diagnostics",
  "Fintech-Adjacent",
  "Vertical SaaS",
] as const;

export const OWNERSHIP_TYPES = [
  "Venture-backed",
  "Bootstrapped",
  "Founder-owned",
  "Corporate spinout",
] as const;

export const CLIENT_FOCUS = ["b2b", "b2c", "b2b2c"] as const;

export const DEAL_STRUCTURES = ["Direct", "Co-Investment", "SPV", "Secondary"] as const;

export const VEHICLES = ["Angel", "Fund I", "SPV"] as const;

export const ARR_BANDS = [
  "$0-$1M",
  "$1M-$5M",
  "$5M-$10M",
  "$10M-$50M",
  "$50M-$100M",
  "$100M+",
] as const;

export const HEADCOUNT_BANDS = [
  "1-10",
  "11-50",
  "51-100",
  "101-250",
  "251-1000",
  "1001-5000",
  "5000+",
] as const;

export const PIPELINE_STAGES = [
  "Sourcing",
  "First Meeting",
  "Diligence",
  "Partner Review",
  "Term Sheet",
  "Passed",
] as const;

export const PORTFOLIO_STATUSES = [
  "Active",
  "Active — Follow-on",
  "Monitoring",
  "Written Off",
  "Exited",
] as const;

export const STAGE_FOCUS = ["Pre-Seed", "Seed", "Series A", "Series B", "Growth"] as const;

/**
 * Co-investor thesis vocabulary. Note that NONE of these terms appears in the
 * taxonomy above — that is the point. The real datasets had zero literal overlap
 * between how co-investors describe themselves and how the firm classifies companies,
 * which is why `THESIS_TO_SECTOR` in lib/matchmaking.ts is a hand-written crosswalk
 * and not a string match. String matching returns 0.0 for every investor.
 */
export const THESIS_TERMS = [
  "Digital Health",
  "Care Delivery",
  "Biotech Tools",
  "Consumer Subscription",
  "Future of Work",
  "Vertical Software",
  "Commerce Infrastructure",
  "Education Technology",
  "Climate Technology",
  "Industrial Technology",
  "Supply Chain",
  "Mobility",
  "Deep Tech",
  "Frontier Hardware",
  "Marketplaces",
] as const;

export const CHECK_SIZES = [
  "$100K–$500K",
  "$250K–$1M",
  "$500K–$2M",
  "$1M–$5M",
  "$2M–$10M",
  "$5M–$25M",
] as const;

export const EDUCATION = [
  "State University; MSc Bioengineering",
  "Technical Institute; BEng",
  "Northern Polytechnic; MBA",
  "City College; BA Economics",
  "Institute of Design; MDes",
  "Regional University; PhD Chemistry",
  "Metropolitan University; BSc Computer Science",
  "Coastal University; MPH",
] as const;

/**
 * Founder credential tags, as the enrichment provider's REST API spells them.
 *
 * Note the spelling: Title Case with spaces, not the SCREAMING_SNAKE enum form the
 * provider's own documentation lists. Matching on the documented form scores zero for
 * every founder — see lib/founder-quality.ts, which normalises both.
 *
 * The `$N Club` tiers are emitted as free-form strings rather than a fixed set, because
 * the real provider's set is wider than any documentation listed and a hardcoded list
 * would silently miss a new tier.
 */
export const HIGHLIGHT_TAGS = [
  "Top University",
  "Prior Exit",
  "Prior VC Backed Founder",
  "Seasoned Founder",
  "Founder Turned Operator",
  "Prior VC Backed Executive",
  "Seasoned Executive",
  "Deep Technical Background",
  "Major Tech Company Experience",
  "Published Researcher",
  "Notable Followers",
  "$5M Club",
  "$10M Club",
  "$25M Club",
  "$50M+ Club",
] as const;

export const PRIOR_ROLES = [
  "VP Engineering",
  "Head of Product",
  "Chief of Staff",
  "GM, Growth",
  "Director of Operations",
  "Principal Scientist",
  "Head of Clinical",
  "Staff Engineer",
  "Commercial Director",
  "Head of Data",
] as const;
