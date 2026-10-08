
export const navigation = {
  logo: { text: "SqlFlow" },
  links: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#use-cases", label: "Use cases" },
  ],
  actions: [{ label: "Get started free" }],
};

export const hero = {
  eyebrow: { label: "Now in early access, free to use" },
  headline: {
    line1: "Master SQL by",
    highlight: "writing real queries",
    line3: "against live databases.",
  },
  description:
    "SqlFlow drops you into a sandboxed Postgres database with graded challenges and instant feedback. No setup, no guessing, just SQL that runs and results that teach.",
  primaryCta: { label: "Start practising free", icon: "arrow-right" },
  secondaryCta: { label: "See how it works", href: "#how-it-works" },
  trustText: "Runs in your browser · Real Postgres under the hood",
};

export const heroStats = [
  { value: "24+", label: "graded challenges" },
  { value: "< 2 s", label: "query feedback" },
  { value: "100 %", label: "browser-based" },
];

export const problem = {
  eyebrow: "Where learners get stuck",
  title: "Knowing SQL syntax isn't the same as using SQL.",
  description:
    "Most courses end with a multiple-choice quiz, but real databases don't come with answer options. SqlFlow gives you a live database to practise in, so you learn to work through a query yourself.",
  painPoints: [
    {
      icon: "code",
      title: "Reading doesn't stick",
      description:
        "Watching examples feels productive, but you'll remember very little until you write the queries yourself. Practice is what turns a concept into a skill you can use.",
    },
    {
      icon: "database",
      title: "Practice data is too simple",
      description:
        "Three-row tables and single-table queries don't prepare you for NULLs, duplicate rows, or multi-table joins. Real work looks more like a messy schema with a dozen tables.",
    },
    {
      icon: "alert-triangle",
      title: "Error messages leave you stuck",
      description:
        "Postgres errors are terse and often point at the wrong line. Without a hint, one missing alias or a misplaced GROUP BY can cost you half an hour.",
    },
    {
      icon: "activity",
      title: "You get a result, not a reason",
      description:
        "Knowing an answer is wrong doesn't show you why your rows were off or how the correct query gets there. Clear, specific feedback is what closes that gap.",
    },
  ],
};

export const solution = {
  eyebrow: "The solution",
  title: "A graded sandbox that explains every result.",
  description:
    "SqlFlow executes your query in an isolated Postgres schema, normalises both result sets, compares them row-by-row, and tells you exactly what differed, so every wrong answer is a learning moment.",
};

export const supportedStack = {
  categories: [
    {
      technologies: [
        { name: "SELECT" },
        { name: "JOIN" },
        { name: "GROUP BY" },
        { name: "Subqueries" },
        { name: "Window Functions" },
        { name: "CTEs" },
        { name: "Aggregates" },
        { name: "NULL handling" },
        { name: "CASE WHEN" },
        { name: "DISTINCT" },
        { name: "ORDER BY" },
        { name: "HAVING" },
        { name: "UNION" },
        { name: "EXISTS" },
        { name: "Indexes" },
        { name: "Transactions" },
      ],
    },
  ],
};

export const architectureGraph = {
  id: "schema",
  capabilities: [
    {
      title: "Dependency awareness",
      description:
        "Every challenge comes with a pre-seeded schema. SqlFlow knows which tables, columns, and relationships your query must touch.",
    },
    {
      title: "Impact analysis",
      description:
        "When your result set differs, SqlFlow highlights which rows were missing, extra, or wrong, not just a pass/fail badge.",
    },
    {
      title: "Compatibility validation",
      description:
        "Queries run in a locked-down schema so no DDL accidents. Your SELECT, INSERT, UPDATE practice never leaks to other students.",
    },
    {
      title: "Architecture visualization",
      description:
        "Every challenge surfaces the live schema graph so you can trace foreign keys and understand the data model before you write a line.",
    },
  ],
  example: {
    entities: [
      { id: "users", label: "users", type: "core" },
      { id: "sessions", label: "sessions" },
      { id: "assignments", label: "assignments", type: "core" },
      { id: "attempts", label: "attempts", type: "engine" },
      { id: "submissions", label: "submissions" },
      { id: "test_cases", label: "test_cases" },
      { id: "hints", label: "hint_requests" },
      { id: "eval", label: "eval_results" },
    ] as const,
    relationships: [
      ["users", "sessions"],
      ["users", "attempts"],
      ["assignments", "test_cases"],
      ["assignments", "attempts"],
      ["attempts", "submissions"],
      ["submissions", "eval"],
      ["attempts", "hints"],
    ] as const,
  },
};

