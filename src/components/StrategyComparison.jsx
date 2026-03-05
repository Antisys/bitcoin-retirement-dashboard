import { fmtUSD, fmtBTC } from '../engine/format';
import Tooltip from './Tooltip';

const STRATEGIES = [
  {
    key: 'sellToLive',
    label: 'Sell to Live',
    color: '#fc8181',
    tooltip: 'Each month, you sell a small amount of Bitcoin to cover your expenses. Simple and straightforward — but your BTC shrinks over time.',
  },
  {
    key: 'bloc',
    label: 'BLOC',
    color: '#4299e1',
    tooltip: 'Bitcoin Line of Credit: borrow cash against your BTC instead of selling. All your BTC is locked as collateral. You pay interest on top of expenses. Risk: if BTC drops too much, liquidation.',
  },
  {
    key: 'hybrid',
    label: 'Hybrid',
    color: '#48bb78',
    tooltip: 'Start by selling BTC while the price is low, then switch to borrowing (BLOC) once BTC price is high enough. Balances both approaches.',
  },
];

function getBadge(result) {
  if (result.depletedMonth != null) return { label: 'Depleted', cls: 'badge-danger', tip: 'Your Bitcoin runs out before the end of your time horizon.' };
  if (result.liquidatedMonth != null) return { label: 'Liquidated', cls: 'badge-danger', tip: 'Your loan exceeds 85% of your collateral value. Your Bitcoin gets sold to repay the loan.' };
  if (result.marginCallMonths?.length > 0) return { label: 'Margin Call', cls: 'badge-warning', tip: 'Your loan is getting dangerously close to liquidation. You would need to add collateral or repay part of the loan.' };
  return { label: 'Safe', cls: 'badge-safe', tip: 'Your Bitcoin lasts through the entire time horizon. You\'re in good shape.' };
}

function getRunway(result, totalYears) {
  const months = result.depletedMonth || result.liquidatedMonth || totalYears * 12;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const isSafe = !result.depletedMonth && !result.liquidatedMonth;
  return { y, m, isSafe, months };
}

function getRecommendation(minBTC, currentBTC) {
  const { minSell, minBLOC, minHybrid } = minBTC;
  const allSafe = currentBTC >= minSell && currentBTC >= minBLOC;
  const sellSafe = currentBTC >= minSell;
  const blocSafe = currentBTC >= minBLOC;
  const hybridSafe = currentBTC >= minHybrid;

  if (blocSafe && allSafe) {
    return { text: 'BLOC recommended — keeps all your BTC, growth outpaces the loan', color: '#4299e1' };
  }
  if (hybridSafe) {
    return { text: 'Hybrid recommended — sell early, switch to BLOC once price rises', color: '#48bb78' };
  }
  if (sellSafe) {
    return { text: 'Sell to Live recommended — simplest and safest at your BTC level', color: '#fc8181' };
  }
  return { text: 'Not enough BTC for any safe strategy — consider reducing expenses or adding BTC', color: '#ecc94b' };
}

