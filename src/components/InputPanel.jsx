import { useState } from 'react';
import { fmtUSD } from '../engine/format';
import Tooltip from './Tooltip';

function SliderInput({ label, tooltip, value, onChange, min, max, step = 1 }) {
  return (
    <div className="input-group">
      <label>
        <Tooltip text={tooltip}>{label}</Tooltip>
      </label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
      />
      <input
        type="range"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

function PresetGroup({ label, tooltip, value, onChange, presets }) {
  return (
    <div className="input-group">
      <label>
        <Tooltip text={tooltip}>{label}</Tooltip>
      </label>
      <div className="preset-buttons">
        {presets.map(p => (
          <button
            key={p.value}
            className={`preset-btn ${value === p.value ? 'active' : ''}`}
            onClick={() => onChange(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function InputPanel({ inputs, onChange, portfolioValue }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const update = (key, val) => onChange(prev => ({ ...prev, [key]: val }));

  return (
    <div>
      {/* Essential inputs */}
      <SliderInput
        label="BTC Holdings"
        tooltip="How much Bitcoin do you own? Enter your total BTC amount."
        value={inputs.btc}
        onChange={v => update('btc', v)}
        min={0.01} max={100} step={0.01}
      />

      <SliderInput
        label="Monthly Expenses"
        tooltip="How much money do you need per month to cover all living costs?"
        value={inputs.expenses}
        onChange={v => update('expenses', v)}
        min={500} max={50000} step={100}
      />

      <PresetGroup
        label="BTC Growth Rate"
        tooltip="How fast do you expect Bitcoin's price to grow per year? Power Law uses the mathematical floor model (~22% avg, declining over time). Conservative is safest fixed rate."
        value={inputs.growthRate}
        onChange={v => update('growthRate', v)}
        presets={[
          { label: 'Power Law', value: 'powerlaw' },
          { label: '20%', value: 20 },
          { label: '40%', value: 40 },
          { label: '80%', value: 80 },
        ]}
      />

      <PresetGroup
        label="Time Horizon"
        tooltip="How many years into the future should we simulate? Pick the number of years you want your Bitcoin to last."
        value={inputs.years}
        onChange={v => update('years', v)}
        presets={[
          { label: '10 years', value: 10 },
          { label: '20 years', value: 20 },
          { label: '30 years', value: 30 },
          { label: '40 years', value: 40 },
        ]}
      />

      {/* Portfolio value */}
      <div className="derived-stats">
        <Tooltip text="Your total Bitcoin holdings multiplied by the current BTC price.">
          <div className="derived-stat">
            <span className="label">Portfolio Value</span>
            <span className="value">{fmtUSD(portfolioValue)}</span>
          </div>
        </Tooltip>
      </div>

      {/* Advanced toggle */}
      <button
        className="advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
      </button>

      {showAdvanced && (
        <div className="advanced-section">
          <SliderInput
            label="BTC Price (USD)"
            tooltip="Current Bitcoin price. Auto-fetched from the market. Override if you want to test a specific price."
            value={inputs.btcPrice}
            onChange={v => update('btcPrice', v)}
            min={1000} max={10000000} step={1000}
          />

          <PresetGroup
            label="Inflation Rate"
            tooltip="How fast do everyday prices rise each year? This increases your monthly expenses over time."
            value={inputs.inflation}
            onChange={v => update('inflation', v)}
            presets={[
              { label: '2%', value: 2 },
              { label: '5%', value: 5 },
              { label: '10%', value: 10 },
            ]}
          />

          <SliderInput
            label="Loan Interest Rate (APR)"
            tooltip="The yearly interest rate on a Bitcoin-backed loan (BLOC strategy). Typical rates are 8-15%."
            value={inputs.apr}
            onChange={v => update('apr', v)}
            min={1} max={30} step={0.5}
          />

          <SliderInput
            label="Target LTV %"
            tooltip="Loan-to-Value ratio: how much of your Bitcoin's value you borrow against. Lower is safer. Above 85% triggers liquidation."
            value={inputs.targetLTV}
            onChange={v => update('targetLTV', v)}
            min={10} max={80} step={5}
          />

          <SliderInput
            label="Hybrid Switch Price"
            tooltip="In the Hybrid strategy, you sell BTC until the price reaches this level, then switch to borrowing against it."
            value={inputs.switchPrice}
            onChange={v => update('switchPrice', v)}
            min={50000} max={5000000} step={10000}
          />

          <SliderInput
            label="Start Drawing at Month"
            tooltip="Delay withdrawals by this many months. Useful if you have other income for a while before you start spending your Bitcoin."
            value={inputs.drawStartMonth}
            onChange={v => update('drawStartMonth', v)}
            min={0} max={inputs.years * 12} step={1}
          />
        </div>
      )}
    </div>
  );
}
