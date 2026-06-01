export default function SummaryCards({ data }: { data: any }) {
  if (!data) return <div>Loading...</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white shadow rounded-lg p-4">
        <p className="text-gray-500">Total Potholes</p>
        <p className="text-2xl font-bold">{data.total_potholes}</p>
      </div>
      <div className="bg-white shadow rounded-lg p-4">
        <p className="text-gray-500">Critical</p>
        <p className="text-2xl font-bold text-red-600">{data.critical_count}</p>
      </div>
      <div className="bg-white shadow rounded-lg p-4">
        <p className="text-gray-500">Repair Rate</p>
        <p className="text-2xl font-bold text-green-600">{data.repair_rate * 100}%</p>
      </div>
      <div className="bg-white shadow rounded-lg p-4">
        <p className="text-gray-500">Detection Trend</p>
        <p className="text-2xl font-bold text-blue-600">+8%</p>
      </div>
    </div>
  );
}