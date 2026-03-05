// Module 2 — Simulation Engine (Pure JS functions)

// Bitcoin Power Law — support (bottom) line
// Model: log10(price) = slope * log10(days_since_genesis) + intercept
// Genesis block: January 3, 2009
const GENESIS_MS = new Date('2009-01-03').getTime();
const PL_SLOPE = 5.82;
const PL_INTERCEPT = -17.39; // bottom support line (~0.4x fair value)
const NOW_MS = Date.now();

export function powerLawPrice(date) {
  const days = (date.getTime() - GENESIS_MS) / 86400000;
  if (days <= 0) return 0;
  return Math.pow(10, PL_SLOPE * Math.log10(days) + PL_INTERCEPT);
}

// Price at month m: either fixed growth or power law curve
function priceAtMonth(m, startPrice, growthRate) {
  if (growthRate === 'powerlaw') {
    const futureDate = new Date(NOW_MS + m * 30.44 * 86400000);
    return powerLawPrice(futureDate);
  }
  const monthlyGrowth = Math.pow(1 + growthRate / 100, 1 / 12);
  return startPrice * Math.pow(monthlyGrowth, m);
}

export function simulateSellToLive(config) {
  const { btc, btcPrice, expenses, growthRate, inflation, years, drawStartMonth = 0 } = config;
  const months = years * 12;
  const monthlyInflation = Math.pow(1 + inflation / 100, 1 / 12);

  const data = [];
  let currentBTC = btc;
  let currentExpenses = expenses;
  let depletedMonth = null;

  for (let m = 0; m <= months; m++) {
    const currentPrice = priceAtMonth(m, btcPrice, growthRate);
    const portfolioValue = currentBTC * currentPrice;
    data.push({
      month: m,
      year: m / 12,
      btcHeld: currentBTC,
      btcPrice: currentPrice,
      portfolioValue,
      expenses: currentExpenses,
      btcSold: 0,
      locBalance: 0,
      ltv: 0,
      strategy: 'sellToLive',
    });

    if (m === months) break;

    if (m >= drawStartMonth) {
      if (currentBTC <= 0) {
        if (!depletedMonth) depletedMonth = m;
        currentBTC = 0;
      } else {
        const btcNeeded = currentExpenses / currentPrice;
        const sold = Math.min(btcNeeded, currentBTC);
        data[data.length - 1].btcSold = sold;
        currentBTC -= sold;
        if (currentBTC <= 1e-10) {
          currentBTC = 0;
          if (!depletedMonth) depletedMonth = m + 1;
        }
      }
    }

    currentExpenses *= monthlyInflation;
  }

  return {
    data,
    depletedMonth,
    finalBTC: currentBTC,
    finalValue: currentBTC * data[data.length - 1].btcPrice,
    totalSold: data.reduce((s, d) => s + d.btcSold, 0),
  };
}

export function simulateBLOC(config) {
  const { btc, btcPrice, expenses, growthRate, inflation, apr, targetLTV, years, drawStartMonth = 0 } = config;
  const months = years * 12;
  const monthlyInflation = Math.pow(1 + inflation / 100, 1 / 12);
  const monthlyRate = apr / 100 / 12;
  const maxLTV = 0.85;
  const targetRatio = targetLTV / 100;

  const data = [];
  let currentBTC = btc;
  let currentExpenses = expenses;
  let locBalance = 0;
  let totalInterest = 0;
  let liquidatedMonth = null;
  let marginCallMonths = [];

  for (let m = 0; m <= months; m++) {
    const currentPrice = priceAtMonth(m, btcPrice, growthRate);
    const collateralValue = currentBTC * currentPrice;
    const ltv = collateralValue > 0 ? locBalance / collateralValue : 0;
    const borrowLimit = collateralValue * targetRatio;
    const borrowRemaining = Math.max(0, borrowLimit - locBalance);
    const monthlyInterest = locBalance * monthlyRate;

    data.push({
      month: m,
      year: m / 12,
      btcHeld: currentBTC,
      btcPrice: currentPrice,
      portfolioValue: collateralValue - locBalance,
      expenses: currentExpenses,
      monthlyInterest,
      borrowLimit,
      borrowRemaining,
      btcSold: 0,
      locBalance,
      ltv,
      totalInterest,
      strategy: 'bloc',
    });

    if (m === months) break;

    if (liquidatedMonth) {
      // After liquidation: collateral sold, everything gone
      currentBTC = 0;
      locBalance = 0;
      currentExpenses *= monthlyInflation;
      continue;
    }

    // Interest accrues regardless
    locBalance += monthlyInterest;
    totalInterest += monthlyInterest;

    // Try to draw expenses
    if (m >= drawStartMonth) {
      const newBalance = locBalance + currentExpenses;
      const newLTV = collateralValue > 0 ? newBalance / collateralValue : Infinity;

      if (newLTV >= maxLTV) {
        liquidatedMonth = m + 1;
        currentBTC = 0;
        locBalance = 0;
      } else {
        locBalance = newBalance;
      }
    }

    // Check LTV after all changes
    if (!liquidatedMonth) {
      const currentLTV = collateralValue > 0 ? locBalance / collateralValue : Infinity;
      if (currentLTV >= maxLTV) {
        liquidatedMonth = m + 1;
        currentBTC = 0;
        locBalance = 0;
      } else if (currentLTV >= 0.65) {
        marginCallMonths.push(m + 1);
      }
    }

    currentExpenses *= monthlyInflation;
  }

  const finalData = data[data.length - 1];
  return {
    data,
    liquidatedMonth,
    totalInterest,
    finalLTV: finalData.ltv,
    finalBTC: currentBTC,
    finalValue: finalData.portfolioValue,
    marginCallMonths,
  };
}

