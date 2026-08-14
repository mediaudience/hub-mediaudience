import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function kFormatter(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value;
}

function Legend({ series }) {
  return (
    <div className="flex items-center gap-6 mb-3">
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function Panel({ data, xKey, series, height, showXAxis }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid stroke="#EEF5F9" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={showXAxis ? { fontSize: 12, fill: "#768b9e" } : false}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis tick={{ fontSize: 12, fill: "#768b9e" }} tickFormatter={kFormatter} axisLine={false} />
        <Tooltip formatter={(value) => value.toLocaleString("es-EC")} />
        {series.map((s) =>
          s.type === "line" ? (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          ) : (
            <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} barSize={22} />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Series marked yAxisId: "right" are rendered as their own single-axis panel
// below the primary one, sharing the x categories, instead of a second y-scale
// on the same plot — a dual-axis chart implies a relationship between series
// that don't share a unit, which misleads more than it informs.
export default function ComboBarChart({ data, xKey, series, height = 320 }) {
  const primary = series.filter((s) => s.yAxisId !== "right");
  const secondary = series.filter((s) => s.yAxisId === "right");

  if (secondary.length === 0) {
    return (
      <div>
        <Legend series={series} />
        <Panel data={data} xKey={xKey} series={primary} height={height} showXAxis />
      </div>
    );
  }

  const primaryHeight = Math.round(height * 0.65);
  const secondaryHeight = height - primaryHeight;

  return (
    <div>
      <Legend series={series} />
      <Panel data={data} xKey={xKey} series={primary} height={primaryHeight} showXAxis={false} />
      <Panel data={data} xKey={xKey} series={secondary} height={secondaryHeight} showXAxis />
    </div>
  );
}
