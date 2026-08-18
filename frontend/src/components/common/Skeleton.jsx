const Skeleton = ({ variant = 'text', className = '', count = 1 }) => {
  const variants = {
    text: 'h-4 rounded w-full',
    heading: 'h-6 rounded w-1/3',
    title: 'h-8 rounded w-1/4',
    avatar: 'rounded-full w-10 h-10',
    'avatar-lg': 'rounded-full w-16 h-16',
    card: 'rounded-xl h-32',
    'stat-card': 'rounded-xl h-24',
    table: 'rounded h-4',
    badge: 'rounded-full h-5 w-16',
    image: 'rounded-lg h-48 w-full',
    button: 'rounded-lg h-10 w-24',
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`skeleton ${variants[variant] || variants.text}`}
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
};

// Dashboard-specific skeleton layouts
export const DashboardSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    {/* Welcome banner skeleton */}
    <div className="skeleton rounded-xl h-32" />

    {/* Stats grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-card p-6 flex items-center justify-between">
          <div className="space-y-2">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-7 w-12 rounded" />
          </div>
          <div className="skeleton rounded-lg w-12 h-12" />
        </div>
      ))}
    </div>

    {/* Content grid */}
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 skeleton-card p-6">
        <div className="flex justify-between mb-4">
          <div className="skeleton h-5 w-32 rounded" />
          <div className="skeleton h-4 w-16 rounded" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-gray-100 space-y-2">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="flex gap-2">
                <div className="skeleton badge" />
                <div className="skeleton badge" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="skeleton-card p-6">
        <div className="skeleton h-5 w-28 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg bg-gray-50 space-y-2">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const AdminDashboardSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <div className="skeleton h-7 w-40 rounded mb-2" />
      <div className="skeleton h-4 w-56 rounded" />
    </div>

    <div className="grid md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-card p-4 flex items-center gap-4">
          <div className="skeleton rounded-lg w-12 h-12" />
          <div className="space-y-2">
            <div className="skeleton h-6 w-10 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>

    <div className="grid md:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="skeleton rounded-lg w-8 h-8" />
            <div className="skeleton h-4 w-28 rounded" />
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex justify-between">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-3 w-8 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const MentorDashboardSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <div className="skeleton h-7 w-36 rounded mb-2" />
      <div className="skeleton h-4 w-64 rounded" />
    </div>

    <div className="grid md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-card p-4 flex items-center gap-4">
          <div className="skeleton rounded-lg w-12 h-12" />
          <div className="space-y-2">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-6 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="skeleton-card p-6">
          <div className="flex justify-between mb-4">
            <div className="skeleton h-5 w-32 rounded" />
            <div className="skeleton h-4 w-16 rounded" />
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="p-3 rounded-lg border border-gray-100 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="skeleton h-4 w-24 rounded" />
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
                <div className="skeleton badge" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-3 animate-fade-in">
    <div className="flex gap-4 p-4 bg-gray-50 rounded-t-lg">
      {[...Array(cols)].map((_, i) => (
        <div key={i} className="skeleton h-4 flex-1 rounded" />
      ))}
    </div>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="flex gap-4 p-4 border-b border-gray-100">
        {[...Array(cols)].map((_, j) => (
          <div key={j} className="skeleton h-4 flex-1 rounded" style={{ animationDelay: `${(i * cols + j) * 50}ms` }} />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = ({ count = 3 }) => (
  <div className="grid md:grid-cols-3 gap-4 animate-fade-in">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="skeleton-card p-6 space-y-3">
        <div className="skeleton h-5 w-2/3 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="flex gap-2 pt-2">
          <div className="skeleton badge" />
          <div className="skeleton badge" />
        </div>
      </div>
    ))}
  </div>
);

export default Skeleton;
