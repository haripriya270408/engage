import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <span className="text-2xl font-bold text-primary">SE</span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Sales Engage Platform
        </h1>
        <p className="mb-8 text-sm text-muted">
          Streamline your sales engagement and task management
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
