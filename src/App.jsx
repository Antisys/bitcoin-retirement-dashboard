import { useState, useMemo, useCallback, useRef } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// Power Law Lower Bound
// log10(P) = 5.84 × log10(days_since_genesis) − 17.53
// Genesis: Jan 3, 2009 | Calibrated: today (~6270 days) ≈ $45,000 floor
const GENESIS_MS = new Date("2009-01-03").getTime();
const TODAY_MS   = new Date("2026-03-05").getTime();
const TODAY_DAYS = Math.floor((TODAY_MS - GENESIS_MS) / 86400000);

function powerLawPrice(days) {
  return Math.pow(10, 5.84 * Math.log10(days) - 17.53);
}

// BLOC: borrow against BTC, never sell
function simulateBLOC({ btc, monthlyFiat, annualRate, months }) {
  const mr = annualRate / 12;
  let balance = 0;
  const rows = [];
  for (let m = 0; m <= months; m++) {
    const days    = TODAY_DAYS + m * 30.44;
    const price   = powerLawPrice(days);
    const limit   = btc * price * 0.5;
    const util    = limit > 0 ? balance / limit : 0;
    const interest = balance * mr;
    const headroom = limit - balance - interest;
    const draw     = Math.min(monthlyFiat, Math.max(0, headroom));
    const shortfall = monthlyFiat - draw;
    const netWorth = btc * price - balance;
    rows.push({ m, yr: +(m / 12).toFixed(2), price, limit, balance, interest, draw, shortfall, util: +(util * 100).toFixed(1), headroom, netWorth, btcHeld: btc });
    balance += interest + draw;
  }
  return rows;
}

// Sell to Live: sell BTC each month to cover expenses
function simulateSell({ btc, monthlyFiat, months }) {
  let held = btc;
  const rows = [];
  for (let m = 0; m <= months; m++) {
    const days  = TODAY_DAYS + m * 30.44;
    const price = powerLawPrice(days);
    const netWorth = held * price;
    const btcNeeded = held > 0 ? monthlyFiat / price : 0;
    const sold = Math.min(btcNeeded, held);
    const shortfall = held > 0 ? 0 : monthlyFiat;
    rows.push({ m, yr: +(m / 12).toFixed(2), price, btcHeld: held, sold, netWorth, shortfall });
    if (m < months) {
      held -= sold;
      if (held < 1e-10) held = 0;
    }
  }
  return rows;
}

const usd = (n) => n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");
const pct = (n) => n.toFixed(1) + "%";

function BlocTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:"#0d1117", border:"1px solid #30363d", borderRadius:8, padding:"12px 16px", fontSize:11, lineHeight:1.8, color:"#c9d1d9" }}>
      <div style={{ fontWeight:700, color:"#f0a500", marginBottom:4 }}>Year {d.yr}  (Month {d.m})</div>
      <div>BTC floor price: <b style={{color:"#f0a500"}}>{usd(d.price)}</b></div>
      <div>Credit limit: <b style={{color:"#58a6ff"}}>{usd(d.limit)}</b></div>
      <div>Loan balance: <b style={{color:"#ff7b72"}}>{usd(d.balance)}</b></div>
      <div>Monthly interest: <b style={{color:"#ffa657"}}>{usd(d.interest)}</b></div>
      <div>Utilization: <b style={{color: d.util > 85 ? "#ff7b72" : "#3fb950"}}>{pct(d.util)}</b></div>
      {d.shortfall > 0 && <div style={{color:"#ff7b72"}}>⚠ Shortfall: {usd(d.shortfall)}</div>}
    </div>
  );
}

function CompareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:"#0d1117", border:"1px solid #30363d", borderRadius:8, padding:"12px 16px", fontSize:11, lineHeight:1.8, color:"#c9d1d9" }}>
      <div style={{ fontWeight:700, color:"#f0a500", marginBottom:4 }}>Year {d.yr}</div>
      <div>BLOC net worth: <b style={{color:"#58a6ff"}}>{usd(d.blocNetWorth)}</b></div>
      <div>Sell net worth: <b style={{color:"#ff7b72"}}>{usd(d.sellNetWorth)}</b></div>
      <div>BLOC BTC held: <b style={{color:"#58a6ff"}}>{d.blocBtc.toFixed(4)}</b></div>
      <div>Sell BTC held: <b style={{color:"#ff7b72"}}>{d.sellBtc.toFixed(4)}</b></div>
      <div>BTC floor price: <b style={{color:"#f0a500"}}>{usd(d.price)}</b></div>
    </div>
  );
}