export default function StrategyComparison({ simResults, years, safeExpenses, currentExpenses, minBTC, currentBTC }) {
  const rec = getRecommendation(minBTC, currentBTC);

  return (
    <div>
      <h2 className="section-title">
        <Tooltip text="Each column shows a different strategy for living off your Bitcoin. Compare them to find the best fit for your situation.">
          How long does your Bitcoin last?
        </Tooltip>
      </h2>

      {/* Recommendation */}
      <div className="card" style={{ marginBottom: 12, padding: '12px 20px', borderLeft: `3px solid ${rec.color}` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: rec.color, marginBottom: 8 }}>
          {rec.text}
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: '#a0aec0' }}>
          <Tooltip text="Minimum BTC needed for Sell to Live to last your entire time horizon without running out.">
            <span>Sell to Live: <strong style={{ color: currentBTC >= minBTC.minSell ? '#48bb78' : '#fc8181' }}>{minBTC.minSell === Infinity ? '—' : fmtBTC(minBTC.minSell)}</strong> min</span>
          </Tooltip>
          <Tooltip text="Minimum BTC needed for BLOC to stay safe (no margin calls) over your entire time horizon.">
            <span>BLOC: <strong style={{ color: currentBTC >= minBTC.minBLOC ? '#48bb78' : '#fc8181' }}>{minBTC.minBLOC === Infinity ? '—' : fmtBTC(minBTC.minBLOC)}</strong> min</span>
          </Tooltip>
          <Tooltip text="Minimum BTC needed for Hybrid to last your entire time horizon without depletion or liquidation.">
            <span>Hybrid: <strong style={{ color: currentBTC >= minBTC.minHybrid ? '#48bb78' : '#fc8181' }}>{minBTC.minHybrid === Infinity ? '—' : fmtBTC(minBTC.minHybrid)}</strong> min</span>
          </Tooltip>
        </div>
      </div>

      {/* Safe BLOC expenses */}
      <Tooltip text="The maximum monthly expenses you can sustain with the BLOC strategy without ever hitting a margin call (LTV staying below 65%) over your entire time horizon. Accounts for inflation and interest accumulation.">
        <div className="card" style={{ marginBottom: 16, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid #48bb78' }}>
          <span style={{ color: '#a0aec0', fontSize: 13 }}>Safe BLOC Expenses (no margin call)</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: safeExpenses >= currentExpenses ? '#48bb78' : '#fc8181' }}>
            {fmtUSD(safeExpenses)}<span style={{ fontSize: 12, fontWeight: 400, color: '#718096' }}>/mo</span>
          </span>
        </div>
      </Tooltip>

      <div className="comparison-grid">
        {STRATEGIES.map(s => {
          const result = simResults[s.key];
          const badge = getBadge(result);
          const runway = getRunway(result, years);

          let colorClass = 'runway-green';
          if (runway.y < 10) colorClass = 'runway-red';
          else if (runway.y < 20) colorClass = 'runway-amber';

          return (
            <div key={s.key} className="comparison-card card" style={{ borderTop: `3px solid ${s.color}` }}>
              <div className="comparison-header">
                <Tooltip text={s.tooltip}>
                  <span className="comparison-label" style={{ color: s.color }}>{s.label}</span>
                </Tooltip>
              </div>

              <div className={`comparison-runway ${colorClass}`}>
                {runway.isSafe ? `${runway.y}+` : runway.y}
                <span className="comparison-runway-unit">
                  {runway.isSafe ? ' years' : `y ${runway.m}m`}
                </span>
              </div>

              <div className="comparison-stats">
                <Tooltip text="How much your total Bitcoin holdings will be worth at the end of the time horizon.">
                  <div className="comparison-stat">
                    <span className="label">Final Value</span>
                    <span className="value">{fmtUSD(result.finalValue || 0)}</span>
                  </div>
                </Tooltip>

                <Tooltip text="How much Bitcoin you still own at the end.">
                  <div className="comparison-stat">
                    <span className="label">BTC Left</span>
                    <span className="value">{fmtBTC(result.finalBTC)}</span>
                  </div>
                </Tooltip>

                {(s.key === 'bloc' || s.key === 'hybrid') && result.data && (() => {
                  const sampleMonth = Math.min(12, result.data.length - 1);
                  const mi = result.data[sampleMonth]?.monthlyInterest || 0;
                  return mi > 0 ? (
                    <Tooltip text="Monthly interest you pay on top of your living expenses at year 1. This grows as the loan balance increases.">
                      <div className="comparison-stat">
                        <span className="label">Interest/mo (yr 1)</span>
                        <span className="value" style={{ color: '#ecc94b' }}>+{fmtUSD(mi)}</span>
                      </div>
                    </Tooltip>
                  ) : null;
                })()}

                {s.key === 'bloc' && result.data?.[0] && (
                  <Tooltip text="Maximum you can borrow at the start. This is your BTC value times the Target LTV%. All your BTC is locked as collateral.">
                    <div className="comparison-stat">
                      <span className="label">Borrow Limit</span>
                      <span className="value">{fmtUSD(result.data[0].borrowLimit || 0)}</span>
                    </div>
                  </Tooltip>
                )}
              </div>

              <Tooltip text={badge.tip}>
                <span className={`badge ${badge.cls}`}>{badge.label}</span>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
