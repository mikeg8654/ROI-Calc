// Standalone replication of v1.22 calculator math.

const C = {
  annual_eligible_factor: 0.0077,
  md_ally_pct_of_medical: 0.12,
  days_per_year: 365,
  cost_per_diverted_call: 2673,
  cost_per_ed_visit: 2453,
  hrs_per_unit_day: 14.256,
  hrs_per_run: { rural:3.0, suburban:1.48, urban:1.48 },
  build_base: 23245,
  build_uplift: { parallel:0, uni:7500, bi:22500 },
  impl_days: { parallel: 52, uni: 75, bi: 105 },
  module_costs: {
    path: 11000,
    apm: 17000,
    terf_tiers: [
      [150000, 15000],[330000, 18650],[450000, 22118],[800000, 25412],
      [2000000, 28541],[3500000, 31514],[5000000, 34338],[Infinity, 37021]
    ],
    vamc_tiers: [
      [450000, 15000],[1100000, 21500],[1750000, 28000],[2400000, 34000],
      [3050000, 40000],[3700000, 44500],[4350000, 50000],[Infinity, 55000]
    ],
  },
};
const PRICE = {
  uninsured_pct: 0.10, platform_fee: 100000, pop_to_eligible_rate: 0.0077,
  eligible_to_triaged: 0.5, uninsured_call_uplift: 1.7, followup_eoc_rate: 0.4,
  insured_per_call: 43, uninsured_per_call: 64.5, eoc_per_call: 32.25,
  call_tiers: [[1875,0],[3750,0.05],[5625,0.0575],[10000,0.069],[25000,0.08625],[43750,0.112125]],
  max_discount: 0.20,
};
const SCENARIOS = {
  Conservative: { consent:0.70, diversion:0.70, full:0.55 },
  Expected:     { consent:0.85, diversion:0.84, full:0.65 },
  Aspirational: { consent:0.90, diversion:0.88, full:0.70 },
};

function popTier(pop, tiers) {
  for (const [bound, price] of tiers) if (pop <= bound) return price;
  return tiers[tiers.length-1][1];
}
function buildExtras(pop, depth, modules) {
  let extra = C.build_base + (C.build_uplift[depth] || 0);
  if (modules.includes('path')) extra += C.module_costs.path;
  if (modules.includes('apm'))  extra += C.module_costs.apm;
  if (modules.includes('terf')) extra += popTier(pop, C.module_costs.terf_tiers);
  if (modules.includes('vamc')) extra += popTier(pop, C.module_costs.vamc_tiers);
  return extra;
}
function priceForPop(pop, partnerDiscount) {
  pop = Math.max(0, pop || 0);
  const u = pop * PRICE.uninsured_pct, i = pop * (1 - PRICE.uninsured_pct);
  const uc = u * PRICE.pop_to_eligible_rate * (1 + PRICE.uninsured_call_uplift) * PRICE.eligible_to_triaged;
  const ic = i * PRICE.pop_to_eligible_rate * PRICE.eligible_to_triaged;
  const ec = (uc + ic) * PRICE.followup_eoc_rate;
  const totalCalls = uc + ic + ec;
  if (totalCalls <= 0) return { effectivePrice: PRICE.platform_fee };
  const totalAtAnchor = uc * PRICE.uninsured_per_call + ic * PRICE.insured_per_call + ec * PRICE.eoc_per_call;
  const blended = totalAtAnchor / totalCalls;
  let listPrice = PRICE.platform_fee, prev = blended, prevMax = 0;
  for (let k = 0; k < PRICE.call_tiers.length; k++) {
    const [tMax, tDisc] = PRICE.call_tiers[k];
    const tp = k === 0 ? blended : prev * (1 - tDisc);
    const c = Math.min(totalCalls, tMax) - prevMax;
    if (c <= 0) break;
    listPrice += c * tp; prev = tp; prevMax = tMax;
    if (totalCalls <= tMax) break;
  }
  const d = Math.max(0, Math.min(PRICE.max_discount, partnerDiscount || 0));
  return { effectivePrice: listPrice * (1 - d), totalCalls };
}

