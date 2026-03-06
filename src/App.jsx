import { useState, useMemo, useCallback, useRef, createContext, useContext } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── i18n ────────────────────────────────────────────────
const T = {
  en: {
    title: "BITCOIN RETIREMENT — POWER LAW FLOOR MODEL",
    subtitle: (floor) => <>BTC price follows the <b style={{color:"#8b949e"}}>lower support band</b> of the Bitcoin Power Law · log₁₀(P) = 5.84 × log₁₀(days) − 17.53 · Today's floor ≈ <b style={{color:"#f0a500"}}>{floor}</b></>,
    params: "PARAMETERS",
    ffParams: "FIREFISH PARAMETERS",
    btcCollateral: "BTC held as collateral",
    monthlyExpenses: "Monthly living expenses",
    locRate: "LOC interest rate (APR)",
    inflation: "Inflation rate",
    retireIn: "Retire in",
    simHorizon: "Simulation horizon",
    ffApr: "Firefish loan APR",
    ffLoanTerm: "Loan term",
    months: "months",
    yrs: "yrs",
    tabLoc: "LINE OF CREDIT",
    tabFirefish: "FIREFISH",
    loc: "LINE OF CREDIT",
    locShort: "LOC",
    sellToLive: "SELL TO LIVE",
    sellComp: "SELL TO LIVE (comparison)",
    locComp: "LOC (comparison)",
    peakUtil: "Peak util.",
    finalDebt: "Final debt",
    netWorth: "Net worth",
    minBtcLocked: "Min. BTC locked",
    freeBtc: "Free BTC",
    btcHeld: "BTC Held",
    btcLeft: "BTC left",
    btcSold: "BTC sold",
    btcSoldLabel: "BTC Sold",
    debt: "Debt",
    result: "Result",
    shortfallYr: (yr) => `Shortfall yr ${yr}`,
    depletedYr: (yr) => `Depleted yr ${yr}`,
    sustained: "Sustained ✓",
    dangerousUtil: (pct) => `⚠ High risk — peak ${pct} utilization`,
    expensesAtEnd: "Expenses at end",
    creditVsBalance: "CREDIT LIMIT vs LOAN BALANCE",
    creditLimit: "Credit Limit",
    creditLimitLtv: "Credit Limit (50% LTV)",
    loanBalance: "Loan Balance",
    utilPct: "UTILIZATION %",
    nwLocVsSell: "NET WORTH — LOC vs SELL TO LIVE",
    lineOfCredit: "Line of Credit",
    annualSnapshot: "ANNUAL SNAPSHOT",
    year: "Year",
    btcFloor: "BTC Floor",
    moInterest: "Mo. Interest",
    util: "Util.",
    playbook: "MONTHLY PLAYBOOK",
    month: "Month",
    btcPrice: "BTC Price",
    outstanding: "Outstanding",
    activeLoans: "Active Loans",
    utilization: "Utilization",
    borrow: "Borrow",
    interest: "Interest",
    utilized: "utilized",
    canOnlyDraw: (draw, short) => `⚠ Can only draw ${draw} — shortfall ${short}`,
    canOnlyBorrow: (loan, short) => `⚠ Can only borrow ${loan} — shortfall ${short}`,
    btcDepleted: "⚠ BTC depleted",
    sell: "Sell",
    rollOver: "Roll",
    expenses: "expenses",
    newLoan: "New loan",
    debtFfVsLoc: "DEBT — FIREFISH vs LOC",
    ffDebt: "Firefish debt",
    locDebt: "LOC debt",
    utilFfVsLoc: "UTILIZATION % — FIREFISH vs LOC",
    marginCall: "Margin call (90%)",
    nwFfVsLocVsSell: "NET WORTH — FIREFISH vs LOC vs SELL",
    firefish: "FIREFISH",
    firefishShort: "Firefish",
    ffLoans: (term, rate) => `FIREFISH (${term}-MO LOANS @ ${rate}%)`,
    ffAnnual: (term, rate) => `ANNUAL SNAPSHOT — FIREFISH (${term}-MO @ ${rate}%)`,
    sellAnnual: "ANNUAL SNAPSHOT — SELL TO LIVE",
    btcHeldCol: "BTC Held",
    btcSoldMo: "BTC Sold/mo",
    // Chart tooltips
    ttYear: "Year",
    ttMonth: "Month",
    ttBtcFloor: "BTC floor",
    ttCreditLimit: "Credit limit",
    ttLoanBalance: "Loan balance",
    ttOutstanding: "Outstanding",
    ttActiveLoans: "Active loans",
    ttUtilization: "Utilization",
    ttShortfall: "Shortfall",
    ttLocBalance: "LOC balance",
    ttComparison: "comparison",
    ttRollingOver: "Rolling over",
    // Notes
    disclaimer: "This tool is for educational and illustrative purposes only. It does not constitute financial, investment, or tax advice. Consult a qualified financial advisor before making any decisions.",
    notesTitle: "MODEL NOTES",
    blocNotes: (btc, rate) => [
      `BTC price = lower power law band (floor, not median) — conservative estimate`,
      `${btc} BTC locked as collateral, credit limit = 50% of collateral value`,
      `Interest (${rate}% APR) compounds monthly into the loan balance`,
      `Monthly expenses grow with inflation — shown as "Expenses at end"`,
      `Credit limit expands as BTC price rises — lender honors appreciated collateral`,
      `Margin call threshold ~90% utilization — above 85% is high risk`,
      `BTC is never sold in LOC strategy`,
      `Uses the power law floor (worst case) — real prices are typically 2-3× higher`,
    ],
    ffNotes: (btc, ffRate, ffTerm) => [
      `Each month a new ${ffTerm}-month loan is taken for living expenses`,
      `When a loan matures, its repayment (principal + ${ffRate}% simple interest for ${ffTerm} months) is rolled into that month's new loan`,
      `This creates interest-on-interest at each rollover — debt grows in steps`,
      `Monthly expenses grow with inflation — shown as "Expenses at end"`,
      `${btc} BTC locked as collateral, credit limit = 50% of collateral value`,
      `LOC shown as dashed comparison — single rolling balance with compound monthly interest`,
      `Margin call threshold ~90% utilization`,
      `Uses the power law floor (worst case) — real prices are typically 2-3× higher`,
    ],
  },
  de: {
    title: "BITCOIN-RENTE — POWER-LAW-BODENMODELL",
    subtitle: (floor) => <>BTC-Preis folgt dem <b style={{color:"#8b949e"}}>unteren Stützband</b> des Bitcoin Power Law · log₁₀(P) = 5,84 × log₁₀(Tage) − 17,53 · Heutiger Boden ≈ <b style={{color:"#f0a500"}}>{floor}</b></>,
    params: "PARAMETER",
    ffParams: "FIREFISH-PARAMETER",
    btcCollateral: "BTC als Sicherheit",
    monthlyExpenses: "Monatliche Lebenshaltungskosten",
    locRate: "Kreditlinien-Zinssatz (jährl.)",
    inflation: "Inflationsrate",
    retireIn: "Rente in",
    simHorizon: "Simulationszeitraum",
    ffApr: "Firefish-Zinssatz (jährl.)",
    ffLoanTerm: "Kreditlaufzeit",
    months: "Monate",
    yrs: "Jahre",
    tabLoc: "KREDITLINIE",
    tabFirefish: "FIREFISH",
    loc: "KREDITLINIE",
    locShort: "Kreditlinie",
    sellToLive: "VERKAUFEN ZUM LEBEN",
    sellComp: "VERKAUFEN (Vergleich)",
    locComp: "Kreditlinie (Vergleich)",
    peakUtil: "Maximale Auslastung",
    finalDebt: "Endschuld",
    netWorth: "Nettovermögen",
    minBtcLocked: "Min. BTC gesperrt",
    freeBtc: "Freie BTC",
    btcHeld: "BTC gehalten",
    btcLeft: "BTC übrig",
    btcSold: "BTC verkauft",
    btcSoldLabel: "BTC verkauft",
    debt: "Schulden",
    result: "Ergebnis",
    shortfallYr: (yr) => `Unterdeckung ab Jahr ${yr}`,
    depletedYr: (yr) => `Aufgebraucht ab Jahr ${yr}`,
    sustained: "Nachhaltig ✓",
    dangerousUtil: (pct) => `⚠ Hohes Risiko — Spitze ${pct} Auslastung`,
    expensesAtEnd: "Ausgaben am Ende",
    creditVsBalance: "KREDITLIMIT vs KREDITSTAND",
    creditLimit: "Kreditlimit",
    creditLimitLtv: "Kreditlimit (50% Beleihungswert)",
    loanBalance: "Kreditstand",
    utilPct: "AUSLASTUNG %",
    nwLocVsSell: "NETTOVERMÖGEN — KREDITLINIE vs VERKAUFEN",
    lineOfCredit: "Kreditlinie",
    annualSnapshot: "JAHRESÜBERSICHT",
    year: "Jahr",
    btcFloor: "BTC-Boden",
    moInterest: "Zinsen/Monat",
    util: "Auslastung",
    playbook: "MONATLICHER FAHRPLAN",
    month: "Monat",
    btcPrice: "BTC-Preis",
    outstanding: "Ausstehend",
    activeLoans: "Aktive Kredite",
    utilization: "Auslastung",
    borrow: "Leihen",
    interest: "Zinsen",
    utilized: "ausgelastet",
    canOnlyDraw: (draw, short) => `⚠ Nur ${draw} möglich — Fehlbetrag ${short}`,
    canOnlyBorrow: (loan, short) => `⚠ Nur ${loan} möglich — Fehlbetrag ${short}`,
    btcDepleted: "⚠ BTC aufgebraucht",
    sell: "Verkaufen",
    rollOver: "Umschuldung",
    expenses: "Ausgaben",
    newLoan: "Neuer Kredit",
    debtFfVsLoc: "SCHULDEN — FIREFISH vs KREDITLINIE",
    ffDebt: "Firefish-Schulden",
    locDebt: "Kreditlinien-Schulden",
    utilFfVsLoc: "AUSLASTUNG % — FIREFISH vs KREDITLINIE",
    marginCall: "Nachschussforderung (90%)",
    nwFfVsLocVsSell: "NETTOVERMÖGEN — FIREFISH vs KREDITLINIE vs VERKAUFEN",
    firefish: "FIREFISH",
    firefishShort: "Firefish",
    ffLoans: (term, rate) => `FIREFISH (${term}-Monats-Kredite @ ${rate}%)`,
    ffAnnual: (term, rate) => `JAHRESÜBERSICHT — FIREFISH (${term} Monate @ ${rate}%)`,
    sellAnnual: "JAHRESÜBERSICHT — VERKAUFEN",
    btcHeldCol: "BTC gehalten",
    btcSoldMo: "BTC verkauft/Monat",
    ttYear: "Jahr",
    ttMonth: "Monat",
    ttBtcFloor: "BTC-Boden",
    ttCreditLimit: "Kreditlimit",
    ttLoanBalance: "Kreditstand",
    ttOutstanding: "Ausstehend",
    ttActiveLoans: "Aktive Kredite",
    ttUtilization: "Auslastung",
    ttShortfall: "Fehlbetrag",
    ttLocBalance: "Kreditlinien-Stand",
    ttComparison: "Vergleich",
    ttRollingOver: "Umschuldung",
    disclaimer: "Dieses Tool dient ausschließlich zu Bildungs- und Veranschaulichungszwecken. Es stellt keine Finanz-, Anlage- oder Steuerberatung dar. Bitte konsultieren Sie einen qualifizierten Finanzberater, bevor Sie Entscheidungen treffen.",
    notesTitle: "MODELLHINWEISE",
    blocNotes: (btc, rate) => [
      `BTC-Preis = unteres Power-Law-Band (Boden, nicht Median) — konservative Schätzung`,
      `${btc} BTC als Sicherheit hinterlegt, Kreditlimit = 50% des Sicherheitswerts (Beleihungswert)`,
      `Zinsen (${rate}% jährlich) werden monatlich auf den Kreditstand aufgeschlagen (Zinseszins)`,
      `Monatliche Ausgaben steigen mit der Inflation — angezeigt als „Ausgaben am Ende"`,
      `Kreditlimit steigt mit dem BTC-Preis — Kreditgeber akzeptiert Wertsteigerung der Sicherheit`,
      `Nachschussforderung (Margin Call) bei ~90% Auslastung — über 85% ist hohes Risiko`,
      `BTC wird in der Kreditlinien-Strategie nie verkauft`,
      `Verwendet den Power-Law-Boden (Worst Case) — reale Preise sind typischerweise 2-3× höher`,
    ],
    ffNotes: (btc, ffRate, ffTerm) => [
      `Jeden Monat wird ein neuer ${ffTerm}-Monats-Kredit für Lebenshaltungskosten aufgenommen`,
      `Bei Fälligkeit wird die Rückzahlung (Kapital + ${ffRate}% einfache Zinsen für ${ffTerm} Monate) in den neuen Kredit des Monats eingerollt`,
      `Dadurch entstehen Zinsen auf Zinsen bei jeder Umschuldung — Schulden wachsen stufenweise`,
      `Monatliche Ausgaben steigen mit der Inflation — angezeigt als „Ausgaben am Ende"`,
      `${btc} BTC als Sicherheit, Kreditlimit = 50% des Sicherheitswerts (Beleihungswert)`,
      `Kreditlinie als gestrichelter Vergleich — einzelner rollierender Saldo mit monatlichem Zinseszins`,
      `Nachschussforderung (Margin Call) bei ~90% Auslastung`,
      `Verwendet den Power-Law-Boden (Worst Case) — reale Preise sind typischerweise 2-3× höher`,
    ],
  },
};

