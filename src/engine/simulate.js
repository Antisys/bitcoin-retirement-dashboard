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

// Revolving Loan: borrow for a fixed term, sell BTC to repay, repeat
export function simulateRevolving(config) {
  const { btc, btcPrice, expenses, growthRate, inflation, apr, targetLTV, years, loanTermYears = 3, drawStartMonth = 0 } = config;
  const months = years * 12;
  const monthlyInflation = Math.pow(1 + inflation / 100, 1 / 12);
  const monthlyRate = apr / 100 / 12;
  const maxLTV = 0.85;
  const loanTermMonths = loanTermYears * 12;

  const data = [];
  let currentBTC = btc;
  let currentExpenses = expenses;
  let locBalance = 0;
  let totalInterest = 0;
  let totalBTCSold = 0;
  let depletedMonth = null;
  let liquidatedMonth = null;
  let loanStartMonth = 0; // when current loan cycle started
  let repaymentMonths = []; // months where loan was repaid

  for (let m = 0; m <= months; m++) {
    const currentPrice = priceAtMonth(m, btcPrice, growthRate);
    const collateralValue = currentBTC * currentPrice;
    const ltv = collateralValue > 0 ? locBalance / collateralValue : 0;
    const monthlyInterest = locBalance * monthlyRate;
    const monthsIntoLoan = m - loanStartMonth;

    data.push({
      month: m,
      year: m / 12,
      btcHeld: currentBTC,
      btcPrice: currentPrice,
      portfolioValue: currentBTC * currentPrice - locBalance,
      expenses: currentExpenses,
      monthlyInterest,
      btcSold: 0,
      locBalance,
      ltv,
      totalInterest,
      loanMonth: monthsIntoLoan,
      loanTermMonths,
      isRepayment: false,
      strategy: 'revolving',
    });

    if (m === months) break;

    if (depletedMonth || liquidatedMonth) {
      currentBTC = 0;
      locBalance = 0;
      currentExpenses *= monthlyInflation;
      continue;
    }

    // Interest accrues
    locBalance += monthlyInterest;
    totalInterest += monthlyInterest;

    // Draw expenses (add to loan) — check borrow limit first
    if (m >= drawStartMonth) {
      const newBalance = locBalance + currentExpenses;
      const newLTV = collateralValue > 0 ? newBalance / collateralValue : Infinity;

      if (newLTV >= maxLTV) {
        // Can't borrow more — liquidation
        liquidatedMonth = m + 1;
        currentBTC = 0;
        locBalance = 0;
        currentExpenses *= monthlyInflation;
        continue;
      }
      locBalance = newBalance;
    }

    // Check LTV after all changes
    if (!liquidatedMonth) {
      const currentLTV = collateralValue > 0 ? locBalance / collateralValue : Infinity;
      if (currentLTV >= maxLTV) {
        liquidatedMonth = m + 1;
        currentBTC = 0;
        locBalance = 0;
        currentExpenses *= monthlyInflation;
        continue;
      }
    }

    // Check if loan term is up — repay by selling BTC
    if (m >= drawStartMonth && monthsIntoLoan >= loanTermMonths && locBalance > 0) {
      const btcToSell = locBalance / currentPrice;
      if (btcToSell >= currentBTC) {
        // Can't repay — depleted
        data[data.length - 1].btcSold = currentBTC;
        totalBTCSold += currentBTC;
        currentBTC = 0;
        locBalance = 0;
        depletedMonth = m + 1;
      } else {
        data[data.length - 1].btcSold = btcToSell;
        data[data.length - 1].isRepayment = true;
        totalBTCSold += btcToSell;
        currentBTC -= btcToSell;
        locBalance = 0;
        loanStartMonth = m + 1;
        repaymentMonths.push(m);
      }
    }

    // Check LTV after all changes
    if (!depletedMonth && !liquidatedMonth) {
      const currentLTV = collateralValue > 0 ? locBalance / collateralValue : Infinity;
      if (currentLTV >= maxLTV) {
        liquidatedMonth = m + 1;
        currentBTC = 0;
        locBalance = 0;
      }
    }

    currentExpenses *= monthlyInflation;
  }

  const finalData = data[data.length - 1];
  return {
    data,
    depletedMonth,
    liquidatedMonth,
    totalInterest,
    totalBTCSold,
    repaymentMonths,
    loanTermYears,
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

// Strategy recommendation — find min BTC for each strategy to be safe
export function calculateMinBTC(config) {
  function isSellSafe(btcAmount) {
    const r = simulateSellToLive({ ...config, btc: btcAmount });
    return !r.depletedMonth;
  }

  function isBlocSafe(btcAmount) {
    const r = simulateBLOC({ ...config, btc: btcAmount });
    return !r.liquidatedMonth && (!r.marginCallMonths || r.marginCallMonths.length === 0);
  }

  function isRevolvingSafe(btcAmount) {
    const r = simulateRevolving({ ...config, btc: btcAmount });
    return !r.depletedMonth && !r.liquidatedMonth;
  }

  function search(testFn) {
    let lo = 0.01;
    let hi = 1000;
    // Quick check: if not safe even at 1000 BTC, return Infinity
    if (!testFn(hi)) return Infinity;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (testFn(mid)) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    return Math.ceil(hi * 100) / 100; // round up to 0.01
  }

  const minSell = search(isSellSafe);
  const minBLOC = search(isBlocSafe);
  const minRevolving = search(isRevolvingSafe);

  return { minSell, minBLOC, minRevolving };
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