function fmtUSD(n) {
  if (Math.abs(n) >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + Math.round(n/1e3) + 'K';
  return '$' + Math.round(n);
}
function fmtRatio(v) { return v > 100 ? '$100+:1' : `$${Math.round(v)}:1`; }
function rateWarn(medical, pop) {
  if (!medical || !pop) return '';
  const r = medical / (pop/1000);
  if (r > 200) return ` ⚠HIGH(${r.toFixed(0)}/1K)`;
  if (r > 150) return ` ~edge(${r.toFixed(0)}/1K)`;
  return '';
}

function run({ pop=250000, area='suburban', userMedicalCalls=null, depth='parallel', modules=['path','apm'], discount=0, scenario='Expected' } = {}) {
  const annualEligible = userMedicalCalls ? userMedicalCalls * C.md_ally_pct_of_medical : pop * C.annual_eligible_factor;
  const s = SCENARIOS[scenario];
  const diversions = annualEligible * s.consent * s.diversion;
  const fullDiv = diversions * s.full;
  const unitDays = diversions * C.hrs_per_run[area] / C.hrs_per_unit_day;
  const agencyCost = diversions * C.cost_per_diverted_call;
  const edCost = fullDiv * C.cost_per_ed_visit;
  const totalImpact = agencyCost + edCost;
  const priced = priceForPop(pop, discount/100);
  const ongoing = priced.effectivePrice;
  const oneTime = buildExtras(pop, depth, modules);
  const year1Total = ongoing + oneTime;
  const ratio = year1Total > 0 ? agencyCost / year1Total : 0;
  const implDays = C.impl_days[depth] || 60;
  const recoveryDays = agencyCost > 0 ? (year1Total / agencyCost) * 365 : 0;
  const paybackMo = (implDays + recoveryDays) / 30.4;
  const threeYr = agencyCost * 3 - (year1Total + 2 * ongoing);
  return { divs: Math.round(diversions), unitDays: Math.round(unitDays),
    agencyCost: Math.round(agencyCost), totalImpact: Math.round(totalImpact),
    ongoing: Math.round(ongoing), oneTime: Math.round(oneTime), year1Total: Math.round(year1Total),
    ratio: Math.round(ratio), paybackMo: paybackMo.toFixed(1), threeYr: Math.round(threeYr) };
}

function row(label, r) {
  console.log(`${label.padEnd(38)} divs=${String(r.divs).padStart(5)} unitDays=${String(r.unitDays).padStart(4)} agencySave=${fmtUSD(r.agencyCost).padStart(7)} total=${fmtUSD(r.totalImpact).padStart(7)} y1=${fmtUSD(r.year1Total).padStart(6)} (ARR=${fmtUSD(r.ongoing).padStart(5)} + impl=${fmtUSD(r.oneTime).padStart(5)}) ratio=${r.ratio}:1 pay=${r.paybackMo}mo 3yr=${fmtUSD(r.threeYr).padStart(7)}`);
}

console.log('\n=== BASELINE: 500K pop, suburban, parallel, PATH+APM, 0% discount, Expected ===');
row('baseline', run());

console.log('\n=== SCENARIO ===');
['Conservative','Expected','Aspirational'].forEach(sc => row(sc, run({scenario:sc})));

console.log('\n=== POPULATION ===');
[100000, 250000, 500000, 1000000, 2000000].forEach(p => row(`pop ${p}`, run({pop:p})));

console.log('\n=== CAD DEPTH (now reactive) ===');
['parallel','uni','bi'].forEach(d => row(d, run({depth:d})));

console.log('\n=== MODULES (now reactive) ===');
[[], ['path'], ['apm'], ['path','apm'], ['path','apm','terf'], ['path','apm','terf','vamc']].forEach(m => row(`mods=[${m.join(',') || 'none'}]`, run({modules:m})));

console.log('\n=== DISCOUNT (clamped at 20%) ===');
[0, 10, 20, 30].forEach(d => row(`discount=${d}%`, run({discount:d})));

console.log('\n=== MEDICAL OVERRIDE (with sanity gating) ===');
[null, 50000, 86000, 200000].forEach(m => {
  const r = run({userMedicalCalls:m});
  const label = `calls=${m}${rateWarn(m, 500000)}`;
  console.log(`${label.padEnd(38)} divs=${String(r.divs).padStart(5)} agencySave=${fmtUSD(r.agencyCost).padStart(7)} y1=${fmtUSD(r.year1Total).padStart(6)} ratio_raw=${r.ratio}:1 ratio_display=${fmtRatio(r.ratio)}`);
});

console.log('\n=== AREA TYPE (affects unit-days only) ===');
['rural','suburban','urban'].forEach(a => row(a, run({area:a})));

console.log('\n=== ANCHOR CHECK (per memory: $345K CO Springs, $446K Anchorage) ===');
console.log('Sanity: 500K pop, bi-CAD, all modules (PATH+APM+TERF+VAMC), 0% discount');
row('500K full-stack bi', run({pop:500000, depth:'bi', modules:['path','apm','terf','vamc']}));
row('800K full-stack bi', run({pop:800000, depth:'bi', modules:['path','apm','terf','vamc']}));
