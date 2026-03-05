import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useState, useMemo } from 'react';
import { fmtUSD, fmtChartAxis } from '../engine/format';
import TooltipWrap from './Tooltip';

const LINES = [
  { key: 'sell', dataKey: 'sell', label: 'Sell to Live', color: '#fc8181' },
  { key: 'bloc', dataKey: 'bloc', label: 'BLOC', color: '#4299e1' },
  { key: 'hybrid', dataKey: 'hybrid', label: 'Hybrid', color: '#48bb78' },
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: '#1a1f2e', border: '1px solid #2d3748', borderRadius: 8, padding: 12, fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Year {d.year.toFixed(1)}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, padding: '2px 0' }}>
          {p.name}: {fmtUSD(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function NetWorthChart({ simResults, inflationAdjusted, onToggleInflation, inflation, hybridSwitchYear }) {
  const [visible, setVisible] = useState({ sell: true, bloc: true, hybrid: true });

  const toggle = (key) => setVisible(prev => ({ ...prev, [key]: !prev[key] }));

  const chartData = useMemo(() => {
    const months = simResults.sellToLive.data.length;
    const result = [];
    for (let i = 0; i < months; i += 3) {
      const deflator = inflationAdjusted
        ? Math.pow(1 + inflation / 100, -(i / 12))
        : 1;
      result.push({
        year: i / 12,
        sell: (simResults.sellToLive.data[i]?.portfolioValue || 0) * deflator,
        bloc: (simResults.bloc.data[i]?.portfolioValue || 0) * deflator,
        hybrid: (simResults.hybrid.data[i]?.portfolioValue || 0) * deflator,
      });
    }
    return result;
  }, [simResults, inflationAdjusted, inflation]);

  return (
    <div className="card chart-section">
      <div className="chart-header">
        <TooltipWrap text="This chart shows how your total portfolio value changes over time for each strategy. Toggle strategies on/off with the buttons below.">
          <span className="section-title" style={{ marginBottom: 0 }}>Portfolio Over Time</span>
        </TooltipWrap>
        <button
          className={`toggle-btn ${inflationAdjusted ? 'active' : ''}`}
          onClick={onToggleInflation}
        >
          {inflationAdjusted ? 'Inflation-Adjusted' : 'Nominal'}
        </button>
      </div>

      <div className="chart-toggles">
        {LINES.map(l => (
          <button
            key={l.key}
            className={`chart-toggle-btn ${visible[l.key] ? 'active' : ''}`}
            style={{
              borderColor: visible[l.key] ? l.color : '#2d3748',
              color: visible[l.key] ? l.color : '#4a5568',
            }}
            onClick={() => toggle(l.key)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
          <XAxis dataKey="year" stroke="#718096" tickFormatter={v => `${Math.round(v)}y`} />
          <YAxis stroke="#718096" tickFormatter={fmtChartAxis} />
          <Tooltip content={<CustomTooltip />} />
          {visible.hybrid && hybridSwitchYear != null && (
            <ReferenceLine
              x={hybridSwitchYear}
              stroke="#48bb78"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{ value: 'Hybrid Switch', position: 'top', fill: '#48bb78', fontSize: 11 }}
            />
          )}
          {LINES.map(l => visible[l.key] && (
            <Area
              key={l.key}
              type="monotone"
              dataKey={l.dataKey}
              name={l.label}
              stroke={l.color}
              fill={l.color + '1a'}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
