
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
    "SqlFlow gives you your own PostgreSQL 17 database for every challenge, with graded feedback and no setup. Write the query, run it, and learn from the result.",
  primaryCta: { label: "Start practising free", icon: "arrow-right" },
  secondaryCta: { label: "See how it works", href: "#how-it-works" },
  trustText: "Runs in your browser · Real PostgreSQL 17 under the hood",
};

export const heroStats = [
  { value: "16", label: "graded challenges" },
  { value: "Your own", label: "database per challenge" },
  { value: "PG 17", label: "real PostgreSQL" },
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
    "SqlFlow runs your statements against your own PostgreSQL database, normalises both results, and tells you which check failed, so every wrong answer is a learning moment.",
};

export const supportedStack = {
  categories: [
    {
      technologies: [
        { name: "SELECT & WHERE" },
        { name: "COUNT & aggregates" },
        { name: "GROUP BY" },
        { name: "NULL checks" },
        { name: "Duplicate detection" },
        { name: "INSERT / UPDATE / DELETE" },
        { name: "CREATE / ALTER / DROP" },
        { name: "Transactions" },
        { name: "Multi-statement scripts" },
      ],
    },
  ],
};

export const architectureGraph = {
  id: "schema",
  capabilities: [
    {
      title: "Your own database",
      description:
        "Every student gets a PostgreSQL database of their own, seeded with the challenge's tables. Other students' data is not reachable from it.",
    },
    {
      title: "Real SQL, not a simulator",
      description:
        "Run any statement your database allows, including CREATE, INSERT, UPDATE, DELETE, and transactions. Scripts run in order and stop at the first error.",
    },
    {
      title: "Sample data on the page",
      description:
        "Each challenge lists its tables with sample rows, so you can check column names and values before you write a query.",
    },
    {
      title: "The platform's own data model",
      description:
        "The graph below is the platform's data model: users, assignments, attempts, submissions, and their results.",
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
    "Your script runs in your own database. Column names are lower-cased, rows are sorted by value, numeric strings are compared as numbers, and NULLs stay NULL. The result is then compared to the expected output. No flaky string matching.",
  architectureDefinition: {
    language: "sql",
    code: `-- Challenge table (excerpt, from the seed data)
CREATE TABLE users (
  id            INTEGER,
  email         TEXT,
  display_name  TEXT,
  role          TEXT,
  email_verified BOOLEAN,
  image         TEXT
);

-- Example row
-- (1, 'alice@gmail.com', 'Alice Johnson', 'student', true, 'https://...')`,
  },
  pipeline: [
    { step: "01", icon: "code", label: "Parse statements" },
    { step: "02", icon: "database", label: "Run in your database" },
    { step: "03", icon: "shuffle", label: "Normalise result" },
    { step: "04", icon: "scan", label: "Compare to expected" },
    { step: "05", icon: "check-circle", label: "Score & explain" },
  ],
};

export const architectureArtifact = {
  tree: {
    label: "apps/api",
    children: [
      {
        label: "services/sandbox",
        children: [
          "sandboxDb.ts",
          "scriptRunner.ts",
          "execution.service.ts",
          "maintenance.service.ts",
        ],
      },
      {
        label: "services/grading",
        children: [
          "grading.service.ts",
          "normalizer.service.ts",
          "comparator.service.ts",
        ],
      },
      {
        label: "data",
        children: [
          "assignments.json",
          "seedAssignments.ts",
        ],
      },
    ],
  },
};

export const github = {
  flow: [
    { label: "Run query", icon: "rocket" },
    { label: "Submit for grading", icon: "shield-check" },
    { label: "Request hint", icon: "sparkles" },
    { label: "View schema", icon: "database" },
    { label: "Reset sandbox", icon: "rotate-ccw" },
  ],
  pullRequest: {
    files: [
      { name: "normalizer.service.ts" },
      { name: "comparator.service.ts" },
      { name: "sandboxDb.ts" },
      { name: "grading.service.ts" },
      { name: "seedAssignments.ts" },
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
        "Splits your script into statements with the PostgreSQL parser, then runs them one at a time and stops at the first error.",
      components: ["pgsql-parser", "statement splitter", "error stop", "per-statement results"],
    },
    {
      title: "Architecture Engine",
      number: "Layer 02",
      description:
        "Runs your script in your own database as a limited role, with a time watchdog and a size check before each run.",
      components: ["pg-boss queue", "per-student database", "role limits", "timeout watchdog"],
    },
    {
      title: "Executors",
      number: "Layer 03",
      description:
        "Lower-cases column names and sorts rows, then compares the result with the expected output and reports the first check that fails.",
      components: ["normalizer", "comparator", "failure reasons", "score calculator"],
    },
  ],
};

export const validation = {
  title: "Query validation pipeline",
  description:
    "Your script passes through five stages. Each stage reports its own result, so a failure always points to a specific step.",
  pipeline: [
    { step: "Parse statements" },
    { step: "Run in your database" },
    { step: "Normalise result" },
    { step: "Compare to expected" },
    { step: "Score emit" },
  ],
  failureLoop: {
    title: "On a failed check, explain why",
    steps: ["Compare row count", "Compare column names", "Compare row values", "Show the reason"],
  },
};

export const architectureChange = {
  example: {
    from: { technology: "Shared sandbox schema" },
    to: { technology: "Database per student" },
    impact: { affectedModules: 7 },
  },
};

export const comparison = {
  eyebrow: "Why SqlFlow",
  title: "More than a quiz, a real practice environment.",
  description:
    "Other platforms test recall. SqlFlow builds muscle memory by running your actual SQL against a real PostgreSQL database and explaining what failed.",
  columns: [
    { name: "SqlFlow", icon: "database", highlighted: true },
    { name: "W3Schools", icon: "code" },
    { name: "LeetCode SQL", icon: "cpu" },
    { name: "HackerRank", icon: "shield" },
  ],
  rows: [
    {
      label: "Live PostgreSQL database",
      archonStatus: "shipped" as const,
      values: [true, false, false, false] as (boolean | "partial")[],
    },
    {
      label: "Specific failure reasons",
      archonStatus: "shipped" as const,
      values: [true, false, false, false] as (boolean | "partial")[],
    },
    {
      label: "Graded challenges",
      archonStatus: "shipped" as const,
      values: [true, false, true, true] as (boolean | "partial")[],
    },
    {
      label: "Sample data on each challenge",
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
        "The order of columns in your result doesn't matter. Column names are sorted before they are compared.",
    },
    {
      capability: "Row order",
      decision: "Normalised",
      reason:
        "Without an ORDER BY, Postgres can return rows in any order. Rows are sorted by value before comparing, so a correct answer isn't failed for its order.",
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
      title: "Fast feedback",
      description:
        "Hit Run and see your results as soon as the query finishes. The tight loop between writing and seeing is the core of skill-building.",
    },
    {
      title: "Explain the failure, not just the answer",
      description:
        "When you're wrong, we show which check failed and, for visible checks, the first row that differs. Understanding the gap is the lesson.",
    },
    {
      title: "Realistic data",
      description:
        "Challenges share a users table with NULLs, duplicate emails, and mixed roles. What you practise is the kind of data you'll see at work.",
    },
    {
      title: "Difficulty that builds",
      description:
        "Challenges are tagged Easy, Medium, or Hard. Start with filters and counts, then move on to grouping and duplicate detection.",
    },
    {
      title: "No setup friction",
      description:
        "Sign up and start your first challenge. No local Postgres, no Docker, no config files.",
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
        "Reinforce what your database course teaches by running the queries yourself against a real PostgreSQL database, not pasting them into a slideshow.",
    },
    {
      icon: "code-2",
      title: "Backend developers",
      description:
        "Practise DDL, DML, and transactions in a scratch database, without setting up a local Postgres or hunting for sample data.",
    },
    {
      icon: "table-2",
      title: "Data analysts",
      description:
        "Practise counting, filtering, and grouping on a realistic users dataset. More analytics challenges are on the roadmap.",
    },
    {
      icon: "search",
      title: "Interview prep",
      description:
        "Practise the query patterns that come up in interviews: filtering, counting, grouping, and duplicate detection.",
    },
    {
      icon: "rocket",
      title: "Career switchers",
      description:
        "Working toward a data or backend role? Start with filters and counts, then work up through grouping and duplicate detection.",
    },
    {
      icon: "shield-check",
      title: "Team onboarding",
      description:
        "Let new engineers practise SQL on sample data today. Custom schemas for teams are on the roadmap.",
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
        "16 graded challenges",
        "Your own PostgreSQL database per challenge",
        "Specific failure reasons",
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
    "SqlFlow walks you through each challenge with a live editor, its sample tables, and graded feedback.",
  features: [
    {
      id: "write",
      number: "01",
      icon: "code",
      status: "shipped" as const,
      title: "Read the challenge, inspect the sample tables",
      description:
        "Every challenge shows the question, the columns the answer must return, and its sample tables with rows, so you know exactly what you're working with.",
      input: {
        label: "Challenge prompt",
        content:
          "The platform has three roles: student, instructor, and admin. Write a query to find all users with the 'admin' role. Return only their id, email, and display_name.",
      },
      output: {
        label: "Expected columns",
        items: ["id", "email", "display_name"],
      },
    },
    {
      id: "score",
      number: "02",
      icon: "scan",
      status: "shipped" as const,
      title: "Submit and see which checks passed",
      description:
        "After each submission, every check is listed as passed or failed, with a weighted score. This is a sample run: the row count and columns match, but one row's values differ.",
      score: {
        categories: [
          { name: "Row count", score: 100 },
          { name: "Column names", score: 100 },
          { name: "Row values", score: 0 },
        ],
      },
      findings: [
        { severity: "critical", title: "Row 2 values do not match expected output" },
        { severity: "warning", title: "Hidden checks show pass or fail only, with no reason" },
      ],
    },
    {
      id: "fixes",
      number: "03",
      icon: "shield-check",
      status: "shipped" as const,
      title: "See which check failed and why",
      description:
        "When a check fails, SqlFlow says which one: row count, column names, or the first row whose values differ. Hidden checks report pass or fail only, so the answer can't be reverse-engineered.",
      fixes: [
        { title: "Expected 3 rows but got 4", technology: "Row count" },
        { title: "Column mismatch: expected 'display_name' but got 'name'", technology: "Column names" },
        { title: "Row 2 values do not match expected output", technology: "Row values" },
        { title: "Expected exactly 1 row but got 2", technology: "Single-row answers" },
      ],
    },
    {
      id: "path",
      number: "04",
      icon: "layers",
      status: "shipped" as const,
      title: "Practise from easy to hard",
      description:
        "Challenges are tagged Easy, Medium, or Hard. Today there are 16 challenges, mostly on one users table. More topics are on the roadmap.",
      before: ["Filter with WHERE", "COUNT rows", "Read one table"],
      request: "→ GROUP BY and duplicates",
      migration: [
        {
          phase: "Easy",
          steps: ["Select all user info", "Filter by role or flag", "Count unverified users", "Find users without an image"],
        },
        {
          phase: "Medium",
          steps: ["Count users by role", "Find duplicate emails", "Find corporate email users", "Find the highest ID"],
        },
        {
          phase: "Hard",
          steps: ["Count verified users per role", "More advanced topics on the roadmap"],
        },
      ],
    },
  ],
};

export const footer = {
  brand: {
    name: "SqlFlow",
    description:
      "A hands-on SQL practice platform with your own PostgreSQL database per challenge, graded results, and clear failure reasons.",
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
        { label: "GROUP BY", href: "/assignments" },
      ],
    },
  ],
  bottom: {
    copyright: `© ${new Date().getFullYear()} SqlFlow. Built with Next.js and PostgreSQL 17 on Google Cloud.`,
    links: [] as { label: string; href: string }[],
  },
};