const LangContext = createContext("en");
function useLang() { return useContext(LangContext); }
function useT() { return T[useLang()]; }

// ─── Simulation ──────────────────────────────────────────
const GENESIS_MS = new Date("2009-01-03").getTime();
const TODAY_MS   = new Date("2026-03-05").getTime();
const TODAY_DAYS = Math.floor((TODAY_MS - GENESIS_MS) / 86400000);

function powerLawPrice(days) {
  return Math.pow(10, 5.84 * Math.log10(days) - 17.53);
}

function simulateBLOC({ btc, monthlyFiat, annualRate, months, drawStartMonth = 0, inflationRate = 0 }) {
  const mr = annualRate / 12;
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12);
  let balance = 0;
  let currentExpenses = monthlyFiat;
  const rows = [];
  for (let m = 0; m <= months; m++) {
    const days    = TODAY_DAYS + m * 30.44;
    const price   = powerLawPrice(days);
    const limit   = btc * price * 0.5;
    const interest = balance * mr;
    const wantDraw = m >= drawStartMonth ? currentExpenses : 0;
    const headroom = limit - balance - interest;
    const draw     = Math.min(wantDraw, Math.max(0, headroom));
    const shortfall = wantDraw - draw;
    balance += interest + draw;
    const util    = limit > 0 ? balance / limit : 0;
    const netWorth = btc * price - balance;
    const minBtcLocked = price > 0 ? balance / (price * 0.5) : 0;
    rows.push({ m, yr: +(m / 12).toFixed(2), price, limit, balance, interest, draw, shortfall, util: +(util * 100).toFixed(1), headroom, netWorth, btcHeld: btc, minBtcLocked, expenses: currentExpenses });
    currentExpenses *= monthlyInflation;
  }
  return rows;
}

