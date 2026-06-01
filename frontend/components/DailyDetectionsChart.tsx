'use client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function DailyDetectionsChart({ data }: { data: any }) {
  if (!data) return <div>Loading chart...</div>;
  const chartData = {
    labels: data.map((d: any) => d.date),
    datasets: [{
      label: 'Potholes Detected',
      data: data.map((d: any) => d.count),
      borderColor: '#3b82f6',
      backgroundColor: '#3b82f6',
      tension: 0.3,
    }],
  };
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-2">Daily Detections (last 30 days)</h2>
      <Line data={chartData} />
    </div>
  );
}