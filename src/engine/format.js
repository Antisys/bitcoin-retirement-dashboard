export function fmtUSD(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + '$' + Math.round(abs).toLocaleString('en-US');
  return sign + '$' + abs.toFixed(2);
}

export function fmtBTC(n) {
  return n.toFixed(4) + ' BTC';
}

export function fmtChartAxis(v) {
  const abs = Math.abs(v);
  if (abs >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'k';
  return '$' + v.toFixed(0);
}