function simulateSell({ btc, monthlyFiat, months, drawStartMonth = 0, inflationRate = 0 }) {
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12);
  let held = btc;
  let currentExpenses = monthlyFiat;
  const rows = [];
  for (let m = 0; m <= months; m++) {
    const days  = TODAY_DAYS + m * 30.44;
    const price = powerLawPrice(days);
    const netWorth = held * price;
    const wantSell = m >= drawStartMonth;
    const btcNeeded = (held > 0 && wantSell) ? currentExpenses / price : 0;
    const sold = Math.min(btcNeeded, held);
    const shortfall = (wantSell && held <= 0) ? currentExpenses : 0;
    rows.push({ m, yr: +(m / 12).toFixed(2), price, btcHeld: held, sold, netWorth, shortfall, expenses: currentExpenses });
    if (m < months) {
      held -= sold;
      if (held < 1e-10) held = 0;
    }
    currentExpenses *= monthlyInflation;
  }
  return rows;
}

function simulateFirefish({ btc, monthlyFiat, annualRate, loanTermMonths, months, drawStartMonth = 0, inflationRate = 0 }) {
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12);
  let activeLoans = [];
  let currentExpenses = monthlyFiat;
  const rows = [];
  for (let m = 0; m <= months; m++) {
    const days  = TODAY_DAYS + m * 30.44;
    const price = powerLawPrice(days);
    const collateralValue = btc * price;
    const limit = collateralValue * 0.5;
    const totalOutstanding = activeLoans.reduce((sum, l) => {
      const elapsed = m - l.startMonth;
      return sum + l.principal + l.principal * annualRate * (elapsed / 12);
    }, 0);
    const util = limit > 0 ? totalOutstanding / limit : 0;
    const netWorth = collateralValue - totalOutstanding;
    const minBtcLocked = price > 0 ? totalOutstanding / (price * 0.5) : 0;
    const maturing = activeLoans.filter(l => l.maturityMonth === m);
    const maturingRepay = maturing.reduce((s, l) => s + l.repayAmount, 0);
    rows.push({
      m, yr: +(m / 12).toFixed(2), price, limit,
      totalOutstanding, util: +(util * 100).toFixed(1),
      netWorth, btcHeld: btc, minBtcLocked,
      maturingRepay, activeLoans: activeLoans.length,
      newLoan: 0, shortfall: 0, isRollover: maturing.length > 0,
      expenses: currentExpenses,
    });
    if (m === months) break;
    activeLoans = activeLoans.filter(l => l.maturityMonth !== m);
    if (m < drawStartMonth) {
      // Before retirement: no new loans, but maturing loans still get rolled if any exist
      if (maturingRepay > 0) {
        const rollPrincipal = maturingRepay;
        const rollRepay = rollPrincipal * (1 + annualRate * (loanTermMonths / 12));
        activeLoans.push({ startMonth: m, principal: rollPrincipal, maturityMonth: m + loanTermMonths, repayAmount: rollRepay });
        rows[rows.length - 1].newLoan = rollPrincipal;
        rows[rows.length - 1].isRollover = true;
      }
      currentExpenses *= monthlyInflation;
      continue;
    }
    const newPrincipal = currentExpenses + maturingRepay;
    const repayAmount = newPrincipal * (1 + annualRate * (loanTermMonths / 12));
    const newOutstanding = activeLoans.reduce((sum, l) => {
      const elapsed = m - l.startMonth;
      return sum + l.principal + l.principal * annualRate * (elapsed / 12);
    }, 0) + newPrincipal;
    const newUtil = limit > 0 ? newOutstanding / limit : Infinity;
    if (newUtil >= 1.0) {
      const available = Math.max(0, limit - activeLoans.reduce((sum, l) => {
        const elapsed = m - l.startMonth;
        return sum + l.principal + l.principal * annualRate * (elapsed / 12);
      }, 0));
      rows[rows.length - 1].shortfall = newPrincipal - available;
      rows[rows.length - 1].newLoan = available;
      if (available > 0) {
        activeLoans.push({ startMonth: m, principal: available, maturityMonth: m + loanTermMonths, repayAmount: available * (1 + annualRate * (loanTermMonths / 12)) });
      }
    } else {
      rows[rows.length - 1].newLoan = newPrincipal;
      activeLoans.push({ startMonth: m, principal: newPrincipal, maturityMonth: m + loanTermMonths, repayAmount });
    }
    currentExpenses *= monthlyInflation;
  }
  return rows;
}

// ─── Helpers ─────────────────────────────────────────────
const usd = (n) => n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");
const pct = (n) => n.toFixed(1) + "%";