export function simulateHybrid(config) {
  const { btc, btcPrice, expenses, growthRate, inflation, apr, targetLTV, years, switchPrice, drawStartMonth = 0 } = config;
  const months = years * 12;
  const monthlyInflation = Math.pow(1 + inflation / 100, 1 / 12);
  const monthlyRate = apr / 100 / 12;
  const maxLTV = 0.85;
  const threshold = switchPrice || 200000;

  const data = [];
  let currentBTC = btc;
  let currentExpenses = expenses;
  let locBalance = 0;
  let totalInterest = 0;
  let switchMonth = null;
  let depletedMonth = null;
  let liquidatedMonth = null;
  let usingBLOC = false;

  for (let m = 0; m <= months; m++) {
    const currentPrice = priceAtMonth(m, btcPrice, growthRate);
    const collateralValue = currentBTC * currentPrice;
    const ltv = usingBLOC && collateralValue > 0 ? locBalance / collateralValue : 0;

    data.push({
      month: m,
      year: m / 12,
      btcHeld: currentBTC,
      btcPrice: currentPrice,
      portfolioValue: currentBTC * currentPrice - locBalance,
      expenses: currentExpenses,
      monthlyInterest: usingBLOC ? locBalance * monthlyRate : 0,
      btcSold: 0,
      locBalance,
      ltv,
      totalInterest,
      strategy: usingBLOC ? 'bloc' : 'sellToLive',
      isSwitchPoint: false,
    });

    if (m === months) break;

    if (depletedMonth || liquidatedMonth) {
      // After depletion/liquidation: nothing left
      currentBTC = 0;
      locBalance = 0;
      currentExpenses *= monthlyInflation;
      continue;
    }

    if (!usingBLOC && currentPrice >= threshold) {
      usingBLOC = true;
      switchMonth = m;
      data[data.length - 1].isSwitchPoint = true;
    }

    if (m < drawStartMonth) {
      if (usingBLOC) {
        const interest = locBalance * monthlyRate;
        locBalance += interest;
        totalInterest += interest;
      }
    } else if (usingBLOC) {
      const interest = locBalance * monthlyRate;
      locBalance += interest;
      totalInterest += interest;

      const newBalance = locBalance + currentExpenses;
      const newLTV = collateralValue > 0 ? newBalance / collateralValue : Infinity;

      if (newLTV >= maxLTV) {
        liquidatedMonth = m + 1;
        currentBTC = 0;
        locBalance = 0;
      } else {
        locBalance = newBalance;
      }

      if (!liquidatedMonth) {
        const currentLTV = collateralValue > 0 ? locBalance / collateralValue : Infinity;
        if (currentLTV >= maxLTV) {
          liquidatedMonth = m + 1;
          currentBTC = 0;
          locBalance = 0;
        }
      }
    } else {
      if (currentBTC <= 0) {
        if (!depletedMonth) depletedMonth = m;
      } else {
        const btcNeeded = currentExpenses / currentPrice;
        const sold = Math.min(btcNeeded, currentBTC);
        data[data.length - 1].btcSold = sold;
        currentBTC -= sold;
        if (currentBTC <= 1e-10) {
          currentBTC = 0;
          if (!depletedMonth) depletedMonth = m + 1;
        }
      }
    }

    currentExpenses *= monthlyInflation;
  }

  const finalData = data[data.length - 1];
  return {
    data,
    switchMonth,
    depletedMonth,
    liquidatedMonth,
    totalInterest,
    finalBTC: currentBTC,
    finalValue: finalData.portfolioValue,
  };
}

// Safe expenses calculator — binary search for max monthly expenses
// where BLOC never exceeds safetyLTV (default 65%, margin call threshold)
export function calculateSafeExpenses(config) {
  const { btc, btcPrice, growthRate, inflation, apr, targetLTV, years, drawStartMonth = 0 } = config;
  const months = years * 12;
  const monthlyInflation = Math.pow(1 + inflation / 100, 1 / 12);
  const monthlyRate = apr / 100 / 12;
  const safetyLTV = 0.65;

  function peakLTV(expenses) {
    let locBalance = 0;
    let currentExpenses = expenses;
    let maxLTV = 0;
    for (let m = 0; m <= months; m++) {
      const price = priceAtMonth(m, btcPrice, growthRate);
      const collateral = btc * price;
      const ltv = collateral > 0 ? locBalance / collateral : 0;
      if (ltv > maxLTV) maxLTV = ltv;
      if (m === months) break;
      locBalance += locBalance * monthlyRate;
      if (m >= drawStartMonth) {
        locBalance += currentExpenses;
      }
      currentExpenses *= monthlyInflation;
    }
    return maxLTV;
  }

  let lo = 0;
  let hi = 200000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (peakLTV(mid) < safetyLTV) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return Math.floor(lo);
}

// Module 7 — Withdrawal rate calculator
export function calculateWithdrawalRates(config) {
  const { btc, btcPrice, expenses, growthRate } = config;
  const portfolioValue = btc * btcPrice;
  const annualExpenses = expenses * 12;
  const currentRate = portfolioValue > 0 ? (annualExpenses / portfolioValue) * 100 : 0;
  const traditional4Pct = portfolioValue * 0.04;

  const breakEvenGrowth = currentRate;

  const scenarios = [
    { label: 'Conservative (20%)', growth: 20, safe: portfolioValue * 0.15 },
    { label: 'Moderate (40%)', growth: 40, safe: portfolioValue * 0.30 },
    { label: 'Historical (80%)', growth: 80, safe: portfolioValue * 0.50 },
  ];

  return {
    currentRate,
    annualExpenses,
    portfolioValue,
    traditional4Pct,
    breakEvenGrowth,
    scenarios,
  };
}
