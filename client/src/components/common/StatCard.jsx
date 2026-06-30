export default function StatCard({ label, value, color, iconBg, icon, accent }) {
  return (
    <div className="card w-full p-3 sm:p-4 flex items-center gap-3 group hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 ${accent}`} />
      <div className={`stat-icon-box ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-2xl sm:text-3xl font-bold tracking-tight leading-none ${color}`}>{value}</p>
        <p className="text-sm sm:text-base text-gray-500 font-semibold mt-1 leading-snug">{label}</p>
      </div>
    </div>
  );
}
