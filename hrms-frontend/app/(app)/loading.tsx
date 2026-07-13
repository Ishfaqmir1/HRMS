// Route-level loading skeleton — renders IMMEDIATELY on navigation while
// the page's JavaScript bundle is being fetched and parsed.
// This single-handedly eliminates the "white flash" / blank screen between routes.

export default function AppLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-6">
      {/* Title skeleton */}
      <div className="h-8 w-56 rounded-lg bg-gray-200" />

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-gray-200" />
              <div className="space-y-2">
                <div className="h-7 w-16 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-100" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="mb-4 h-5 w-32 rounded bg-gray-200" />
            <div className="h-[260px] rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <div className="mb-4 h-5 w-40 rounded bg-gray-200" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 flex-1 rounded bg-gray-100" />
              <div className="h-4 w-24 rounded bg-gray-100" />
              <div className="h-4 w-20 rounded bg-gray-100" />
              <div className="h-4 w-16 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
