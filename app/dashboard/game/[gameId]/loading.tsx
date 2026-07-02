export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 animate-pulse">
      <div className="h-4 w-20 bg-gray-200 rounded mb-4" />
      <div className="h-7 w-56 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-36 bg-gray-200 rounded mb-6" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-[#e2e8e5] p-4">
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-7 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
          <div className="px-4 py-4 border-b border-[#e2e8e5]">
            <div className="h-4 w-40 bg-gray-200 rounded" />
          </div>
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex items-center gap-4 px-4 py-4 border-b border-[#e2e8e5] last:border-0">
              <div className="h-4 w-32 bg-gray-200 rounded flex-1" />
              <div className="h-4 w-12 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