export const compiler = {
  eyebrow: "The grading engine",
  title: "Deterministic grading. Every time.",
  description:
    "Your query runs in a sandboxed Postgres schema. Results are normalised, column names lower-cased, rows sorted by value, then compared against the expected output row-by-row. No flaky string matching.",
  architectureDefinition: {
    language: "sql",
    code: `-- SqlFlow sandbox schema (excerpt)
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role        TEXT DEFAULT 'student',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assignments (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  question    TEXT NOT NULL
);

CREATE TABLE attempts (
  id            SERIAL PRIMARY KEY,
  user_id       INT REFERENCES users(id),
  assignment_id INT REFERENCES assignments(id),
  status        TEXT DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ
);`,
  },
  pipeline: [
    { step: "01", icon: "code", label: "Parse SQL" },
    { step: "02", icon: "database", label: "Execute in sandbox" },
    { step: "03", icon: "shuffle", label: "Normalise result" },
    { step: "04", icon: "scan", label: "Compare rows" },
    { step: "05", icon: "check-circle", label: "Score & explain" },
  ],
};

export const architectureArtifact = {
  tree: {
    label: "sqlflow-schema",
    children: [
      {
        label: "tables",
        children: [
          "users.sql",
          "sessions.sql",
          "assignments.sql",
          "test_cases.sql",
          "attempts.sql",
          "submissions.sql",
          "eval_results.sql",
          "hint_requests.sql",
        ],
      },
      {
        label: "seed",
        children: [
          "users.seed.ts",
          "assignments.seed.ts",
          "sandbox.seed.ts",
        ],
      },
      {
        label: "services",
        children: [
          "sandbox.service.ts",
          "grading.service.ts",
          "normalizer.service.ts",
          "comparator.service.ts",
        ],
      },
    ],
  },
};

export const github = {
  flow: [
    { label: "Run query", icon: "rocket" },
    { label: "Request hint", icon: "sparkles" },
    { label: "View schema", icon: "database" },
    { label: "Reset editor", icon: "rotate-ccw" },
    { label: "View history", icon: "clock" },
  ],
  pullRequest: {
    files: [
      { name: "normalizer.service.ts" },
      { name: "comparator.service.ts" },
      { name: "sandbox.service.ts" },
      { name: "grading.controller.ts" },
      { name: "assignments.seed.ts" },
      { name: "schema.prisma" },
    ],
  },
};

export const deterministicEngine = {
  layers: [
    {
      title: "Intelligence",
      number: "Layer 01",
      description:
        "Parses your SQL, validates syntax, and resolves table references against the live sandbox schema before execution.",
      components: ["pg-parser", "schema resolver", "alias tracker", "type checker"],
    },
    {
      title: "Architecture Engine",
      number: "Layer 02",
      description:
        "Executes your query in an isolated Postgres schema spun up per student, ensuring no cross-contamination between sessions.",
      components: ["pg-boss queue", "Neon sandbox", "row limiter", "timeout guard"],
    },
    {
      title: "Executors",
      number: "Layer 03",
      description:
        "Normalises column names and row order, then compares each row against the expected output with type-coercion awareness.",
      components: ["normalizer", "comparator", "diff reporter", "score calculator"],
    },
  ],
};

export const validation = {
  title: "Query validation pipeline",
  description:
    "Before your score lands, your query passes through four gates, keeping false positives and false negatives at zero.",
  pipeline: [
    { step: "Syntax check" },
    { step: "Schema resolve" },
    { step: "Sandbox execute" },
    { step: "Result normalise" },
    { step: "Row compare" },
    { step: "Score emit" },
  ],
  failureLoop: {
    title: "On mismatch, auto explain",
    steps: ["Diff rows", "Identify gap", "Generate hint", "Surface in UI"],
  },
};

export const architectureChange = {
  example: {
    from: { technology: "SQLite mock" },
    to: { technology: "Neon Postgres" },
    impact: { affectedModules: 8 },
  },
};

export const comparison = {
  eyebrow: "Why SqlFlow",
  title: "More than a quiz, a real practice environment.",
  description:
    "Other platforms test recall. SqlFlow builds muscle memory by running your actual SQL against a live database and explaining every diff.",
  columns: [
    { name: "SqlFlow", icon: "database", highlighted: true },
    { name: "W3Schools", icon: "code" },
    { name: "LeetCode SQL", icon: "cpu" },
    { name: "HackerRank", icon: "shield" },
  ],
  rows: [
    {
      label: "Live Postgres sandbox",
      archonStatus: "shipped" as const,
      values: [true, false, false, false] as (boolean | "partial")[],
    },
    {
      label: "Row-level diff feedback",
      archonStatus: "shipped" as const,
      values: [true, false, false, false] as (boolean | "partial")[],
    },
    {
      label: "Graded challenges",
      archonStatus: "shipped" as const,
      values: [true, false, true, true] as (boolean | "partial")[],
    },
    {
      label: "Schema visualisation",
      archonStatus: "shipped" as const,
      values: [true, false, false, "partial"] as (boolean | "partial")[],
    },
    {
      label: "AI-powered hints",
      archonStatus: "planned" as const,
      values: [true, false, false, false] as (boolean | "partial")[],
    },
    {
      label: "Progress dashboard",
      archonStatus: "planned" as const,
      values: [true, false, "partial", "partial"] as (boolean | "partial")[],
    },
    {
      label: "Custom schema upload",
      archonStatus: "planned" as const,
      values: [true, false, false, false] as (boolean | "partial")[],
    },
  ],
};

