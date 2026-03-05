import { useState, useMemo, useEffect } from 'react';
import InputPanel from './components/InputPanel';
import StrategyComparison from './components/StrategyComparison';
import NetWorthChart from './components/NetWorthChart';
import MonthlyPlaybook from './components/MonthlyPlaybook';
import {
  simulateSellToLive,
  simulateBLOC,
  simulateHybrid,
  calculateSafeExpenses,
  calculateMinBTC,
  calculateOptimalSwitchPrice,
} from './engine/simulate';
import './App.css';

const DEFAULT_INPUTS = {
  btc: 1,
  btcPrice: 90000,
  expenses: 3000,
  growthRate: 20,
  inflation: 5,
  apr: 13,
  targetLTV: 50,
  years: 30,
  switchPrice: 200000,
  drawStartMonth: 0,
};

export default function App() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inflationAdjusted, setInflationAdjusted] = useState(false);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
      .then(r => r.json())
      .then(data => {
        if (data?.bitcoin?.usd) {
          setInputs(prev => ({ ...prev, btcPrice: Math.round(data.bitcoin.usd) }));
        }
      })
      .catch(() => {});
  }, []);

  const simResults = useMemo(() => ({
    sellToLive: simulateSellToLive(inputs),
    bloc: simulateBLOC(inputs),
    hybrid: simulateHybrid(inputs),
  }), [inputs]);

  const safeExpenses = useMemo(() => calculateSafeExpenses(inputs), [inputs]);
  const minBTC = useMemo(() => calculateMinBTC(inputs), [inputs]);
  const optimalSwitchPrice = useMemo(() => calculateOptimalSwitchPrice(inputs), [inputs]);
  const portfolioValue = inputs.btc * inputs.btcPrice;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h1 className="sidebar-title">Bitcoin Retirement</h1>
        <p className="sidebar-subtitle">How long does your stack last?</p>
        <InputPanel inputs={inputs} onChange={setInputs} portfolioValue={portfolioValue} optimalSwitchPrice={optimalSwitchPrice} />
      </aside>

      <main className="main-content">
        <StrategyComparison simResults={simResults} years={inputs.years} safeExpenses={safeExpenses} currentExpenses={inputs.expenses} minBTC={minBTC} currentBTC={inputs.btc} />

        <NetWorthChart
          simResults={simResults}
          inflationAdjusted={inflationAdjusted}
          onToggleInflation={() => setInflationAdjusted(!inflationAdjusted)}
          inflation={inputs.inflation}
          hybridSwitchYear={simResults.hybrid.switchMonth != null ? simResults.hybrid.switchMonth / 12 : null}
        />

        <MonthlyPlaybook
          simResults={simResults}
          maxMonths={inputs.years * 12}
          startExpenses={inputs.expenses}
          drawStartMonth={inputs.drawStartMonth}
        />
      </main>
    </div>
  );
}