function BlocTooltip({ active, payload }) {
  const t = useT();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:"#0d1117", border:"1px solid #30363d", borderRadius:8, padding:"12px 16px", fontSize:11, lineHeight:1.8, color:"#c9d1d9" }}>
      <div style={{ fontWeight:700, color:"#f0a500", marginBottom:4 }}>{t.ttYear} {d.yr}  ({t.ttMonth} {d.m})</div>
      <div>{t.ttBtcFloor}: <b style={{color:"#f0a500"}}>{usd(d.price)}</b></div>
      <div>{t.ttCreditLimit}: <b style={{color:"#58a6ff"}}>{usd(d.limit)}</b></div>
      <div>{t.ttLoanBalance}: <b style={{color:"#ff7b72"}}>{usd(d.balance)}</b></div>
      <div>{t.interest}: <b style={{color:"#ffa657"}}>{usd(d.interest)}</b></div>
      <div>{t.ttUtilization}: <b style={{color: d.util > 85 ? "#ff7b72" : "#3fb950"}}>{pct(d.util)}</b></div>
      <div>{t.minBtcLocked}: <b style={{color:"#ffa657"}}>{(d.minBtcLocked || 0).toFixed(2)} BTC</b></div>
      <div>{t.freeBtc}: <b style={{color:"#3fb950"}}>{Math.max(0, (d.btcHeld || 0) - (d.minBtcLocked || 0)).toFixed(2)} BTC</b></div>
      {d.shortfall > 0 && <div style={{color:"#ff7b72"}}>⚠ {t.ttShortfall}: {usd(d.shortfall)}</div>}
    </div>
  );
}

function FirefishTooltip({ active, payload }) {
  const t = useT();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:"#0d1117", border:"1px solid #30363d", borderRadius:8, padding:"12px 16px", fontSize:11, lineHeight:1.8, color:"#c9d1d9" }}>
      <div style={{ fontWeight:700, color:"#d2a8ff", marginBottom:4 }}>{t.ttYear} {d.yr}  ({t.ttMonth} {d.m})</div>
      <div>{t.ttBtcFloor}: <b style={{color:"#f0a500"}}>{usd(d.price)}</b></div>
      <div>{t.ttCreditLimit}: <b style={{color:"#d2a8ff"}}>{usd(d.limit)}</b></div>
      <div>{t.ttOutstanding}: <b style={{color:"#ff7b72"}}>{usd(d.totalOutstanding)}</b></div>
      <div>{t.ttActiveLoans}: <b style={{color:"#c9d1d9"}}>{d.activeLoans}</b></div>
      <div>{t.ttUtilization}: <b style={{color: d.util > 85 ? "#ff7b72" : "#3fb950"}}>{pct(d.util)}</b></div>
      <div>{t.minBtcLocked}: <b style={{color:"#ffa657"}}>{(d.minBtcLocked || 0).toFixed(2)} BTC</b></div>
      <div>{t.freeBtc}: <b style={{color:"#3fb950"}}>{Math.max(0, (d.btcHeld || 0) - (d.minBtcLocked || 0)).toFixed(2)} BTC</b></div>
      {d.blocBalance != null && <div>{t.ttLocBalance}: <b style={{color:"#58a6ff"}}>{usd(d.blocBalance)}</b> ({t.ttComparison})</div>}
      {d.isRollover && <div style={{color:"#d2a8ff"}}>↻ {t.ttRollingOver} {usd(d.maturingRepay)}</div>}
      {d.shortfall > 0 && <div style={{color:"#ff7b72"}}>⚠ {t.ttShortfall}: {usd(d.shortfall)}</div>}
    </div>
  );
}

function NetWorthTooltip({ active, payload }) {
  const t = useT();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:"#0d1117", border:"1px solid #30363d", borderRadius:8, padding:"12px 16px", fontSize:11, lineHeight:1.8, color:"#c9d1d9" }}>
      <div style={{ fontWeight:700, color:"#f0a500", marginBottom:4 }}>{t.ttYear} {d.yr}</div>
      {d.primary != null && <div>{d.primaryLabel}: <b style={{color:d.primaryColor}}>{usd(d.primary)}</b></div>}
      {d.blocNetWorth != null && <div>{t.locShort}: <b style={{color:"#58a6ff"}}>{usd(d.blocNetWorth)}</b></div>}
      {d.sellNetWorth != null && <div>{t.sellToLive}: <b style={{color:"#ff7b72"}}>{usd(d.sellNetWorth)}</b></div>}
    </div>
  );
}

function Ctrl({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:11, color:"#8b949e" }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:700, color:"#e6edf3", fontFamily:"monospace" }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width:"100%", accentColor:"#f0a500", cursor:"pointer" }} />
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
      <span style={{ color:"#6e7681" }}>{label}</span>
      <span style={{ fontWeight:700, color }}>{value}</span>
    </div>
  );
}

