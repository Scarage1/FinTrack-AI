import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function CategorySpendBarChart({ pieData }) {
  return (
    <div className="card chart">
      <h2 className="card-title">Category Spend Bars</h2>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={pieData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#7c4dff" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