export const decisionEngine = {
  eyebrow: "Adaptive grading",
  title: "The engine decides what counts as correct, not a regex.",
  decisions: [
    {
      capability: "Column order",
      decision: "Ignored",
      reason:
        "Column order in a SELECT is irrelevant to correctness; we normalise before comparing.",
    },
    {
      capability: "Row order",
      decision: "Normalised",
      reason:
        "Without an ORDER BY, Postgres can return rows in any order. We sort both sides by value before diff.",
    },
    {
      capability: "Numeric strings",
      decision: "Coerced",
      reason:
        "\"42\" and 42 are the same answer. The normaliser coerces numeric strings so type-casting edge cases don't penalise you.",
    },
    {
      capability: "NULL handling",
      decision: "Strict",
      reason:
        "NULLs are semantically significant. A missing NULL or unexpected NULL counts as a row mismatch.",
    },
  ],
};

export const developerExperience = {
  id: "features",
  eyebrow: "Built to teach",
  title: "Every design decision serves one goal: faster learning.",
  description:
    "SqlFlow is built on the premise that you learn SQL by writing SQL, not by watching someone else write it. Every feature is optimised for the feedback loop.",
  principles: [
    {
      title: "Instant execution",
      description:
        "Hit Run and see your results in under two seconds. The tight loop between writing and seeing is the core of skill-building.",
    },
    {
      title: "Explain the diff, not just the answer",
      description:
        "When you're wrong, we show you which rows were missing or extra, not just \"incorrect\". Understanding the gap is the lesson.",
    },
    {
      title: "Real schemas, not toy data",
      description:
        "Our challenges use realistic schemas with foreign keys, NULLs, and multiple related tables. What you practice is what you'll face.",
    },
    {
      title: "Difficulty that scales",
      description:
        "Challenges are tagged easy, medium, or hard. Start with simple filters and work up to multi-table aggregations with window functions.",
    },
    {
      title: "No setup friction",
      description:
        "Sign up and start your first challenge in under 60 seconds. No local Postgres, no Docker, no config files.",
    },
  ],
};

export const useCases = {
  id: "use-cases",
  eyebrow: "Who it's for",
  title: "Whether you're starting out or sharpening up.",
  items: [
    {
      icon: "users",
      title: "CS students",
      description:
        "Reinforce what your database course teaches by running the queries yourself against a live schema, not pasting them into a slideshow.",
    },
    {
      icon: "code-2",
      title: "Backend developers",
      description:
        "Brush up on window functions, CTEs, and complex JOINs without spinning up a local database or hunting for sample data.",
    },
    {
      icon: "table-2",
      title: "Data analysts",
      description:
        "Practice the SQL patterns that appear in analytics: GROUP BY with HAVING, running totals, cohort queries, and more.",
    },
    {
      icon: "search",
      title: "Interview prep",
      description:
        "SQL interviews ask you to write correct, efficient queries under pressure. Practice on challenges ranked by the topics that come up most.",
    },
    {
      icon: "rocket",
      title: "Career switchers",
      description:
        "Transitioning into data engineering or backend work? SqlFlow gives you a structured path from basic SELECTs to production-grade queries.",
    },
    {
      icon: "shield-check",
      title: "Team onboarding",
      description:
        "Bring new engineers up to speed on your data model fast. Assign specific challenges that mirror your real schema.",
    },
  ],
};

export const roadmap = {
  eyebrow: "Roadmap",
  title: "What's built, what's next.",
  description:
    "SqlFlow launched with a working sandbox and graded challenges. Here's where it goes from here.",
  phases: [
    {
      version: "V0",
      status: "current" as const,
      title: "Live sandbox",
      features: [
        "24+ graded challenges",
        "Isolated Postgres sandbox",
        "Row-level diff feedback",
        "Easy / Medium / Hard tiers",
        "Auth & session management",
      ],
    },
    {
      version: "V1",
      status: "planned" as const,
      title: "Smart hints",
      features: [
        "AI-powered hint system",
        "Query explanation panel",
        "Progress tracking dashboard",
        "Bookmarks & attempt history",
      ],
    },
    {
      version: "V2",
      status: "planned" as const,
      title: "Community",
      features: [
        "Leaderboard & streaks",
        "Discussion per challenge",
        "User-submitted solutions",
        "Difficulty voting",
      ],
    },
    {
      version: "V3",
      status: "future" as const,
      title: "Enterprise",
      features: [
        "Custom schema upload",
        "Team workspaces",
        "Assign challenges to cohorts",
        "Export progress reports",
      ],
    },
  ],
};