// ─── Playbook ────────────────────────────────────────────
function Playbook({ data, months, strategy, color }) {
  const t = useT();
  const [month, setMonth] = useState(0);
  const ref = useRef(null);
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setMonth(prev => Math.max(0, Math.min(months, prev + (e.deltaY > 0 ? 1 : -1))));
  }, [months]);
  const d = data[month] || data[data.length - 1];
  const yearLabel = (month / 12).toFixed(1);

  return (
    <div ref={ref} onWheel={handleWheel} style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
      <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:14 }}>{t.playbook}</div>
      <div style={{ marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
          <span style={{ fontSize:11, color:"#8b949e" }}>{t.month} {month} — {t.ttYear} {yearLabel}</span>
        </div>
        <input type="range" value={month} onChange={e => setMonth(Number(e.target.value))}
          min={0} max={months} step={1}
          style={{ width:"100%", accentColor:"#f0a500", cursor:"pointer" }} />
      </div>
      <div style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
        <div style={{ textAlign:"center", minWidth:100 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#f0a500" }}>{usd(d.price)}</div>
          <div style={{ fontSize:10, color:"#6e7681" }}>{t.btcPrice}</div>
        </div>
        <div style={{ textAlign:"center", minWidth:100 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#e6edf3" }}>{d.btcHeld.toFixed(4)}</div>
          <div style={{ fontSize:10, color:"#6e7681" }}>{t.btcHeld}</div>
        </div>
        <div style={{ textAlign:"center", minWidth:100 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#3fb950" }}>{usd(d.netWorth)}</div>
          <div style={{ fontSize:10, color:"#6e7681" }}>{t.netWorth}</div>
        </div>
        {strategy === "bloc" && (
          <>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#ff7b72" }}>{usd(d.balance)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.loanBalance}</div>
            </div>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color: d.util > 85 ? "#ff7b72" : d.util > 65 ? "#ffa657" : "#3fb950" }}>{pct(d.util)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.utilization}</div>
            </div>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#ffa657" }}>{(d.minBtcLocked || 0).toFixed(2)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.minBtcLocked}</div>
            </div>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#3fb950" }}>{Math.max(0, d.btcHeld - (d.minBtcLocked || 0)).toFixed(2)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.freeBtc}</div>
            </div>
          </>
        )}
        {strategy === "firefish" && (
          <>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#ff7b72" }}>{usd(d.totalOutstanding)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.outstanding}</div>
            </div>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#d2a8ff" }}>{d.activeLoans}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.activeLoans}</div>
            </div>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color: d.util > 85 ? "#ff7b72" : d.util > 65 ? "#ffa657" : "#3fb950" }}>{pct(d.util)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.utilization}</div>
            </div>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#ffa657" }}>{(d.minBtcLocked || 0).toFixed(2)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.minBtcLocked}</div>
            </div>
            <div style={{ textAlign:"center", minWidth:100 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#3fb950" }}>{Math.max(0, d.btcHeld - (d.minBtcLocked || 0)).toFixed(2)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>{t.freeBtc}</div>
            </div>
          </>
        )}
        {strategy === "sell" && d.sold > 0 && (
          <div style={{ textAlign:"center", minWidth:100 }}>
            <div style={{ fontSize:18, fontWeight:700, color:"#ff7b72" }}>{d.sold.toFixed(6)}</div>
            <div style={{ fontSize:10, color:"#6e7681" }}>{t.btcSoldLabel}</div>
          </div>
        )}
      </div>
      <div style={{ marginTop:14, padding:"10px 14px", background:"#0d1117", borderRadius:8, textAlign:"center", fontSize:13 }}>
        {strategy === "bloc" ? (
          d.shortfall > 0
            ? <span style={{ color:"#ff7b72" }}>{t.canOnlyDraw(usd(d.draw), usd(d.shortfall))}</span>
            : <span style={{ color }}>{t.borrow} {usd(d.draw)} · {t.interest} {usd(d.interest)} · {pct(d.util)} {t.utilized}</span>
        ) : strategy === "firefish" ? (
          d.shortfall > 0
            ? <span style={{ color:"#ff7b72" }}>{t.canOnlyBorrow(usd(d.newLoan), usd(d.shortfall))}</span>
            : d.isRollover
              ? <span style={{ color }}>↻ {t.rollOver} {usd(d.maturingRepay)} + {usd(Math.max(0, d.newLoan - d.maturingRepay))} {t.expenses} = {t.newLoan} {usd(d.newLoan)}</span>
              : <span style={{ color }}>{t.newLoan} {usd(d.newLoan)} · {d.activeLoans} {t.activeLoans.toLowerCase()}</span>
        ) : (
          d.btcHeld <= 0
            ? <span style={{ color:"#ff7b72" }}>{t.btcDepleted}</span>
            : <span style={{ color }}>{t.sell} {d.sold.toFixed(6)} BTC ({usd(d.sold * d.price)})</span>
        )}
      </div>
    </div>
  );
}

// ─── BLOC Tab ────────────────────────────────────────────
function BlocTab({ blocData, sellData, btc, horizon, rate }) {
  const t = useT();
  const last = blocData[blocData.length - 1];
  const peakUtil = Math.max(...blocData.map(d => d.util));
  const blocShortfall = blocData.find(d => d.shortfall > 0 && d.m > 0);
  const sellDepleted = sellData.find(d => d.btcHeld <= 0 && d.m > 0);
  const lastSell = sellData[sellData.length - 1];
  const chart3mo = blocData.filter(d => d.m % 3 === 0);
  const annual = blocData.filter(d => d.m % 12 === 0);

  const compareData = useMemo(() =>
    blocData.filter(d => d.m % 3 === 0).map(bd => {
      const sd = sellData[bd.m] || sellData[sellData.length - 1];
      return { yr: bd.yr, m: bd.m, price: bd.price, blocNetWorth: bd.netWorth, sellNetWorth: sd.netWorth, primary: bd.netWorth, primaryLabel: t.locShort, primaryColor: "#58a6ff" };
    }), [blocData, sellData, t]);

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"16px 20px", borderTop:"3px solid #58a6ff" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#58a6ff", letterSpacing:1, marginBottom:10 }}>{t.loc}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <StatRow label={t.peakUtil} value={pct(peakUtil)} color={peakUtil > 90 ? "#ff7b72" : peakUtil > 75 ? "#ffa657" : "#3fb950"} />
            <StatRow label={t.finalDebt} value={usd(last?.balance)} color="#ff7b72" />
            <StatRow label={t.netWorth} value={usd(last?.netWorth)} color="#3fb950" />
            <StatRow label={t.minBtcLocked} value={`${(last?.minBtcLocked || 0).toFixed(2)} BTC`} color="#ffa657" />
            <StatRow label={t.freeBtc} value={`${Math.max(0, btc - (last?.minBtcLocked || 0)).toFixed(2)} BTC`} color="#3fb950" />
            <StatRow label={t.expensesAtEnd} value={usd(last?.expenses)} color="#ffa657" />
            <StatRow label={t.result} value={blocShortfall ? t.shortfallYr((blocShortfall.m/12).toFixed(1)) : peakUtil > 85 ? t.dangerousUtil(pct(peakUtil)) : t.sustained} color={blocShortfall ? "#ff7b72" : peakUtil > 85 ? "#ffa657" : "#3fb950"} />
          </div>
        </div>
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"16px 20px", borderTop:"3px solid #ff7b72" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#ff7b72", letterSpacing:1, marginBottom:10 }}>{t.sellComp}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <StatRow label={t.btcLeft} value={lastSell.btcHeld.toFixed(4)} color="#f0a500" />
            <StatRow label={t.btcSold} value={(btc - lastSell.btcHeld).toFixed(4)} color="#ff7b72" />
            <StatRow label={t.netWorth} value={usd(lastSell.netWorth)} color="#3fb950" />
            <StatRow label={t.debt} value="$0" color="#6e7681" />
            <StatRow label={t.result} value={sellDepleted ? t.depletedYr((sellDepleted.m/12).toFixed(1)) : t.sustained} color={sellDepleted ? "#ff7b72" : "#3fb950"} />
          </div>
        </div>
      </div>

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>{t.creditVsBalance}</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chart3mo} margin={{top:4,right:8,bottom:4,left:8}}>
            <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#58a6ff" stopOpacity={0.12}/><stop offset="95%" stopColor="#58a6ff" stopOpacity={0.01}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
            <YAxis tickFormatter={v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:`${(v/1000).toFixed(0)}k`} tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={60} />
            <Tooltip content={<BlocTooltip />} />
            <Area type="monotone" dataKey="limit" stroke="#58a6ff" strokeWidth={2} fill="url(#lg)" name={t.creditLimit} dot={false} />
            <Line type="monotone" dataKey="balance" stroke="#ff7b72" strokeWidth={2.5} name={t.loanBalance} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:20, marginTop:10, fontSize:10, color:"#6e7681" }}>
          <span><span style={{color:"#58a6ff"}}>━━</span> {t.creditLimitLtv}</span>
          <span><span style={{color:"#ff7b72"}}>━━</span> {t.loanBalance}</span>
        </div>
      </div>

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>{t.utilPct}</div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={chart3mo} margin={{top:4,right:8,bottom:4,left:8}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
            <YAxis domain={[0,100]} tickFormatter={v=>v+"%"} tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={42} />
            <Tooltip content={<BlocTooltip />} />
            <ReferenceLine y={90} stroke="#ff7b72" strokeDasharray="4 3" />
            <Area type="monotone" dataKey="util" stroke="#ffa657" strokeWidth={2} fill="#ffa657" fillOpacity={0.1} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>{t.nwLocVsSell}</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={compareData} margin={{top:4,right:8,bottom:4,left:8}}>
            <defs><linearGradient id="lgBloc2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#58a6ff" stopOpacity={0.1}/><stop offset="95%" stopColor="#58a6ff" stopOpacity={0.01}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
            <YAxis tickFormatter={v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:`${(v/1000).toFixed(0)}k`} tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={60} />
            <Tooltip content={<NetWorthTooltip />} />
            <Area type="monotone" dataKey="blocNetWorth" stroke="#58a6ff" strokeWidth={2} fill="url(#lgBloc2)" name={t.locShort} dot={false} />
            <Line type="monotone" dataKey="sellNetWorth" stroke="#ff7b72" strokeWidth={1.5} strokeDasharray="5 3" name={t.sell} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:20, marginTop:10, fontSize:10, color:"#6e7681" }}>
          <span><span style={{color:"#58a6ff"}}>━━</span> {t.lineOfCredit}</span>
          <span><span style={{color:"#ff7b72"}}>- -</span> {t.sellToLive}</span>
        </div>
      </div>

      <Playbook data={blocData} months={horizon} strategy="bloc" color="#58a6ff" />

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16, overflowX:"auto" }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:14 }}>{t.annualSnapshot}</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead><tr style={{ borderBottom:"1px solid #30363d" }}>
            {[t.year, t.btcFloor, t.creditLimit, t.loanBalance, t.moInterest, t.util, t.minBtcLocked, t.freeBtc].map(h=>(<th key={h} style={{ padding:"5px 10px", textAlign:"right", color:"#6e7681", fontWeight:600 }}>{h}</th>))}
          </tr></thead>
          <tbody>{annual.map(d => (
            <tr key={d.m} style={{ borderBottom:"1px solid #0d1117" }}>
              <td style={{ padding:"6px 10px", color:"#f0a500", textAlign:"right", fontWeight:700 }}>{d.m/12}</td>
              <td style={{ padding:"6px 10px", color:"#c9d1d9", textAlign:"right" }}>{usd(d.price)}</td>
              <td style={{ padding:"6px 10px", color:"#58a6ff", textAlign:"right" }}>{usd(d.limit)}</td>
              <td style={{ padding:"6px 10px", color:"#ff7b72", textAlign:"right" }}>{usd(d.balance)}</td>
              <td style={{ padding:"6px 10px", color:"#ffa657", textAlign:"right" }}>{usd(d.interest)}</td>
              <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:700, color: d.util>90?"#ff7b72":d.util>75?"#ffa657":"#3fb950" }}>{pct(d.util)}</td>
              <td style={{ padding:"6px 10px", color:"#ffa657", textAlign:"right" }}>{(d.minBtcLocked || 0).toFixed(2)}</td>
              <td style={{ padding:"6px 10px", color:"#3fb950", textAlign:"right" }}>{Math.max(0, btc - (d.minBtcLocked || 0)).toFixed(2)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"14px 18px", fontSize:10, color:"#6e7681", lineHeight:1.9 }}>
        <div style={{ color:"#f0a500", fontWeight:700, marginBottom:6, letterSpacing:1 }}>{t.notesTitle}</div>
        {t.blocNotes(btc, rate).map((note, i) => <div key={i}>· {note}</div>)}
      </div>
    </>
  );
}