function Card({ label, value, sub, accent="#58a6ff" }) {
  return (
    <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:10, padding:"14px 18px", flex:1, minWidth:130 }}>
      <div style={{ fontSize:10, color:"#6e7681", textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:800, color:accent, marginTop:3, fontFamily:"monospace" }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"#6e7681", marginTop:2 }}>{sub}</div>}
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

// Monthly Playbook with wheel scrolling
function Playbook({ blocData, sellData, months }) {
  const [month, setMonth] = useState(0);
  const [strategy, setStrategy] = useState("bloc");
  const ref = useRef(null);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setMonth(prev => Math.max(0, Math.min(months, prev + delta)));
  }, [months]);

  const bd = blocData[month] || blocData[blocData.length - 1];
  const sd = sellData[month] || sellData[sellData.length - 1];
  const d = strategy === "bloc" ? bd : sd;
  const yearLabel = (month / 12).toFixed(1);

  return (
    <div ref={ref} onWheel={handleWheel} style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2 }}>MONTHLY PLAYBOOK</div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => setStrategy("bloc")} style={{
            padding:"4px 12px", borderRadius:6, fontSize:11, fontWeight:600, cursor:"pointer",
            border: strategy === "bloc" ? "1px solid #58a6ff" : "1px solid #30363d",
            background: strategy === "bloc" ? "rgba(88,166,255,0.1)" : "transparent",
            color: strategy === "bloc" ? "#58a6ff" : "#6e7681",
          }}>BLOC</button>
          <button onClick={() => setStrategy("sell")} style={{
            padding:"4px 12px", borderRadius:6, fontSize:11, fontWeight:600, cursor:"pointer",
            border: strategy === "sell" ? "1px solid #ff7b72" : "1px solid #30363d",
            background: strategy === "sell" ? "rgba(255,123,114,0.1)" : "transparent",
            color: strategy === "sell" ? "#ff7b72" : "#6e7681",
          }}>Sell to Live</button>
        </div>
      </div>

      <div style={{ marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
          <span style={{ fontSize:11, color:"#8b949e" }}>Month {month} — Year {yearLabel}</span>
        </div>
        <input type="range" value={month} onChange={e => setMonth(Number(e.target.value))}
          min={0} max={months} step={1}
          style={{ width:"100%", accentColor:"#f0a500", cursor:"pointer" }} />
      </div>

      <div style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
        <div style={{ textAlign:"center", minWidth:110 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#f0a500" }}>{usd(d.price)}</div>
          <div style={{ fontSize:10, color:"#6e7681" }}>BTC Price</div>
        </div>
        <div style={{ textAlign:"center", minWidth:110 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#e6edf3" }}>{(strategy === "bloc" ? bd.btcHeld : sd.btcHeld).toFixed(4)}</div>
          <div style={{ fontSize:10, color:"#6e7681" }}>BTC Held</div>
        </div>
        <div style={{ textAlign:"center", minWidth:110 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#3fb950" }}>{usd(d.netWorth)}</div>
          <div style={{ fontSize:10, color:"#6e7681" }}>Net Worth</div>
        </div>
        {strategy === "bloc" && (
          <>
            <div style={{ textAlign:"center", minWidth:110 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#ff7b72" }}>{usd(bd.balance)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>Loan Balance</div>
            </div>
            <div style={{ textAlign:"center", minWidth:110 }}>
              <div style={{ fontSize:18, fontWeight:700, color: bd.util > 85 ? "#ff7b72" : bd.util > 65 ? "#ffa657" : "#3fb950" }}>{pct(bd.util)}</div>
              <div style={{ fontSize:10, color:"#6e7681" }}>Utilization</div>
            </div>
          </>
        )}
        {strategy === "sell" && sd.sold > 0 && (
          <div style={{ textAlign:"center", minWidth:110 }}>
            <div style={{ fontSize:18, fontWeight:700, color:"#ff7b72" }}>{sd.sold.toFixed(6)}</div>
            <div style={{ fontSize:10, color:"#6e7681" }}>BTC Sold</div>
          </div>
        )}
      </div>

      <div style={{ marginTop:14, padding:"10px 14px", background:"#0d1117", borderRadius:8, textAlign:"center", fontSize:13 }}>
        {strategy === "bloc" ? (
          bd.shortfall > 0
            ? <span style={{ color:"#ff7b72" }}>⚠ Can only draw {usd(bd.draw)} — shortfall {usd(bd.shortfall)}</span>
            : <span style={{ color:"#58a6ff" }}>Borrow {usd(bd.draw)} · interest {usd(bd.interest)} · {pct(bd.util)} utilized</span>
        ) : (
          sd.btcHeld <= 0
            ? <span style={{ color:"#ff7b72" }}>⚠ BTC depleted — no funds available</span>
            : <span style={{ color:"#ff7b72" }}>Sell {sd.sold.toFixed(6)} BTC ({usd(sd.sold * sd.price)}) to cover expenses</span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [btc,     setBtc]     = useState(6);
  const [monthly, setMonthly] = useState(6000);
  const [rate,    setRate]    = useState(13);
  const [horizon, setHorizon] = useState(240);

  const blocData = useMemo(() =>
    simulateBLOC({ btc, monthlyFiat: monthly, annualRate: rate / 100, months: horizon }),
    [btc, monthly, rate, horizon]
  );

  const sellData = useMemo(() =>
    simulateSell({ btc, monthlyFiat: monthly, months: horizon }),
    [btc, monthly, horizon]
  );

  const first       = blocData[0];
  const peakUtil    = Math.max(...blocData.map(d => d.util));
  const peakRow     = blocData.find(d => d.util === peakUtil);
  const last        = blocData[blocData.length - 1];
  const blocShortfall = blocData.find(d => d.shortfall > 0 && d.m > 0);
  const sellDepleted  = sellData.find(d => d.btcHeld <= 0 && d.m > 0);
  const lastSell      = sellData[sellData.length - 1];
  const chart3mo      = blocData.filter(d => d.m % 3 === 0);
  const annual        = blocData.filter(d => d.m % 12 === 0);

  // Comparison chart data
  const compareData = useMemo(() => {
    return blocData.filter(d => d.m % 3 === 0).map(bd => {
      const sd = sellData[bd.m] || sellData[sellData.length - 1];
      return {
        yr: bd.yr,
        m: bd.m,
        price: bd.price,
        blocNetWorth: bd.netWorth,
        sellNetWorth: sd.netWorth,
        blocBtc: bd.btcHeld,
        sellBtc: sd.btcHeld,
      };
    });
  }, [blocData, sellData]);

  return (
    <div style={{ minHeight:"100vh", background:"#0d1117", color:"#c9d1d9", fontFamily:"'IBM Plex Mono',monospace", padding:"24px 16px" }}>
      <div style={{ maxWidth:920, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24, lineHeight:1 }}>₿</span>
            <h1 style={{ margin:0, fontSize:17, fontWeight:800, color:"#f0a500", letterSpacing:1 }}>
              BITCOIN RETIREMENT — POWER LAW FLOOR MODEL
            </h1>
          </div>
          <p style={{ margin:0, fontSize:10, color:"#6e7681", lineHeight:1.7 }}>
            BTC price follows the <b style={{color:"#8b949e"}}>lower support band</b> of the Bitcoin Power Law
            &nbsp;·&nbsp; log₁₀(P) = 5.84 × log₁₀(days) − 17.53
            &nbsp;·&nbsp; Today's floor ≈ <b style={{color:"#f0a500"}}>{usd(first?.price)}</b>
          </p>
        </div>

        {/* Controls */}
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:20 }}>
          <div style={{ fontSize:10, color:"#f0a500", fontWeight:700, letterSpacing:2, marginBottom:14 }}>PARAMETERS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 40px" }}>
            <Ctrl label="BTC held as collateral" value={btc} min={1} max={20} step={0.5} onChange={setBtc} fmt={v => `${v} BTC`} />
            <Ctrl label="Monthly living expenses" value={monthly} min={1000} max={15000} step={500} onChange={setMonthly} fmt={v => `${v.toLocaleString()}`} />
            <Ctrl label="LOC interest rate (APR)" value={rate} min={5} max={25} step={0.5} onChange={setRate} fmt={v => `${v}%`} />
            <Ctrl label="Simulation horizon" value={horizon} min={60} max={480} step={12} onChange={setHorizon} fmt={v => `${v/12} yrs`} />
          </div>
        </div>

        {/* Strategy Comparison Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {/* BLOC summary */}
          <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"16px 20px", borderTop:"3px solid #58a6ff" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#58a6ff", letterSpacing:1, marginBottom:10 }}>BLOC (BORROW, NEVER SELL)</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>Peak utilization</span>
                <span style={{ fontWeight:700, color: peakUtil > 90 ? "#ff7b72" : peakUtil > 75 ? "#ffa657" : "#3fb950" }}>{pct(peakUtil)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>Final loan balance</span>
                <span style={{ fontWeight:700, color:"#ff7b72" }}>{usd(last?.balance)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>Final net worth</span>
                <span style={{ fontWeight:700, color:"#3fb950" }}>{usd(last?.netWorth)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>BTC held</span>
                <span style={{ fontWeight:700, color:"#f0a500" }}>{btc} BTC (all)</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>Result</span>
                {blocShortfall ? (
                  <span style={{ fontWeight:700, color:"#ff7b72" }}>Shortfall at year {(blocShortfall.m / 12).toFixed(1)}</span>
                ) : (
                  <span style={{ fontWeight:700, color:"#3fb950" }}>Sustained ✓</span>
                )}
              </div>
            </div>
          </div>

          {/* Sell to Live summary */}
          <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"16px 20px", borderTop:"3px solid #ff7b72" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#ff7b72", letterSpacing:1, marginBottom:10 }}>SELL TO LIVE</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>BTC remaining</span>
                <span style={{ fontWeight:700, color:"#f0a500" }}>{lastSell.btcHeld.toFixed(4)} BTC</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>BTC sold total</span>
                <span style={{ fontWeight:700, color:"#ff7b72" }}>{(btc - lastSell.btcHeld).toFixed(4)} BTC</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>Final net worth</span>
                <span style={{ fontWeight:700, color:"#3fb950" }}>{usd(lastSell.netWorth)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>Loan balance</span>
                <span style={{ fontWeight:700, color:"#6e7681" }}>$0 (no debt)</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#6e7681" }}>Result</span>
                {sellDepleted ? (
                  <span style={{ fontWeight:700, color:"#ff7b72" }}>Depleted at year {(sellDepleted.m / 12).toFixed(1)}</span>
                ) : (
                  <span style={{ fontWeight:700, color:"#3fb950" }}>Sustained ✓</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chart 1: Credit Limit vs Balance (BLOC) */}
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>
            CREDIT LIMIT vs LOAN BALANCE
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chart3mo} margin={{top:4,right:8,bottom:4,left:8}}>
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#58a6ff" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
              <YAxis tickFormatter={v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:`${(v/1000).toFixed(0)}k`}
                tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={60} />
              <Tooltip content={<BlocTooltip />} />
              <Area type="monotone" dataKey="limit" stroke="#58a6ff" strokeWidth={2}
                fill="url(#lg)" name="Credit Limit" dot={false} />
              <Line type="monotone" dataKey="balance" stroke="#ff7b72" strokeWidth={2.5}
                name="Loan Balance" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:20, marginTop:10, fontSize:10, color:"#6e7681" }}>
            <span><span style={{color:"#58a6ff"}}>━━</span> Credit Limit (50% of {btc} BTC collateral)</span>
            <span><span style={{color:"#ff7b72"}}>━━</span> Loan Balance</span>
          </div>
        </div>

        {/* Chart 2: Utilization */}
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>
            LOC UTILIZATION % — margin call risk above 90%
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chart3mo} margin={{top:4,right:8,bottom:4,left:8}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
              <YAxis domain={[0,100]} tickFormatter={v=>v+"%"} tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={42} />
              <Tooltip content={<BlocTooltip />} />
              <ReferenceLine y={90} stroke="#ff7b72" strokeDasharray="4 3" />
              <Area type="monotone" dataKey="util" stroke="#ffa657" strokeWidth={2}
                fill="#ffa657" fillOpacity={0.1} name="Utilization %" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Net Worth Comparison */}
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:16 }}>
            NET WORTH COMPARISON — BLOC vs SELL TO LIVE
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={compareData} margin={{top:4,right:8,bottom:4,left:8}}>
              <defs>
                <linearGradient id="lgBloc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#58a6ff" stopOpacity={0.01}/>
                </linearGradient>
                <linearGradient id="lgSell" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff7b72" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#ff7b72" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="yr" tick={{fill:"#6e7681",fontSize:10}} tickFormatter={v=>`Y${v}`} stroke="#30363d" />
              <YAxis tickFormatter={v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:`${(v/1000).toFixed(0)}k`}
                tick={{fill:"#6e7681",fontSize:9}} stroke="#30363d" width={60} />
              <Tooltip content={<CompareTooltip />} />
              <Area type="monotone" dataKey="blocNetWorth" stroke="#58a6ff" strokeWidth={2}
                fill="url(#lgBloc)" name="BLOC" dot={false} />
              <Area type="monotone" dataKey="sellNetWorth" stroke="#ff7b72" strokeWidth={2}
                fill="url(#lgSell)" name="Sell to Live" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:20, marginTop:10, fontSize:10, color:"#6e7681" }}>
            <span><span style={{color:"#58a6ff"}}>━━</span> BLOC (borrow, keep all BTC)</span>
            <span><span style={{color:"#ff7b72"}}>━━</span> Sell to Live (sell BTC monthly)</span>
          </div>
        </div>

        {/* Monthly Playbook */}
        <Playbook blocData={blocData} sellData={sellData} months={horizon} />

        {/* Annual Table */}
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16, overflowX:"auto" }}>
          <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:14 }}>ANNUAL SNAPSHOT — BLOC</div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #30363d" }}>
                {["Year","BTC Floor","Credit Limit","Loan Balance","Monthly Interest","Utilization"].map(h=>(
                  <th key={h} style={{ padding:"5px 10px", textAlign:"right", color:"#6e7681", fontWeight:600, letterSpacing:0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {annual.map(d => (
                <tr key={d.m} style={{ borderBottom:"1px solid #0d1117" }}>
                  <td style={{ padding:"6px 10px", color:"#f0a500", textAlign:"right", fontWeight:700 }}>{d.m/12}</td>
                  <td style={{ padding:"6px 10px", color:"#c9d1d9", textAlign:"right" }}>{usd(d.price)}</td>
                  <td style={{ padding:"6px 10px", color:"#58a6ff", textAlign:"right" }}>{usd(d.limit)}</td>
                  <td style={{ padding:"6px 10px", color:"#ff7b72", textAlign:"right" }}>{usd(d.balance)}</td>
                  <td style={{ padding:"6px 10px", color:"#ffa657", textAlign:"right" }}>{usd(d.interest)}</td>
                  <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:700,
                    color: d.util>90?"#ff7b72":d.util>75?"#ffa657":"#3fb950" }}>{pct(d.util)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sell to Live annual table */}
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"18px 22px", marginBottom:16, overflowX:"auto" }}>
          <div style={{ fontSize:10, color:"#8b949e", fontWeight:700, letterSpacing:2, marginBottom:14 }}>ANNUAL SNAPSHOT — SELL TO LIVE</div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #30363d" }}>
                {["Year","BTC Floor","BTC Held","BTC Sold/mo","Net Worth"].map(h=>(
                  <th key={h} style={{ padding:"5px 10px", textAlign:"right", color:"#6e7681", fontWeight:600, letterSpacing:0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellData.filter(d => d.m % 12 === 0).map(d => (
                <tr key={d.m} style={{ borderBottom:"1px solid #0d1117" }}>
                  <td style={{ padding:"6px 10px", color:"#f0a500", textAlign:"right", fontWeight:700 }}>{d.m/12}</td>
                  <td style={{ padding:"6px 10px", color:"#c9d1d9", textAlign:"right" }}>{usd(d.price)}</td>
                  <td style={{ padding:"6px 10px", color: d.btcHeld > 0 ? "#f0a500" : "#ff7b72", textAlign:"right", fontWeight:700 }}>{d.btcHeld.toFixed(4)}</td>
                  <td style={{ padding:"6px 10px", color:"#ff7b72", textAlign:"right" }}>{d.sold > 0 ? d.sold.toFixed(6) : "—"}</td>
                  <td style={{ padding:"6px 10px", color:"#3fb950", textAlign:"right", fontWeight:700 }}>{usd(d.netWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:12, padding:"14px 18px", fontSize:10, color:"#6e7681", lineHeight:1.9 }}>
          <div style={{ color:"#f0a500", fontWeight:700, marginBottom:6, fontSize:10, letterSpacing:1 }}>MODEL NOTES</div>
          <div>· Price follows the <b style={{color:"#8b949e"}}>lower power law band</b> — the floor of Bitcoin's historical price corridor, not the median or upper band</div>
          <div>· <b style={{color:"#58a6ff"}}>BLOC:</b> {btc} BTC locked as collateral, credit limit = 50% of collateral value. Interest rolls into the loan. BTC is never sold.</div>
          <div>· <b style={{color:"#ff7b72"}}>Sell to Live:</b> Each month, sell just enough BTC to cover expenses. No debt, no interest — but BTC holdings shrink over time.</div>
          <div>· Credit limit <b style={{color:"#8b949e"}}>expands dynamically</b> as BTC price rises — assumes lender honors appreciated collateral value</div>
          <div>· In reality, lenders set a <b style={{color:"#ff7b72"}}>margin call threshold</b> (often 80–85% LTV) — the 90% dashed line is where you'd likely face liquidation pressure</div>
          <div>· The comparison shows the tradeoff: BLOC keeps all BTC but carries growing debt; Sell keeps zero debt but loses BTC exposure</div>
        </div>

      </div>
    </div>
  );
}
