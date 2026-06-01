'use client';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
ChartJS.register(ArcElement, Tooltip, Legend);

export default function SeverityPieChart({ data }: { data: any }) {
  if (!data) return <div>Loading chart...</div>;
  const chartData = {
    labels: Object.keys(data),
    datasets: [{
      data: Object.values(data),
      backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'],
    }],
  };
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-2">Severity Distribution</h2>
      <Pie data={chartData} />
    </div>
  );
}