// ─── Firefish Tab ────────────────────────────────────────
function FirefishTab({ firefishData, blocData, sellData, btc, horizon, ffRate, ffTerm }) {
  const t = useT();
  const lastFf = firefishData[firefishData.length - 1];
  const ffPeakUtil = Math.max(...firefishData.map(d => d.util));
  const ffShortfall = firefishData.find(d => d.shortfall > 0 && d.m > 0);
  const last = blocData[blocData.length - 1];
  const peakUtil = Math.max(...blocData.map(d => d.util));
  const blocShortfall = blocData.find(d => d.shortfall > 0 && d.m > 0);
  const ffChart3mo = firefishData.filter(d => d.m % 3 === 0);
  const blocChart3mo = blocData.filter(d => d.m % 3 === 0);
  const ffAnnual = firefishData.filter(d => d.m % 12 === 0);

  const debtCompare = useMemo(() =>
    ffChart3mo.map((fd, i) => {
      const bd = blocChart3mo[i];
      return { yr: fd.yr, m: fd.m, price: fd.price, ffDebt: fd.totalOutstanding, blocDebt: bd?.balance || 0, limit: fd.limit, ffUtil: fd.util, blocUtil: bd?.util || 0, totalOutstanding: fd.totalOutstanding, activeLoans: fd.activeLoans, isRollover: fd.isRollover, maturingRepay: fd.maturingRepay, shortfall: fd.shortfall };
    }), [ffChart3mo, blocChart3mo]);

  const nwCompare = useMemo(() =>
    ffChart3mo.map((fd, i) => {
      const bd = blocChart3mo[i];
      const sd = sellData[fd.m] || sellData[sellData.length - 1];
      return { yr: fd.yr, m: fd.m, price: fd.price, firefishNetWorth: fd.netWorth, blocNetWorth: bd?.netWorth || 0, sellNetWorth: sd.netWorth, primary: fd.netWorth, primaryLabel: t.firefishShort, primaryColor: "#d2a8ff" };
    }), [ffChart3mo, blocChart3mo, sellData, t]);

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"16px 20px", borderTop:"3px solid #d2a8ff" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#d2a8ff", letterSpacing:1, marginBottom:10 }}>{t.ffLoans(ffTerm, ffRate)}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <StatRow label={t.peakUtil} value={pct(ffPeakUtil)} color={ffPeakUtil > 90 ? "#ff7b72" : ffPeakUtil > 75 ? "#ffa657" : "#3fb950"} />
            <StatRow label={t.finalDebt} value={usd(lastFf?.totalOutstanding)} color="#ff7b72" />
            <StatRow label={t.netWorth} value={usd(lastFf?.netWorth)} color="#3fb950" />
            <StatRow label={t.btcHeld} value={`${btc} BTC`} color="#f0a500" />
            <StatRow label={t.minBtcLocked} value={`${(lastFf?.minBtcLocked || 0).toFixed(2)} BTC`} color="#ffa657" />
            <StatRow label={t.freeBtc} value={`${Math.max(0, btc - (lastFf?.minBtcLocked || 0)).toFixed(2)} BTC`} color="#3fb950" />
            <StatRow label={t.expensesAtEnd} value={usd(lastFf?.expenses)} color="#ffa657" />
            <StatRow label={t.result} value={ffShortfall ? t.shortfallYr((ffShortfall.m/12).toFixed(1)) : ffPeakUtil > 85 ? t.dangerousUtil(pct(ffPeakUtil)) : t.sustained} color={ffShortfall ? "#ff7b72" : ffPeakUtil > 85 ? "#ffa657" : "#3fb950"} />
          </div>
        </div>
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"16px 20px", borderTop:"3px solid #58a6ff" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#58a6ff", letterSpacing:1, marginBottom:10 }}>{t.locComp}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <StatRow label={t.peakUtil} value={pct(peakUtil)} color={peakUtil > 90 ? "#ff7b72" : peakUtil > 75 ? "#ffa657" : "#3fb950"} />
            <StatRow label={t.finalDebt} value={usd(last?.balance)} color="#ff7b72" />
            <StatRow label={t.netWorth} value={usd(last?.netWorth)} color="#3fb950" />
            <StatRow label={t.btcHeld} value={`${btc} BTC`} color="#f0a500" />
            <StatRow label={t.minBtcLocked} value={`${(last?.minBtcLocked || 0).toFixed(2)} BTC`} color="#ffa657" />
            <StatRow label={t.freeBtc} value={`${Math.max(0, btc - (last?.minBtcLocked || 0)).toFixed(2)} BTC`} color="#3fb950" />
            <StatRow label={t.expensesAtEnd} value={usd(last?.expenses)} color="#ffa657" />
            <StatRow label={t.result} value={blocShortfall ? t.shortfallYr((blocShortfall.m/12).toFixed(1)) : peakUtil > 85 ? t.dangerousUtil(pct(peakUtil)) : t.sustained} color={blocShortfall ? "#ff7b72" : peakUtil > 85 ? "#ffa657" : "#3fb950"} />
          </div>
        </div>
      </div>

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>{t.debtFfVsLoc}</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={debtCompare} margin={{top:4,right:8,bottom:4,left:8}}>
            <defs><linearGradient id="lgff2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d2a8ff" stopOpacity={0.12}/><stop offset="95%" stopColor="#d2a8ff" stopOpacity={0.01}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
            <YAxis tickFormatter={v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:`${(v/1000).toFixed(0)}k`} tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={60} />
            <Tooltip content={<FirefishTooltip />} />
            <Area type="monotone" dataKey="limit" stroke="#6e7681" strokeWidth={1} fill="url(#lgff2)" name={t.creditLimit} dot={false} strokeDasharray="3 3" />
            <Line type="monotone" dataKey="ffDebt" stroke="#d2a8ff" strokeWidth={2.5} name={t.ffDebt} dot={false} />
            <Line type="monotone" dataKey="blocDebt" stroke="#58a6ff" strokeWidth={1.5} strokeDasharray="5 3" name={t.locDebt} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:20, marginTop:10, fontSize:10, color:"#6e7681" }}>
          <span><span style={{color:"#d2a8ff"}}>━━</span> {t.ffDebt}</span>
          <span><span style={{color:"#58a6ff"}}>- -</span> {t.locDebt}</span>
          <span><span style={{color:"#6e7681"}}>···</span> {t.creditLimit}</span>
        </div>
      </div>

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>{t.utilFfVsLoc}</div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={debtCompare} margin={{top:4,right:8,bottom:4,left:8}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
            <YAxis domain={[0,100]} tickFormatter={v=>v+"%"} tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={42} />
            <Tooltip />
            <ReferenceLine y={90} stroke="#ff7b72" strokeDasharray="4 3" />
            <Line type="monotone" dataKey="ffUtil" stroke="#d2a8ff" strokeWidth={2} name={`${t.firefishShort} %`} dot={false} />
            <Line type="monotone" dataKey="blocUtil" stroke="#58a6ff" strokeWidth={1.5} strokeDasharray="5 3" name={`${t.locShort} %`} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:20, marginTop:10, fontSize:10, color:"#6e7681" }}>
          <span><span style={{color:"#d2a8ff"}}>━━</span> {t.firefishShort}</span>
          <span><span style={{color:"#58a6ff"}}>- -</span> {t.locShort}</span>
          <span><span style={{color:"#ff7b72"}}>---</span> {t.marginCall}</span>
        </div>
      </div>

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>{t.nwFfVsLocVsSell}</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={nwCompare} margin={{top:4,right:8,bottom:4,left:8}}>
            <defs><linearGradient id="lgFf3" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d2a8ff" stopOpacity={0.1}/><stop offset="95%" stopColor="#d2a8ff" stopOpacity={0.01}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
            <YAxis tickFormatter={v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:`${(v/1000).toFixed(0)}k`} tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={60} />
            <Tooltip content={<NetWorthTooltip />} />
            <Area type="monotone" dataKey="firefishNetWorth" stroke="#d2a8ff" strokeWidth={2} fill="url(#lgFf3)" name={t.firefishShort} dot={false} />
            <Line type="monotone" dataKey="blocNetWorth" stroke="#58a6ff" strokeWidth={1.5} strokeDasharray="5 3" name={t.locShort} dot={false} />
            <Line type="monotone" dataKey="sellNetWorth" stroke="#ff7b72" strokeWidth={1.5} strokeDasharray="5 3" name={t.sell} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:20, marginTop:10, fontSize:10, color:"#6e7681" }}>
          <span><span style={{color:"#d2a8ff"}}>━━</span> {t.firefishShort}</span>
          <span><span style={{color:"#58a6ff"}}>- -</span> {t.locShort}</span>
          <span><span style={{color:"#ff7b72"}}>- -</span> {t.sellToLive}</span>
        </div>
      </div>

      <Playbook data={firefishData} months={horizon} strategy="firefish" color="#d2a8ff" />

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16, overflowX:"auto" }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:14 }}>{t.ffAnnual(ffTerm, ffRate)}</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead><tr style={{ borderBottom:"1px solid #30363d" }}>
            {[t.year, t.btcFloor, t.creditLimit, t.outstanding, t.activeLoans, t.util, t.minBtcLocked, t.freeBtc].map(h=>(<th key={h} style={{ padding:"5px 10px", textAlign:"right", color:"#6e7681", fontWeight:600 }}>{h}</th>))}
          </tr></thead>
          <tbody>{ffAnnual.map(d => (
            <tr key={d.m} style={{ borderBottom:"1px solid #0d1117" }}>
              <td style={{ padding:"6px 10px", color:"#f0a500", textAlign:"right", fontWeight:700 }}>{d.m/12}</td>
              <td style={{ padding:"6px 10px", color:"#c9d1d9", textAlign:"right" }}>{usd(d.price)}</td>
              <td style={{ padding:"6px 10px", color:"#d2a8ff", textAlign:"right" }}>{usd(d.limit)}</td>
              <td style={{ padding:"6px 10px", color:"#ff7b72", textAlign:"right" }}>{usd(d.totalOutstanding)}</td>
              <td style={{ padding:"6px 10px", color:"#c9d1d9", textAlign:"right" }}>{d.activeLoans}</td>
              <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:700, color: d.util>90?"#ff7b72":d.util>75?"#ffa657":"#3fb950" }}>{pct(d.util)}</td>
              <td style={{ padding:"6px 10px", color:"#ffa657", textAlign:"right" }}>{(d.minBtcLocked || 0).toFixed(2)}</td>
              <td style={{ padding:"6px 10px", color:"#3fb950", textAlign:"right" }}>{Math.max(0, btc - (d.minBtcLocked || 0)).toFixed(2)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"14px 18px", fontSize:10, color:"#6e7681", lineHeight:1.9 }}>
        <div style={{ color:"#f0a500", fontWeight:700, marginBottom:6, letterSpacing:1 }}>{t.notesTitle}</div>
        {t.ffNotes(btc, ffRate, ffTerm).map((note, i) => <div key={i}>· {note}</div>)}
      </div>
    </>
  );
}