export const waitlist = {
  id: "waitlist",
  eyebrow: "Get early access",
  title: "Start writing real SQL today.",
  description:
    "Sign up in seconds, no credit card required. Your first challenge is waiting.",
  submitLabel: "Create free account",
  privacyNote: "No spam. No credit card. Unsubscribe any time.",
};

export const finalCta = {
  description: "Join developers and students already practising on SqlFlow.",
};

export const product = {
  id: "how-it-works",
  eyebrow: "How it works",
  title: "From prompt to passing query in four steps.",
  description:
    "SqlFlow walks you through each challenge with a live editor, schema reference, and instant graded feedback.",
  features: [
    {
      id: "write",
      number: "01",
      icon: "code",
      status: "shipped" as const,
      title: "Read the challenge, inspect the schema",
      description:
        "Every challenge shows the question, a description of the expected output, and the full live schema so you know exactly what tables and columns you're working with.",
      input: {
        label: "Challenge prompt",
        content: `Write a query that returns the email
and display_name of every user whose
role is 'student', ordered by email
ascending.`,
      },
      output: {
        label: "Expected columns",
        items: ["email", "display_name"],
      },
    },
    {
      id: "score",
      number: "02",
      icon: "scan",
      status: "shipped" as const,
      title: "Submit and get an instant skill score",
      description:
        "After each submission your score updates across every SQL topic we track. See exactly which areas are strong and where to focus next.",
      score: {
        categories: [
          { name: "SELECT & filtering", score: 91 },
          { name: "JOINs", score: 74 },
          { name: "Aggregates", score: 68 },
          { name: "Subqueries", score: 45 },
          { name: "Window functions", score: 30 },
          { name: "NULL handling", score: 82 },
        ],
      },
      findings: [
        { severity: "warning", title: "Subquery rewrite missed LATERAL JOIN opportunity" },
        { severity: "warning", title: "GROUP BY without HAVING loses edge-case rows" },
        { severity: "critical", title: "Window frame default may cause off-by-one in running total" },
      ],
    },
    {
      id: "fixes",
      number: "03",
      icon: "shield-check",
      status: "shipped" as const,
      title: "See exactly which rows differed",
      description:
        "When your result doesn't match, SqlFlow diffs both result sets and surfaces the specific rows that were missing, extra, or had wrong values.",
      fixes: [
        { title: "Missing NULL row for inactive users", technology: "NULL handling" },
        { title: "Extra row: duplicate on LEFT JOIN", technology: "JOIN logic" },
        { title: "Wrong count, GROUP BY too broad", technology: "Aggregates" },
        { title: "Off-by-one in LIMIT offset", technology: "Pagination" },
        { title: "Case-sensitive email comparison", technology: "String ops" },
        { title: "Missing ORDER BY, row order undefined", technology: "Sorting" },
      ],
    },
    {
      id: "path",
      number: "04",
      icon: "layers",
      status: "shipped" as const,
      title: "Follow the structured learning path",
      description:
        "Challenges are organised from single-table SELECTs all the way up to multi-step analytical queries. Complete each tier before the next unlocks.",
      before: ["Single-table SELECT", "Basic WHERE", "ORDER BY"],
      request: "→ advanced aggregations",
      migration: [
        {
          phase: "Easy",
          steps: ["Simple SELECT", "Filtering rows", "Sorting results", "DISTINCT values"],
        },
        {
          phase: "Medium",
          steps: ["Multi-table JOINs", "GROUP BY + HAVING", "Subqueries", "NULL handling"],
        },
        {
          phase: "Hard",
          steps: ["Window functions", "Recursive CTEs", "Complex analytics", "Query optimisation"],
        },
      ],
    },
  ],
};

export const footer = {
  brand: {
    name: "SqlFlow",
    description:
      "A hands-on SQL practice platform with a live Postgres sandbox, graded challenges, and row-level diff feedback.",
  },
  columns: [
    {
      title: "Product",
      links: [
        { label: "Challenges", href: "/assignments" },
        { label: "How it works", href: "#how-it-works" },
        { label: "Get started", href: "#waitlist" },
      ],
    },
    {
      title: "Learn",
      links: [
        { label: "SELECT basics", href: "/assignments" },
        { label: "Aggregates", href: "/assignments" },
        { label: "Window functions", href: "/assignments" },
      ],
    },
  ],
  bottom: {
    copyright: `© ${new Date().getFullYear()} SqlFlow. Built with Next.js and Neon Postgres.`,
    links: [] as { label: string; href: string }[],
  },
};
