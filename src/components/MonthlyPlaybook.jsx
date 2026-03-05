import { useState, useRef, useCallback } from 'react';
import { fmtUSD } from '../engine/format';
import Tooltip from './Tooltip';

const STRATEGIES = [
  { key: 'sellToLive', label: 'Sell to Live' },
  { key: 'bloc', label: 'BLOC' },
  { key: 'hybrid', label: 'Hybrid' },
];

export default function MonthlyPlaybook({ simResults, maxMonths, startExpenses, drawStartMonth }) {
  const [activeStrategy, setActiveStrategy] = useState('sellToLive');
  const [month, setMonth] = useState(0);

  const sectionRef = useRef(null);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setMonth(prev => Math.max(0, Math.min(maxMonths, prev + delta)));
  }, [maxMonths]);

  const result = simResults[activeStrategy];
  const d = result.data[month] || result.data[result.data.length - 1];

  const isBLOC = activeStrategy === 'bloc' || (activeStrategy === 'hybrid' && d.strategy === 'bloc');

  const drawStart = Number(drawStartMonth) || 0;

  let action, actionTip;
  if (month < drawStart) {
    const waitYears = Math.floor(drawStart / 12);
    const waitMonths = drawStart % 12;
    action = `Not drawing yet — starts at month ${drawStart} (${waitYears}y ${waitMonths}m)`;
    actionTip = 'You haven\'t started withdrawing from your Bitcoin yet. No selling or borrowing happens until the start month you configured.';
  } else if (isBLOC) {
    const mi = d.monthlyInterest || 0;
    action = `Add ${fmtUSD(d.expenses + mi)} to loan (${fmtUSD(d.expenses)} living + ${fmtUSD(mi)} interest)`;
    actionTip = `Your living expenses (${fmtUSD(d.expenses)}) plus loan interest (${fmtUSD(mi)}) get added to your loan balance this month.`;
  } else {
    action = d.btcSold > 0
      ? `Sell ${d.btcSold.toFixed(6)} BTC (${fmtUSD(d.expenses)}) to cover expenses`
      : 'No sale needed';
    actionTip = d.btcSold > 0
      ? 'This month you sell this amount of Bitcoin to cover your living expenses.'
      : 'No Bitcoin needs to be sold this month.';
  }

  const yearLabel = (month / 12).toFixed(1);

  return (
    <div className="card playbook-section" ref={sectionRef} onWheel={handleWheel}>
      <Tooltip text="Step through each month to see exactly what you would do: how much to sell or borrow, what the BTC price is, and what you have left.">
        <h2 className="section-title">Monthly Playbook</h2>
      </Tooltip>

      <div className="playbook-strategy-tabs">
        {STRATEGIES.map(s => (
          <button
            key={s.key}
            className={`strategy-tab ${activeStrategy === s.key ? 'active' : ''}`}
            onClick={() => setActiveStrategy(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Hybrid phase indicator */}
      {activeStrategy === 'hybrid' && (() => {
        const switchMonth = result.switchMonth;
        const phase = d.strategy === 'bloc' ? 'Borrowing (BLOC)' : 'Selling BTC';
        const phaseColor = d.strategy === 'bloc' ? '#4299e1' : '#fc8181';
        const switchYear = switchMonth != null ? (switchMonth / 12).toFixed(1) : null;
        const switchPrice = switchMonth != null ? result.data[switchMonth]?.btcPrice : null;
        return (
          <div style={{ margin: '12px 0', padding: '10px 16px', background: '#0f1118', borderRadius: 8, borderLeft: `3px solid ${phaseColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Tooltip text="Hybrid starts by selling BTC for expenses. Once BTC price hits the switch price, it stops selling and switches to borrowing against your BTC (BLOC).">
                <span style={{ fontSize: 13, color: '#a0aec0' }}>
                  Phase: <strong style={{ color: phaseColor }}>{phase}</strong>
                </span>
              </Tooltip>
              {switchMonth != null ? (
                <Tooltip text={`At month ${switchMonth} (year ${switchYear}), BTC hits ${fmtUSD(switchPrice)} and the strategy switches from selling to borrowing.`}>
                  <span style={{ fontSize: 12, color: '#718096' }}>
                    Switch at month {switchMonth} ({switchYear}y) — BTC {fmtUSD(switchPrice)}
                  </span>
                </Tooltip>
              ) : (
                <span style={{ fontSize: 12, color: '#718096' }}>
                  BTC never reaches switch price — selling entire horizon
                </span>
              )}
            </div>
            {/* Phase progress bar */}
            {switchMonth != null && (
              <div style={{ marginTop: 8, height: 6, background: '#2d3748', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${(switchMonth / maxMonths) * 100}%`,
                  background: '#fc8181', borderRadius: '3px 0 0 3px',
                }} />
                <div style={{
                  position: 'absolute', top: 0, height: '100%',
                  left: `${(switchMonth / maxMonths) * 100}%`,
                  right: 0,
                  background: '#4299e1', borderRadius: '0 3px 3px 0',
                }} />
                {/* Current position marker */}
                <div style={{
                  position: 'absolute', top: -3, height: 12, width: 3,
                  left: `${(month / maxMonths) * 100}%`,
                  background: '#f7931a', borderRadius: 2,
                }} />
              </div>
            )}
          </div>
        );
      })()}

      <div className="input-group" style={{ marginTop: 12 }}>
        <label>Month {month} — Year {yearLabel}</label>
        <input
          type="range"
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          min={0}
          max={maxMonths}
          step={1}
        />
      </div>

      <div className="playbook-display">
        <Tooltip text="The projected Bitcoin price at this point in the simulation.">
          <div className="playbook-item">
            <div className="value">{fmtUSD(d.btcPrice)}</div>
            <div className="label">BTC Price</div>
          </div>
        </Tooltip>
        <Tooltip text={`Your monthly expenses adjusted for inflation. Started at ${fmtUSD(startExpenses)}/mo.`}>
          <div className="playbook-item">
            <div className="value" style={{ color: d.expenses > startExpenses * 1.5 ? '#ecc94b' : '#f7931a' }}>
              {fmtUSD(d.expenses)}
            </div>
            <div className="label">Expenses/mo</div>
            {d.expenses > startExpenses && (
              <div style={{ fontSize: 10, color: '#718096' }}>
                +{((d.expenses / startExpenses - 1) * 100).toFixed(0)}% from inflation
              </div>
            )}
          </div>
        </Tooltip>
        <Tooltip text="How much Bitcoin you still own at this month.">
          <div className="playbook-item">
            <div className="value">{d.btcHeld.toFixed(4)}</div>
            <div className="label">BTC Held</div>
          </div>
        </Tooltip>
        <Tooltip text="Your total net worth: Bitcoin value minus any outstanding loans.">
          <div className="playbook-item">
            <div className="value">{fmtUSD(d.portfolioValue)}</div>
            <div className="label">Net Worth</div>
          </div>
        </Tooltip>
        {isBLOC && (
          <>
            <Tooltip text="How much you owe on your Bitcoin-backed loan. This grows with interest and expenses each month.">
              <div className="playbook-item">
                <div className="value">{fmtUSD(d.locBalance)}</div>
                <div className="label">Loan Balance</div>
              </div>
            </Tooltip>
            <Tooltip text="Loan-to-Value ratio: your loan divided by your Bitcoin collateral value. Above 65% is risky (margin call zone). At 85% your collateral gets liquidated.">
              <div className="playbook-item">
                <div className="value" style={{
                  color: d.ltv >= 0.85 ? '#fc8181' : d.ltv >= 0.65 ? '#ecc94b' : d.ltv >= 0.5 ? '#f6ad55' : '#48bb78'
                }}>
                  {(d.ltv * 100).toFixed(1)}%
                </div>
                <div className="label">LTV</div>
                {d.ltv >= 0.65 && (
                  <div style={{ fontSize: 10, color: '#fc8181' }}>
                    {d.ltv >= 0.85 ? 'LIQUIDATED' : 'Margin Call'}
                  </div>
                )}
              </div>
            </Tooltip>
          </>
        )}
      </div>

      <Tooltip text={actionTip}>
        <div className="playbook-action">
          <span style={{ color: '#f7931a', fontWeight: 600 }}>This month: </span>
          {action}
        </div>
      </Tooltip>
    </div>
  );
}
