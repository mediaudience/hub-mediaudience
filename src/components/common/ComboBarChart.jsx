import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function kFormatter(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value;
}

export default function ComboBarChart({ data, xKey, series, height = 320 }) {
  const hasRight = series.some((s) => s.yAxisId === "right");

  return (
    <div>
      <div className="flex items-center gap-6 mb-3">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="#EEF5F9" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "#768b9e" }} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: "#768b9e" }}
            tickFormatter={kFormatter}
            axisLine={false}
          />
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "#768b9e" }}
              tickFormatter={kFormatter}
              axisLine={false}
            />
          )}
          <Tooltip formatter={(value) => value.toLocaleString("es-EC")} />
          {series.map((s) =>
            s.type === "line" ? (
              <Line
                key={s.key}
                yAxisId={s.yAxisId || "left"}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            ) : (
              <Bar
                key={s.key}
                yAxisId={s.yAxisId || "left"}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                barSize={22}
              />
            )
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
