import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export default function TrendAndDistributionCharts({ analytics, pieData, colors }) {
  return (
    <section className="grid two">
      <div className="card chart">
        <div className="card-head">
          <h2 className="card-title">Daily Spending Trend</h2>
          <span className="pill">{analytics.count || 0} txns</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={analytics.dailyTrend || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="amount" stroke="#5b4cff" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card chart">
        <h2 className="card-title">Category Distribution</h2>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={90}>
              {pieData.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
