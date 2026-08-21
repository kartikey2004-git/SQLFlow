import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <main className="flex w-full max-w-3xl flex-col items-start gap-10 bg-white px-8 py-24 sm:px-16">
        <div className="flex flex-col items-start gap-6 text-left">
          <h1 className="max-w-xs text-4xl leading-tight font-semibold tracking-tight text-balance text-gray-900 sm:text-[40px]">
            Learn SQL by running real queries
          </h1>
          <p className="max-w-md text-lg leading-8 text-balance text-gray-600">
            Every exercise runs against an isolated Postgres sandbox - real
            data, real errors, graded against hidden test cases.
          </p>
        </div>
        <div className="flex w-full max-w-md flex-row gap-4 text-sm">
          <Link
            href="/assignments"
            className="flex h-10 w-fit items-center justify-center rounded-full bg-gray-900 px-4 font-medium text-white transition-colors hover:bg-gray-700"
          >
            Browse exercises
          </Link>
          <Link
            href="/register"
            className="flex h-10 w-fit items-center justify-center rounded-full border border-gray-200 px-4 font-medium text-gray-900 transition-colors hover:bg-gray-100"
          >
            Create an account
          </Link>
        </div>
      </main>
    </div>
  );
}
