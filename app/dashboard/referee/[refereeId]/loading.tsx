export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 animate-pulse">
      {/* Header */}
      <div className="h-4 w-24 bg-gray-200 rounded mb-6" />
      <div className="h-7 w-48 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-32 bg-gray-200 rounded mb-6" />

      {/* Filter pills */}
      <div className="flex gap-2 mb-6">
        {[80, 120, 100].map((w, i) => (
          <div key={i} className="h-8 rounded-full bg-gray-200" style={{ width: w }} />
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-[#e2e8e5] p-4">
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-7 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Feedback block */}
      <div className="rounded-xl h-28 bg-[#002e23]/20 mb-6" />

      {/* Accuracy breakdown */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6 mb-6">
        <div className="h-4 w-40 bg-gray-200 rounded mb-5" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-4">
            <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-full bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>

      {/* Table placeholder */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden">
        <div className="px-4 py-4 border-b border-[#e2e8e5]">
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-[#e2e8e5] last:border-0">
            <div className="h-4 w-32 bg-gray-200 rounded flex-1" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