// ─── Main App ────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState("en");
  const [tab, setTab] = useState("bloc");
  const [btc, setBtc] = useState(1);
  const [monthly, setMonthly] = useState(2000);
  const [rate, setRate] = useState(13);
  const [horizon, setHorizon] = useState(240);
  const [ffRate, setFfRate] = useState(15);
  const [ffTerm, setFfTerm] = useState(12);
  const [retireIn, setRetireIn] = useState(0);
  const [inflPct, setInflPct] = useState(3);

  const t = T[lang];
  const drawStartMonth = retireIn * 12;
  const inflationRate = inflPct / 100;

  const blocData = useMemo(() =>
    simulateBLOC({ btc, monthlyFiat: monthly, annualRate: rate / 100, months: horizon, drawStartMonth, inflationRate }),
    [btc, monthly, rate, horizon, drawStartMonth, inflationRate]);

  const sellData = useMemo(() =>
    simulateSell({ btc, monthlyFiat: monthly, months: horizon, drawStartMonth, inflationRate }),
    [btc, monthly, horizon, drawStartMonth, inflationRate]);

  const firefishData = useMemo(() =>
    simulateFirefish({ btc, monthlyFiat: monthly, annualRate: ffRate / 100, loanTermMonths: ffTerm, months: horizon, drawStartMonth, inflationRate }),
    [btc, monthly, ffRate, ffTerm, horizon, drawStartMonth, inflationRate]);

  const first = blocData[0];

  const tabBtn = (key, label, color) => ({
    padding:"10px 24px", borderRadius:"8px 8px 0 0", fontSize:13, fontWeight:700, cursor:"pointer", letterSpacing:1,
    border: tab === key ? `1px solid #21262d` : "1px solid transparent",
    borderBottom: tab === key ? "1px solid #0d1117" : "1px solid #21262d",
    background: tab === key ? "#0d1117" : "transparent",
    color: tab === key ? color : "#6e7681",
    marginBottom: -1,
  });

  return (
    <LangContext.Provider value={lang}>
      <div style={{ minHeight:"100vh", background:"#0d1117", color:"#c9d1d9", fontFamily:"'IBM Plex Mono',monospace", padding:"24px 16px" }}>
        <div style={{ maxWidth:920, margin:"0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:24, lineHeight:1 }}>₿</span>
                <h1 style={{ margin:0, fontSize:17, fontWeight:800, color:"#f0a500", letterSpacing:1 }}>{t.title}</h1>
              </div>
              <button
                onClick={() => setLang(l => l === "en" ? "de" : "en")}
                style={{
                  padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                  border:"1px solid #30363d", background:"transparent", color:"#8b949e",
                  letterSpacing:1,
                }}
              >
                {lang === "en" ? "DE 🇩🇪" : "EN 🇬🇧"}
              </button>
            </div>
            <p style={{ margin:0, fontSize:10, color:"#6e7681", lineHeight:1.7 }}>
              {t.subtitle(usd(first?.price))}
            </p>
            <p style={{ margin:"8px 0 0", fontSize:9, color:"#6e7681", lineHeight:1.5, fontStyle:"italic", borderTop:"1px solid #21262d", paddingTop:8 }}>
              ⚠ {t.disclaimer}
            </p>
          </div>

          {/* Controls */}
          <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:20 }}>
            <div style={{ fontSize:10, color:"#f0a500", fontWeight:700, letterSpacing:2, marginBottom:14 }}>{t.params}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 40px" }}>
              <Ctrl label={t.btcCollateral} value={btc} min={1} max={20} step={0.5} onChange={setBtc} fmt={v => `${v} BTC`} />
              <Ctrl label={t.monthlyExpenses} value={monthly} min={1000} max={15000} step={500} onChange={setMonthly} fmt={v => `${v.toLocaleString()}`} />
              <Ctrl label={t.locRate} value={rate} min={5} max={25} step={0.5} onChange={setRate} fmt={v => `${v}%`} />
              <Ctrl label={t.inflation} value={inflPct} min={0} max={10} step={0.5} onChange={setInflPct} fmt={v => `${v}%`} />
              <Ctrl label={t.retireIn} value={retireIn} min={0} max={20} step={1} onChange={setRetireIn} fmt={v => v === 0 ? (lang === "de" ? "Sofort" : "Now") : `${v} ${t.yrs}`} />
              <Ctrl label={t.simHorizon} value={horizon} min={60} max={480} step={12} onChange={setHorizon} fmt={v => `${v/12} ${t.yrs}`} />
            </div>
            {tab === "firefish" && (
              <div style={{ borderTop:"1px solid #21262d", marginTop:8, paddingTop:14 }}>
                <div style={{ fontSize:10, color:"#d2a8ff", fontWeight:700, letterSpacing:2, marginBottom:14 }}>{t.ffParams}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 40px" }}>
                  <Ctrl label={t.ffApr} value={ffRate} min={5} max={30} step={0.5} onChange={setFfRate} fmt={v => `${v}%`} />
                  <Ctrl label={t.ffLoanTerm} value={ffTerm} min={3} max={36} step={3} onChange={setFfTerm} fmt={v => `${v} ${t.months}`} />
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:4, borderBottom:"1px solid #21262d", marginBottom:20 }}>
            <button onClick={() => setTab("bloc")} style={tabBtn("bloc", t.tabLoc, "#58a6ff")}>{t.tabLoc}</button>
            <button onClick={() => setTab("firefish")} style={tabBtn("firefish", t.tabFirefish, "#d2a8ff")}>{t.tabFirefish}</button>
          </div>

          {tab === "bloc" && (
            <BlocTab blocData={blocData} sellData={sellData} btc={btc} horizon={horizon} rate={rate} />
          )}
          {tab === "firefish" && (
            <FirefishTab firefishData={firefishData} blocData={blocData} sellData={sellData} btc={btc} horizon={horizon} ffRate={ffRate} ffTerm={ffTerm} />
          )}

        </div>
      </div>
    </LangContext.Provider>
  );
}
