/* calculator.js — petcarenumbers.com (Pet Care Numbers)
 * Tools: dogAge · catAge · dogFood · catFood · puppyWeight · petPregnancy · chocolate · petInsurance · vetCost · petCost
 *
 * DATA — assets/pet-data.js (window.PETDATA), parsed by build/d7_pet-insurance-breed-cost.py from sources saved in
 * build/data/wave3/pet-insurance-breed-cost/, all fetched 2026-09-16:
 *   · Dog age chart: PetMD, "How Old Is My Dog in Human Years?", Jennifer Coates, DVM, published Dec. 13, 2024
 *     https://www.petmd.com/dog/general-health/how-old-is-my-dog-in-human-years (chart image, transcribed cell by
 *     cell; identical to the AKC chart). Sizes: small ≤20 lb, medium 21–50 lb, large 51–100 lb, giant >100 lb.
 *   · Epigenetic dog age: Wang T, et al. Quantitative Translation of Dog-to-Human Aging by Conserved Remodeling of the
 *     DNA Methylome. Cell Systems 2020;11(2):176-185.e6. doi:10.1016/j.cels.2020.06.006 —
 *     human_age = 16·ln(dog_age) + 31, fitted on Labrador retrievers aged 0.1–16 years.
 *   · Cat age: International Cat Care, "How to tell your cat's age in human years" (updated 28 Nov 2025)
 *     https://icatcare.org/articles/how-to-tell-your-cats-age-in-human-years — table to 25 years, +4 per year after.
 *     Life stages: 2021 AAHA/AAFP Feline Life Stage Guidelines (JAAHA 2021;57:51–72) — kitten <1, young adult 1–6,
 *     mature adult 7–10, senior >10.
 *   · Calories: Merck Veterinary Manual, Nutritional Requirements of Small Animals (last updated Sept 2024) —
 *     RER = 70 × kg^0.75; table "Daily Maintenance Energy Requirements for Dogs and Cats" (dogs: intact 1.8,
 *     neutered 1.6, obesity prone 1.4, puppy <4 mo 3, >4 mo 2; cats: intact 1.4, neutered 1.2, obesity prone 1,
 *     kitten 2.5). The Ohio State University Veterinary Medical Center, Basic Calorie Calculator, Table 1 — weight
 *     loss 1.0 × RER for ideal weight; active/working dogs 2.0–5.0 × RER. 2021 AAHA Nutrition and Weight Management
 *     Guidelines — treats and other extras ≤10% of daily calories.
 *   · Gestation: Merck Veterinary Manual, table "Approximate Gestation Periods" (dog 58–72 d from breeding at an
 *     unknown stage of estrus, 62–64 d from ovulation; cat 65 d) and "Breeding Management of Bitches" (Jul 2025:
 *     64–66 d after the LH peak; 56–58 d after the first day of diestrus).
 *   · Chocolate: Merck Veterinary Manual, "Chocolate Toxicosis in Animals" (last updated Feb 2026) — methylxanthine
 *     (theobromine + caffeine) content per gram by chocolate type; 15.5 mg/g × cocoa % for labelled bars; mild signs
 *     at 20 mg/kg, cardiotoxic effects at 40–50 mg/kg, seizures at ≥60 mg/kg. Phone numbers from the ASPCA Animal
 *     Poison Control Center and Pet Poison Helpline sites.
 *   · Insurance: NAPHIA State of the Industry Report 2026 highlights (June 21, 2026) — U.S. average annual premium
 *     per pet, 2025 (accident & illness dog $836 / cat $435; accident only $190 / $112; with embedded wellness
 *     $1,414 / $859).
 *   · Costs: ASPCA, "Cutting Pet Care Costs", 2021 update — annual, one-time and special costs for a dog and a cat.
 *   · Breed weights: Andersson L, et al. Exploration of body weight in 115 000 young adult dogs of 72 breeds.
 *     Scientific Reports 2023, Table 1 (Swedish hip-screening programme 2007–2016, dogs 12–24 months old, 18–30 for
 *     giant breeds). Two printed female weights are impossible (Alaskan Malamute 1.1 kg, American Staffordshire
 *     Terrier 233.5 kg, same on the publisher's page) and are withheld.
 * ASSUMPTIONS the user controls, labelled on the page: the food's calories per cup/can/kg (from its label), the
 * activity factor for working dogs (2–5), meals per day, the policy's deductible, reimbursement share, annual limit
 * and premium, the vet bills in a year, any cost line the user overrides, and the years of ownership.
 * NOT BUILT: medication dosing and grape/raisin tools (by instruction). No tool says a chocolate dose is safe.
 */
(function (root, factory) {
  const C = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = C; else root.CALCS = C;
})(typeof self !== 'undefined' ? self : this, function (root) {
  let DATA = root && root.PETDATA;
  const r2 = n => Math.round(n * 100) / 100;
  const r1 = n => Math.round(n * 10) / 10;
  const KG_PER_LB = 0.45359237;
  const G_PER_OZ = 28.349523125;
  const toKg = (w, unit) => unit === 'kg' ? (w || 0) : (w || 0) * KG_PER_LB;
  const noData = { warnings: ['The reference data did not load. Reload the page.'] };

  // ── pure helpers ─────────────────────────────────────────────────────────
  const rer = kg => DATA.energy.rer.coef * Math.pow(kg, DATA.energy.rer.exp);
  // straight-line reading between two published rows; xs ascending
  function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    return null;
  }
  function sizeFromLb(lb) {
    const m = DATA.dogAge.chart.sizeMaxLb;
    return lb <= m.small ? 'small' : lb <= m.medium ? 'medium' : lb <= m.large ? 'large' : 'giant';
  }
  function dogChartAge(years, size) {
    const c = DATA.dogAge.chart;
    if (years < c.ages[0] || years > c.ages[c.ages.length - 1]) return null;
    return interp(c.ages, c.human[size], years);
  }
  function dogEpigeneticAge(years) {
    const e = DATA.dogAge.epigenetic;
    return years >= e.minAge ? e.a * Math.log(years) + e.b : null;
  }
  function catHumanAge(months) {
    const t = DATA.catAge.table, last = t[t.length - 1];
    if (months >= last.months) return last.human + (months - last.months) / 12 * DATA.catAge.perYearAfter2;
    return interp([0, ...t.map(r => r.months)], [0, ...t.map(r => r.human)], months);
  }
  function catIcatStage(months) {
    const t = DATA.catAge.table;
    let s = t[0].stage;
    for (const r of t) if (months >= r.months) s = r.stage;
    return s;
  }
  function catAahaStage(years) {
    const s = DATA.catAge.stages;
    return years < s.kittenBelow ? 'Kitten' : years < s.youngAdultThrough + 1 ? 'Young adult' : years <= s.matureThrough ? 'Mature adult' : 'Senior';
  }
  function addDays(iso, n) {
    const [y, m, d] = String(iso).split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.toISOString().slice(0, 10);
  }
  const validDate = iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) && !isNaN(Date.parse(iso + 'T00:00:00Z'));
  const longDate = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  function chocolateMgPerG(type, cocoaPct) {
    const c = DATA.chocolate;
    if (type === 'labelPct') { const v = c.unsweetenedMgPerG * Math.min(100, Math.max(0, cocoaPct || 0)) / 100; return [v, v]; }
    return c.types[type].mgPerG;
  }
  function chocolateBand(mgkg) {
    const t = DATA.chocolate.thresholds;
    return mgkg >= t.seizure ? 'seizure' : mgkg >= t.cardioLow ? 'cardio' : mgkg >= t.mild ? 'mild' : 'belowMild';
  }
  function reimbursement({ bills, deductible, pct, limit }) {
    const after = Math.max(0, (bills || 0) - (deductible || 0)) * (pct || 0) / 100;
    return limit > 0 ? Math.min(limit, after) : after;
  }

  // ── dog age ──────────────────────────────────────────────────────────────
  const sizeOptions = () => DATA ? Object.entries(DATA.dogAge.chart.sizes).map(([k, v]) => ({ value: k, label: `${k[0].toUpperCase()}${k.slice(1)} (${v})` })) : [];
  const dogAge = {
    title: 'Dog age calculator',
    inputs: [
      { id: 'years', label: 'Dog’s age: years', type: 'number', default: 5, min: 0, max: 30 },
      { id: 'months', label: 'and months', type: 'number', default: 0, min: 0, max: 11 },
      { id: 'size', label: 'Size when grown', type: 'select', default: 'medium', options: sizeOptions },
      { id: 'weightLb', label: 'Or adult weight (sets the size)', type: 'number', suffix: 'lb', default: null, min: 1, max: 350, help: 'Leave blank to use the size you picked.' },
    ],
    compute(v, fmt) {
      if (!DATA) return noData;
      const years = (v.years || 0) + (v.months || 0) / 12;
      const size = v.weightLb ? sizeFromLb(v.weightLb) : (v.size || 'medium');
      const chart = dogChartAge(years, size), epi = dogEpigeneticAge(years);
      const c = DATA.dogAge.chart, e = DATA.dogAge.epigenetic;
      const summary = [
        { label: `Size-chart method (${size}, ${c.sizes[size]})`, value: chart == null ? (years < c.ages[0] ? 'Chart starts at 1 year' : `Chart ends at ${c.ages[c.ages.length - 1]} years`) : `${Math.round(chart)} human years`, strong: true },
        { label: 'DNA-methylation formula (Wang et al. 2020)', value: epi == null ? `Not defined under ${e.minAge} years` : `${Math.round(epi)} human years` },
        { label: 'Old “multiply by 7” rule, for comparison', value: `${Math.round(years * 7)} human years` },
      ];
      const notes = [
        `Size chart: ${c.source}, published ${c.published}. It lists whole years 1–${c.ages[c.ages.length - 1]}; ages in between are read on a straight line between two rows.`,
        `Formula: human age = ${e.a} × ln(dog age) + ${e.b}, from ${e.citation}. It was fitted on ${e.breed || 'one breed'} aged ${e.minAge}–${e.maxAge} years and does not adjust for size.`,
      ];
      if (years > e.maxAge) notes.push(`This age is past the oldest dogs in the Wang et al. study (${e.maxAge} years), so the formula is extended beyond its data.`);
      notes.push('Both methods are rules of thumb for comparing life stages, not a health assessment. Your veterinarian judges your dog’s senior care needs.');
      return {
        raw: { years: r2(years), size, chart: chart == null ? null : r2(chart), epigenetic: epi == null ? null : r2(epi) },
        summary,
        rows: c.ages.map((a, i) => ({ label: `${a} year${a > 1 ? 's' : ''}`, value: `${c.human[size][i]} (chart) · ${Math.round(dogEpigeneticAge(a))} (formula)` })),
        notes,
      };
    },
  };

  // ── cat age ──────────────────────────────────────────────────────────────
  const catAge = {
    title: 'Cat age calculator',
    inputs: [
      { id: 'years', label: 'Cat’s age: years', type: 'number', default: 8, min: 0, max: 40 },
      { id: 'months', label: 'and months', type: 'number', default: 0, min: 0, max: 11 },
    ],
    compute(v, fmt) {
      if (!DATA) return noData;
      const months = (v.years || 0) * 12 + (v.months || 0);
      const human = catHumanAge(months);
      const a = DATA.catAge;
      return {
        raw: { months, human: r2(human), icatStage: catIcatStage(months), aahaStage: catAahaStage(months / 12) },
        summary: [
          { label: 'Age in human years', value: `${Math.round(human)}`, strong: true },
          { label: 'Life stage (AAHA/AAFP 2021)', value: catAahaStage(months / 12) },
          { label: 'Life stage (International Cat Care chart)', value: catIcatStage(months) },
        ],
        rows: a.table.filter(r => r.months >= 12 && r.months % 12 === 0).map(r => ({ label: `${r.months / 12} year${r.months > 12 ? 's' : ''}`, value: `${r.human} human years` })),
        notes: [
          `Human-age equivalents: ${a.source} (updated ${a.updated}) — the first two years equal 24 human years, then ${a.perYearAfter2} for each year. Ages between two rows of its table are read on a straight line.`,
          `Life stages: ${a.stages.source} — kitten under 1 year, young adult 1–6, mature adult 7–10, senior over 10. The guidelines recommend at least yearly exams, and at least every 6 months for senior cats.`,
        ],
      };
    },
  };

  // ── food and calories ────────────────────────────────────────────────────
  const DOG_STAGES = [
    { value: 'neutered', label: 'Adult, spayed or neutered' },
    { value: 'intact', label: 'Adult, not spayed or neutered' },
    { value: 'obesityProne', label: 'Adult, gains weight easily' },
    { value: 'puppyUnder4', label: 'Puppy under 4 months' },
    { value: 'puppyOver4', label: 'Puppy 4 months to adult' },
    { value: 'weightLoss', label: 'Weight loss (enter the ideal weight your vet set)' },
    { value: 'active', label: 'Active or working dog (you choose 2–5)' },
  ];
  const CAT_STAGES = [
    { value: 'neutered', label: 'Adult, spayed or neutered' },
    { value: 'intact', label: 'Adult, not spayed or neutered' },
    { value: 'obesityProne', label: 'Adult, gains weight easily' },
    { value: 'kitten', label: 'Kitten' },
  ];
  function feeding(v, species) {
    const E = DATA.energy;
    const kg = toKg(v.weight, v.unit);
    let factor, factorNote;
    if (species === 'dog' && v.stage === 'weightLoss') { factor = E.osu.weightLoss; factorNote = 'OSU Veterinary Medical Center: 1.0 × RER for the ideal weight'; }
    else if (species === 'dog' && v.stage === 'active') { factor = Math.min(E.osu.activeHigh, Math.max(E.osu.activeLow, v.factor || E.osu.activeLow)); factorNote = `OSU Veterinary Medical Center: ${E.osu.activeLow}–${E.osu.activeHigh} × RER for active and working dogs (you chose ${factor})`; }
    else { factor = E[species][v.stage]; factorNote = `Merck Veterinary Manual maintenance factor ${factor} × RER`; }
    const R = rer(kg), kcal = R * factor;
    const treatKcal = v.treats ? kcal * E.treatMaxShare : 0, foodKcal = kcal - treatKcal;
    const perUnit = v.kcal || 0;
    let portion = null, unitLabel = '';
    if (perUnit > 0) {
      if (v.foodUnit === 'kg') { portion = foodKcal / perUnit * 1000; unitLabel = 'grams'; }
      else if (v.foodUnit === 'can') { portion = foodKcal / perUnit; unitLabel = 'cans'; }
      else { portion = foodKcal / perUnit; unitLabel = 'cups'; }
    }
    const meals = Math.max(1, Math.round(v.meals || 1));
    return { kg, R, factor, factorNote, kcal, treatKcal, foodKcal, portion, unitLabel, meals };
  }
  function feedingResult(f, v, fmt, species) {
    const E = DATA.energy;
    const summary = [{ label: 'Calories per day', value: `${Math.round(f.kcal)} kcal`, strong: true }];
    if (f.portion != null) {
      const dp = f.unitLabel === 'grams' ? 0 : 2;
      const show = n => f.unitLabel === 'grams' ? `${Math.round(n)} g` : `${n.toFixed(dp)} ${f.unitLabel}`;
      summary.push({ label: v.treats ? 'Food per day (90% of calories)' : 'Food per day', value: show(f.portion), strong: true });
      if (f.meals > 1) summary.push({ label: `Per meal (${f.meals} meals)`, value: show(f.portion / f.meals) });
    }
    if (v.treats) summary.push({ label: 'Treats and extras, at most', value: `${Math.round(f.treatKcal)} kcal a day` });
    summary.push({ label: 'Resting energy requirement (RER)', value: `${Math.round(f.R)} kcal` });
    const notes = [
      `RER = ${E.rer.coef} × body weight in kg^${E.rer.exp} = ${E.rer.coef} × ${r2(f.kg)}^${E.rer.exp} (Merck Veterinary Manual, updated ${E.sources.merck.updated}). Daily calories = RER × ${f.factor} (${f.factorNote}).`,
      'Merck notes that any calorie calculation is only a starting point, and OSU says individual pets can differ by as much as 50%. Weigh your pet every few weeks and adjust with your veterinarian to keep a healthy body condition.',
    ];
    if (f.portion == null) notes.unshift(`Enter the calories per ${v.foodUnit === 'kg' ? 'kilogram' : v.foodUnit === 'can' ? 'can' : 'cup'} printed on your food’s label to turn calories into an amount of food.`);
    if (v.treats) notes.push(`Treats: the 2021 AAHA Nutrition and Weight Management Guidelines advise keeping treats and other extras to 10% or less of daily calories, with the complete diet making up at least 90%.`);
    if (species === 'cat' && v.stage === 'kitten') notes.push('Merck notes kittens can alternatively be fed free choice.');
    return {
      raw: { kg: r2(f.kg), rer: r2(f.R), factor: f.factor, kcal: r2(f.kcal), treatKcal: r2(f.treatKcal), foodKcal: r2(f.foodKcal), portion: f.portion == null ? null : r2(f.portion), perMeal: f.portion == null ? null : r2(f.portion / f.meals) },
      summary, notes,
    };
  }
  const foodInputs = (species, def) => [
    { id: 'unit', label: 'Weight unit', type: 'radio', default: 'lb', options: [{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }] },
    { id: 'weight', label: `Your ${species}’s weight`, type: 'number', default: def.weight, min: 0.1, max: 400, step: 0.1 },
    { id: 'stage', label: 'Life stage', type: 'select', default: 'neutered', options: species === 'dog' ? DOG_STAGES : CAT_STAGES },
    ...(species === 'dog' ? [{ id: 'factor', label: 'Activity factor (your choice, 2 to 5)', type: 'number', default: 2, min: 2, max: 5, step: 0.1, showIf: s => s.stage === 'active', help: 'OSU lists 2.0–5.0 × RER for active and working dogs. Start low and adjust with your vet.' }] : []),
    { id: 'foodUnit', label: 'Your food’s calories are listed per', type: 'select', default: def.foodUnit, options: [{ value: 'cup', label: 'cup (8 oz measuring cup)' }, { value: 'can', label: 'can' }, { value: 'kg', label: 'kilogram (kcal/kg)' }] },
    { id: 'kcal', label: 'Calories from the label (kcal per cup, can or kg)', type: 'number', default: null, min: 1, max: 10000, help: 'Pet food labels print a calorie statement such as “3,600 kcal/kg, 380 kcal/cup”.' },
    { id: 'treats', label: 'Leave room for treats (up to 10% of calories)', type: 'checkbox', default: true },
    { id: 'meals', label: 'Meals per day', type: 'number', default: 2, min: 1, max: 6 },
  ];
  const dogFood = {
    title: 'Dog food calculator',
    inputs: foodInputs('dog', { weight: 30, foodUnit: 'cup' }),
    compute(v, fmt) { if (!DATA) return noData; return feedingResult(feeding(v, 'dog'), v, fmt, 'dog'); },
  };
  const catFood = {
    title: 'Cat food calculator',
    inputs: foodInputs('cat', { weight: 10, foodUnit: 'cup' }),
    compute(v, fmt) { if (!DATA) return noData; return feedingResult(feeding(v, 'cat'), v, fmt, 'cat'); },
  };

  // ── puppy weight (breed averages) ────────────────────────────────────────
  const breedOptions = () => DATA ? DATA.breeds.rows.map(b => ({ value: b.breed, label: b.breed })).sort((a, b) => a.label.localeCompare(b.label)) : [];
  const puppyWeight = {
    title: 'Puppy weight calculator',
    inputs: [
      { id: 'breed', label: 'Breed', type: 'select', default: 'Labrador Retriever', options: breedOptions },
      { id: 'sex', label: 'Sex', type: 'radio', default: 'male', options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] },
      { id: 'unit', label: 'Weight unit', type: 'radio', default: 'lb', options: [{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }] },
      { id: 'current', label: 'Puppy’s weight today (optional)', type: 'number', default: null, min: 0.1, max: 300, step: 0.1 },
    ],
    compute(v, fmt) {
      if (!DATA) return noData;
      const b = DATA.breeds.rows.find(r => r.breed === v.breed) || DATA.breeds.rows[0];
      const kg = b[v.sex === 'female' ? 'female' : 'male'];
      if (kg == null) {
        return { raw: { kg: null }, warnings: [`The study’s published table misprints the ${v.sex} weight for the ${b.breed}, so it is not shown. Try the other sex or ask your veterinarian.`],
          notes: [`Source: ${DATA.breeds.source}.`] };
      }
      const lb = kg / KG_PER_LB;
      const curKg = v.current ? toKg(v.current, v.unit) : null;
      const summary = [
        { label: `Average young-adult weight, ${v.sex} ${b.breed}`, value: v.unit === 'kg' ? `${kg} kg (${r1(lb)} lb)` : `${r1(lb)} lb (${kg} kg)`, strong: true },
        { label: 'Dogs measured', value: fmt.num(b[v.sex === 'female' ? 'nFemale' : 'nMale']) },
        { label: 'Age when weighed', value: b.screenedAt },
      ];
      if (curKg) summary.push({ label: 'Your puppy today, as a share of that average', value: fmt.pct(curKg / kg * 100) });
      return {
        raw: { kg, lb: r2(lb), share: curKg ? r2(curKg / kg * 100) : null },
        summary,
        notes: [
          `This is the breed average, not a forecast for your puppy: individual dogs vary around it, and parents’ size, sex, neutering and diet all matter. Source: ${DATA.breeds.source}.`,
          'The study weighed dogs in Sweden’s hip-screening programme, so it covers 72 mostly medium to giant breeds and no toy or small breeds. For a mixed-breed puppy, or to check growth, ask your veterinarian to chart your puppy’s weight at each visit.',
          'A growing puppy’s weight share is not linear with age: large and giant breeds keep growing for longer than small breeds.',
        ],
      };
    },
  };

  // ── pregnancy due date ───────────────────────────────────────────────────
  const BASIS = [
    { value: 'breeding', label: 'Breeding date (timing of ovulation unknown)' },
    { value: 'ovulation', label: 'Ovulation date (from progesterone testing)' },
    { value: 'lhPeak', label: 'LH surge date (from hormone testing)' },
    { value: 'diestrus', label: 'First day of diestrus (from vaginal cytology)' },
  ];
  const petPregnancy = {
    title: 'Dog pregnancy due date calculator',
    inputs: [
      { id: 'species', label: 'Animal', type: 'radio', default: 'dog', options: [{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }] },
      { id: 'basis', label: 'Count from', type: 'select', default: 'breeding', options: BASIS, showIf: s => s.species !== 'cat' },
      { id: 'date', label: 'Date', type: 'date', default: '' },
    ],
    compute(v, fmt) {
      if (!DATA) return noData;
      const G = DATA.gestation;
      if (!validDate(v.date)) return { raw: { earliest: null, latest: null }, summary: [{ label: 'Due date', value: 'Enter a date to see the window', strong: true }], notes: ['Dates are counted in calendar days.'] };
      if (v.species === 'cat') {
        const d = addDays(v.date, G.cat.approx);
        return {
          raw: { earliest: d, latest: d, days: [G.cat.approx, G.cat.approx] },
          summary: [{ label: 'Approximate due date', value: longDate(d), strong: true }, { label: 'Days from breeding', value: `about ${G.cat.approx}` }],
          notes: [`Merck Veterinary Manual, “Approximate Gestation Periods”: cat, ${G.cat.approx} days. The manual gives one approximate figure, so expect kittens around this date rather than on it.`, 'Your veterinarian can confirm the pregnancy and estimate the stage by ultrasound.'],
        };
      }
      const basis = G.dog[v.basis] ? v.basis : 'breeding';
      const [lo, hi] = G.dog[basis];
      const earliest = addDays(v.date, lo), latest = addDays(v.date, hi);
      const label = BASIS.find(b => b.value === basis).label.split(' (')[0].toLowerCase();
      const notes = [`Merck Veterinary Manual: whelping comes ${lo}–${hi} days after the ${label}.`];
      if (basis === 'breeding') notes.push('Counting from a breeding date gives the widest window because sperm can survive for days and the breeding may not match ovulation. Merck says that ovulation timing (progesterone or LH testing) is needed to predict the date closely.');
      notes.push('Plan with your veterinarian: X-rays after about day 55 of pregnancy are the best way to count puppies, and a planned C-section needs an accurate date.');
      return {
        raw: { earliest, latest, days: [lo, hi] },
        summary: [
          { label: 'Due date window', value: `${longDate(earliest)} – ${longDate(latest)}`, strong: true },
          { label: `Days after the ${label}`, value: `${lo}–${hi}` },
        ],
        notes,
      };
    },
  };

  // ── chocolate ────────────────────────────────────────────────────────────
  const CHOC = [
    { value: 'milk', label: 'Milk chocolate' },
    { value: 'semisweetDark', label: 'Semisweet or sweet dark chocolate' },
    { value: 'labelPct', label: 'Dark chocolate bar with a cocoa % on the label' },
    { value: 'unsweetened', label: 'Unsweetened (baker’s) chocolate' },
    { value: 'cocoaPowder', label: 'Cocoa powder' },
    { value: 'hulls', label: 'Cocoa bean hull mulch' },
    { value: 'white', label: 'White chocolate' },
  ];
  const BAND_TEXT = {
    belowMild: t => `Below the ${t.mild} mg/kg level at which the Merck Veterinary Manual says mild signs may occur. This does not mean the amount is safe: chocolate products vary, and dogs vary in how they react.`,
    mild: t => `At or above ${t.mild} mg/kg, where the Merck Veterinary Manual says mild signs (vomiting, diarrhea, increased thirst) may occur.`,
    cardio: t => `At or above ${t.cardioLow} mg/kg; the Merck Veterinary Manual lists heart effects at ${t.cardioLow}–${t.cardioHigh} mg/kg.`,
    seizure: t => `At or above ${t.seizure} mg/kg, the level the Merck Veterinary Manual links to seizures.`,
  };
  const chocolate = {
    title: 'Dog chocolate toxicity calculator',
    inputs: [
      { id: 'unit', label: 'Weight unit', type: 'radio', default: 'lb', options: [{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }] },
      { id: 'weight', label: 'Dog’s weight', type: 'number', default: 20, min: 0.5, max: 350, step: 0.1 },
      { id: 'type', label: 'Type of chocolate', type: 'select', default: 'milk', options: CHOC },
      { id: 'cocoaPct', label: 'Cocoa % on the label', type: 'number', suffix: '%', default: 70, min: 1, max: 100, showIf: s => s.type === 'labelPct' },
      { id: 'amount', label: 'Amount eaten (your best estimate; if unsure, use the most it could have been)', type: 'number', default: 2, min: 0, step: 0.1 },
      { id: 'amountUnit', label: 'Amount unit', type: 'radio', default: 'oz', options: [{ value: 'oz', label: 'ounces' }, { value: 'g', label: 'grams' }] },
    ],
    compute(v, fmt) {
      if (!DATA) return noData;
      const c = DATA.chocolate, t = c.thresholds, k = c.contacts;
      const kg = toKg(v.weight, v.unit);
      const grams = (v.amount || 0) * (v.amountUnit === 'g' ? 1 : G_PER_OZ);
      const [lo, hi] = chocolateMgPerG(v.type, v.cocoaPct);
      const mgLo = grams * lo, mgHi = grams * hi;
      const perLo = kg > 0 ? mgLo / kg : 0, perHi = kg > 0 ? mgHi / kg : 0;
      const band = chocolateBand(perHi);
      const call = `Call your veterinarian, the ${k.aspca.name} at ${k.aspca.phone}, or the ${k.pph.name} at ${k.pph.phone} now, whatever this number says.`;
      const range = (a, b, d) => a === b ? `${a.toFixed(d)}` : `${a.toFixed(d)}–${b.toFixed(d)}`;
      return {
        raw: { kg: r2(kg), grams: r2(grams), mgLow: r2(mgLo), mgHigh: r2(mgHi), mgPerKgLow: r2(perLo), mgPerKgHigh: r2(perHi), band },
        summary: [
          { label: 'What to do now', value: call, strong: true },
          { label: 'Theobromine + caffeine eaten (estimate)', value: `${range(mgLo, mgHi, 0)} mg`, strong: true },
          { label: 'Dose per kg of body weight', value: `${range(perLo, perHi, 1)} mg/kg` },
          { label: 'Compared with the Merck Veterinary Manual', value: BAND_TEXT[band](t) },
        ],
        rows: [
          { label: 'Mild signs may occur', value: `${t.mild} mg/kg` },
          { label: 'Heart effects', value: `${t.cardioLow}–${t.cardioHigh} mg/kg` },
          { label: 'Seizures', value: `${t.seizure} mg/kg and above` },
          { label: 'Reported lethal dose for half of dogs (LD50)', value: `${t.ld50Low}–${t.ld50High} mg/kg — severe signs and death can occur far lower` },
        ],
        notes: [
          call,
          'This calculator cannot tell you a dose is safe. Signs can take hours to appear, and treatment works best early; the poison-control experts and your veterinarian decide what your dog needs.',
          `Both poison lines are open 24/7 and charge a fee (${k.pph.name}: ${k.pph.fee}; ${k.aspca.name}: ${k.aspca.fee}).`,
          `Content per gram: ${c.source}, last updated ${c.updated}. ${v.type === 'labelPct' ? `A labelled bar is estimated as ${c.unsweetenedMgPerG} mg/g × cocoa %, the manual’s own method.` : `${c.types[v.type].label}: ${range(lo, hi, 2)} mg/g.`} Real products vary by brand and cocoa bean.`,
          v.type === 'white' ? 'White chocolate has very little theobromine, but its fat and sugar can still upset a dog’s stomach; call anyway.' : v.type === 'hulls' ? 'Some cocoa bean hull mulches have had methylxanthines removed and some have not; check the bag and call.' : 'Wrappers, raisins, nuts, xylitol and other ingredients can add their own dangers; tell the vet exactly what the product was.',
        ],
      };
    },
  };

  // ── pet insurance ────────────────────────────────────────────────────────
  const PLANS = [
    { value: 'accidentIllness', label: 'Accident and illness' },
    { value: 'accidentOnly', label: 'Accident only' },
    { value: 'wellness', label: 'Accident and illness with wellness cover' },
  ];
  const petInsurance = {
    title: 'Pet insurance cost calculator',
    inputs: [
      { id: 'species', label: 'Pet', type: 'radio', default: 'dog', options: [{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }] },
      { id: 'plan', label: 'Plan type', type: 'select', default: 'accidentIllness', options: PLANS },
      { id: 'premiumMode', label: 'Premium', type: 'radio', default: 'average', options: [{ value: 'average', label: 'U.S. average (NAPHIA 2025)' }, { value: 'monthly', label: 'My quote per month' }, { value: 'annual', label: 'My quote per year' }] },
      { id: 'premium', label: 'Your quoted premium', type: 'number', prefix: '$', default: 60, min: 0, showIf: s => s.premiumMode !== 'average' },
      { id: 'deductible', label: 'Annual deductible (from your policy)', type: 'number', prefix: '$', default: 250, min: 0 },
      { id: 'pct', label: 'Reimbursement rate (from your policy)', type: 'select', default: '80', options: ['50', '60', '70', '80', '90', '100'].map(p => ({ value: p, label: `${p}%` })) },
      { id: 'limit', label: 'Annual limit (0 = unlimited)', type: 'number', prefix: '$', default: 0, min: 0 },
      { id: 'bills', label: 'Vet bills this year that the policy covers (your estimate)', type: 'number', prefix: '$', default: 2000, min: 0 },
      { id: 'uncovered', label: 'Other vet costs the policy does not cover (your estimate)', type: 'number', prefix: '$', default: 0, min: 0, help: 'For example pre-existing conditions, exam fees on some plans, or routine care on plans without wellness cover.' },
    ],
    compute(v, fmt) {
      if (!DATA) return noData;
      const I = DATA.insurance;
      const avg = (I.annual[v.plan] || I.annual.accidentIllness)[v.species === 'cat' ? 'cat' : 'dog'];
      const premium = v.premiumMode === 'monthly' ? (v.premium || 0) * 12 : v.premiumMode === 'annual' ? (v.premium || 0) : avg;
      const pct = Number(v.pct) || 0;
      const back = reimbursement({ bills: v.bills, deductible: v.deductible, pct, limit: v.limit });
      const vet = (v.bills || 0) + (v.uncovered || 0);
      const insured = premium + vet - back, uninsured = vet;
      const diff = uninsured - insured;
      const breakEven = pct > 0 ? (v.deductible || 0) + premium / (pct / 100) : null;
      const capped = v.limit > 0 && breakEven != null && (breakEven - (v.deductible || 0)) * pct / 100 > v.limit;
      return {
        raw: { premium: r2(premium), reimbursed: r2(back), insured: r2(insured), uninsured: r2(uninsured), difference: r2(diff), breakEven: breakEven == null || capped ? null : r2(breakEven) },
        summary: [
          { label: diff >= 0 ? 'Insurance saves you this year' : 'Insurance costs you more this year by', value: fmt.money0(Math.abs(diff)), strong: true },
          { label: 'You pay with insurance (premium + vet bills − reimbursement)', value: fmt.money0(insured) },
          { label: 'You pay without insurance', value: fmt.money0(uninsured) },
          { label: 'Insurer reimburses', value: fmt.money0(back) },
          { label: 'Yearly premium', value: `${fmt.money0(premium)} (${fmt.money(premium / 12)} a month)` },
          { label: 'Covered bills at which the policy pays for itself', value: breakEven == null ? '—' : capped ? 'Never within the annual limit' : fmt.money0(breakEven) },
        ],
        rows: [
          { label: 'Covered vet bills', value: fmt.money0(v.bills || 0) },
          { label: 'Minus deductible', value: `− ${fmt.money0(Math.min(v.bills || 0, v.deductible || 0))}` },
          { label: `× ${pct}% reimbursement`, value: fmt.money0(Math.max(0, (v.bills || 0) - (v.deductible || 0)) * pct / 100) },
          ...(v.limit > 0 ? [{ label: 'Capped at the annual limit', value: fmt.money0(v.limit) }] : []),
          { label: 'Reimbursed', value: fmt.money0(back), total: true },
        ],
        notes: [
          v.premiumMode === 'average'
            ? `Premium: U.S. average annual premium per ${v.species === 'cat' ? 'cat' : 'dog'} for ${PLANS.find(p => p.value === v.plan).label.toLowerCase()} plans in 2025, ${fmt.money0(avg)} — ${I.source}, published ${I.published}. Your own quote depends on breed, age, location and the options you choose; use it for a real comparison.`
            : 'Premium: the quote you entered.',
          'Method: (covered bills − annual deductible) × reimbursement rate, capped at the annual limit. Some policies use a per-condition deductible, waiting periods, or exclusions; read your policy’s own terms.',
          v.plan === 'wellness' ? 'Wellness cover also pays set amounts for routine care; this calculator does not add those, so enter routine visits as covered bills only if your plan reimburses them this way.' : 'A single year is shown. Insurance is mainly protection against a large, unexpected bill in any year.',
        ],
      };
    },
  };

  // ── vet costs ────────────────────────────────────────────────────────────
  const aspca = (group, key, sp) => DATA.costs[group][key][sp];
  const speciesInput = { id: 'species', label: 'Pet', type: 'radio', default: 'dog', options: [{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }] };
  const vetCost = {
    title: 'Vet cost calculator',
    inputs: [
      speciesInput,
      { id: 'routine', label: 'Wellness visits and vaccines per year (blank = ASPCA figure)', type: 'number', prefix: '$', default: null, min: 0 },
      { id: 'preventive', label: 'Heartworm, flea and tick prevention per year (blank = ASPCA figure)', type: 'number', prefix: '$', default: null, min: 0 },
      { id: 'dental', label: 'Dental cleaning per year (blank = ASPCA figure)', type: 'number', prefix: '$', default: null, min: 0 },
      { id: 'includeDental', label: 'Include a dental cleaning this year', type: 'checkbox', default: true },
      { id: 'firstYear', label: 'First year with this pet (spay/neuter, first vaccines, microchip)', type: 'checkbox', default: false },
      { id: 'extra', label: 'Other vet costs you expect (quotes from your clinic)', type: 'repeater', default: [], addLabel: '+ Add a vet cost', columns: [{ id: 'item', label: 'What' }, { id: 'cost', label: 'Cost ($)', type: 'number' }] },
    ],
    compute(v, fmt) {
      if (!DATA) return noData;
      const sp = v.species === 'cat' ? 'cat' : 'dog';
      const pick = (val, group, key) => val != null ? val : aspca(group, key, sp);
      const lines = [
        { label: 'Wellness visits and vaccines', value: pick(v.routine, 'annual', 'routineMedical'), own: v.routine != null },
        { label: 'Parasite prevention', value: pick(v.preventive, 'annual', 'preventiveMeds'), own: v.preventive != null },
      ];
      if (v.includeDental) lines.push({ label: 'Dental cleaning', value: pick(v.dental, 'special', 'dental'), own: v.dental != null });
      if (v.firstYear) {
        for (const [key, label] of [['spayNeuter', 'Spay or neuter'], ['initialMedical', 'First vaccines and exams'], ['microchip', 'Microchip']]) lines.push({ label, value: aspca('initial', key, sp), own: false });
      }
      for (const e of v.extra || []) if (e && Number(e.cost) > 0) lines.push({ label: e.item || 'Other', value: Number(e.cost), own: true });
      const total = lines.reduce((s, l) => s + l.value, 0);
      return {
        raw: { total: r2(total), monthly: r2(total / 12) },
        summary: [
          { label: 'Vet costs for the year', value: fmt.money0(total), strong: true },
          { label: 'Set aside each month', value: fmt.money(total / 12) },
        ],
        rows: [...lines.map(l => ({ label: `${l.label}${l.own ? ' (your figure)' : ' (ASPCA)'}`, value: fmt.money0(l.value) })), { label: 'Total', value: fmt.money0(total), total: true }],
        notes: [
          `Default figures: ${DATA.costs.source} — typical yearly costs for a ${sp} as published by the ASPCA in its 2021 update. Prices have risen since and vary a lot by region and clinic; replace them with your clinic’s prices.`,
          'Emergency and specialist care is not included unless you add it. Ask your clinic for a written estimate before a planned procedure.',
        ],
      };
    },
  };

  // ── cost of owning a dog or cat ──────────────────────────────────────────
  const ANNUAL = [
    ['food', 'Food'], ['routineMedical', 'Wellness visits and vaccines'], ['preventiveMeds', 'Parasite prevention'], ['litter', 'Litter'],
    ['toys', 'Toys'], ['treats', 'Treats'], ['insurance', 'Pet insurance'], ['license', 'License'], ['groomingSupplies', 'Grooming supplies'],
  ];
  const petCost = {
    title: 'Cost of owning a dog or cat',
    inputs: [
      speciesInput,
      ...ANNUAL.map(([key, label]) => ({ id: key, label: `${label} per year (blank = ASPCA figure)`, type: 'number', prefix: '$', default: null, min: 0, ...(key === 'litter' ? { showIf: s => s.species === 'cat' } : {}) })),
      { id: 'boardingDays', label: 'Days of boarding per year (ASPCA’s total counts one day)', type: 'number', default: 1, min: 0, max: 365 },
      { id: 'boardingRate', label: 'Boarding price per day (blank = ASPCA figure)', type: 'number', prefix: '$', default: null, min: 0 },
      { id: 'initial', label: 'One-time costs: spay/neuter, first vaccines, supplies (blank = ASPCA total)', type: 'number', prefix: '$', default: null, min: 0 },
      { id: 'dental', label: 'Dental cleaning (blank = ASPCA figure)', type: 'number', prefix: '$', default: null, min: 0 },
      { id: 'grooming', label: 'Professional grooming per year (blank = ASPCA figure)', type: 'number', prefix: '$', default: null, min: 0, showIf: s => s.species !== 'cat' },
      { id: 'specialEveryYear', label: 'Count dental and grooming every year (ASPCA counts them in the first year only)', type: 'checkbox', default: false },
      { id: 'years', label: 'Years you expect to have your pet (your estimate)', type: 'number', default: 10, min: 1, max: 30 },
    ],
    compute(v, fmt) {
      if (!DATA) return noData;
      const sp = v.species === 'cat' ? 'cat' : 'dog';
      const pick = (val, group, key) => val != null ? val : aspca(group, key, sp);
      const rows = [];
      let annual = 0;
      for (const [key, label] of ANNUAL) {
        const val = pick(v[key], 'annual', key);
        if (key === 'litter' && sp === 'dog') continue;
        annual += val; rows.push({ label: `${label}${v[key] != null ? ' (your figure)' : ''}`, value: fmt.money0(val) });
      }
      const boarding = (v.boardingDays || 0) * pick(v.boardingRate, 'annual', 'boardingPerDay');
      annual += boarding; rows.push({ label: `Boarding, ${v.boardingDays || 0} day(s)`, value: fmt.money0(boarding) });
      const special = pick(v.dental, 'special', 'dental') + (sp === 'dog' ? pick(v.grooming, 'special', 'professionalGrooming') : 0);
      if (v.specialEveryYear) { annual += special; rows.push({ label: 'Dental and grooming', value: fmt.money0(special) }); }
      rows.push({ label: 'Yearly total', value: fmt.money0(annual), total: true });
      const initial = v.initial != null ? v.initial : DATA.costs.totals.initial[sp];
      const first = annual + initial + (v.specialEveryYear ? 0 : special);
      rows.push({ label: `One-time costs${v.initial != null ? ' (your figure)' : ''}`, value: fmt.money0(initial) });
      if (!v.specialEveryYear) rows.push({ label: 'Dental and grooming (first year)', value: fmt.money0(special) });
      rows.push({ label: 'First-year total', value: fmt.money0(first), total: true });
      const years = Math.max(1, Math.round(v.years || 1));
      const lifetime = first + annual * (years - 1);
      return {
        raw: { annual: r2(annual), firstYear: r2(first), monthly: r2(annual / 12), lifetime: r2(lifetime) },
        summary: [
          { label: 'Cost per year', value: fmt.money0(annual), strong: true },
          { label: 'Per month', value: fmt.money0(annual / 12) },
          { label: 'First year', value: fmt.money0(first) },
          { label: `Over ${years} years`, value: fmt.money0(lifetime) },
        ],
        rows,
        notes: [
          `Default figures: ${DATA.costs.source}. With every default the totals match the ASPCA table (${fmt.money0(DATA.costs.totals.annual[sp])} a year, ${fmt.money0(DATA.costs.totals.firstYear[sp])} in the first year for a ${sp}). They are 2021 prices; replace any line with what you actually pay.`,
          `For comparison, NAPHIA reports that U.S. accident-and-illness insurance averaged ${fmt.money0(DATA.insurance.annual.accidentIllness[sp])} a year per ${sp} in 2025.`,
          'The ASPCA figures do not include emergency care, adoption or purchase price, or pet sitting. The number of years is your own estimate.',
        ],
      };
    },
  };

  return {
    dogAge, catAge, dogFood, catFood, puppyWeight, petPregnancy, chocolate, petInsurance, vetCost, petCost,
    __setData: d => { DATA = d; },
    __pure: { rer: kg => rer(kg), interp, sizeFromLb: lb => sizeFromLb(lb), dogChartAge: (y, s) => dogChartAge(y, s), dogEpigeneticAge: y => dogEpigeneticAge(y), catHumanAge: m => catHumanAge(m), catAahaStage: y => catAahaStage(y), addDays, chocolateMgPerG: (t, p) => chocolateMgPerG(t, p), chocolateBand: x => chocolateBand(x), reimbursement },
    // Fixture: a subset of data/wave3/pet-insurance-breed-cost.json with the same values, so a data refresh never
    // silently changes an expected value. Expected values: build/tests/pet-insurance-breed-cost_expected.py.
    __testData: {
      dogAge: {
        chart: { source: 'PetMD — How Old Is My Dog in Human Years? (Jennifer Coates, DVM)', published: 'Dec. 13, 2024',
          sizes: { small: '20 lb or less', medium: '21–50 lb', large: '51–100 lb', giant: 'over 100 lb' }, sizeMaxLb: { small: 20, medium: 50, large: 100, giant: null },
          ages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          human: { small: [15, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80], medium: [15, 24, 28, 32, 36, 42, 47, 51, 56, 60, 65, 69, 74, 78, 83, 87],
            large: [15, 24, 28, 32, 36, 45, 50, 55, 61, 66, 72, 77, 82, 88, 93, 99], giant: [12, 22, 31, 38, 45, 49, 56, 64, 71, 79, 86, 93, 100, 107, 114, 121] } },
        epigenetic: { a: 16, b: 31, minAge: 0.1, maxAge: 16, citation: 'Wang T, et al. Cell Systems 2020;11(2):176-185.e6', breed: 'Labrador retrievers' },
      },
      catAge: {
        table: [[1, 1, 'Kitten'], [2, 2, 'Kitten'], [3, 4, 'Kitten'], [4, 6, 'Kitten'], [5, 8, 'Kitten'], [6, 10, 'Kitten'], [7, 12, 'Junior'], [12, 15, 'Junior'], [18, 21, 'Junior'], [24, 24, 'Junior'],
          [36, 28, 'Adult'], [48, 32, 'Adult'], [60, 36, 'Adult'], [72, 40, 'Adult'], [84, 44, 'Mature'], [96, 48, 'Mature'], [108, 52, 'Mature'], [120, 56, 'Mature'], [132, 60, 'Senior'], [144, 64, 'Senior'],
          [156, 68, 'Senior'], [168, 72, 'Senior'], [180, 76, 'Super Senior'], [192, 80, 'Super Senior'], [204, 84, 'Super Senior'], [216, 88, 'Super Senior'], [228, 92, 'Super Senior'], [240, 96, 'Super Senior'],
          [252, 100, 'Super Senior'], [264, 104, 'Super Senior'], [276, 108, 'Super Senior'], [288, 112, 'Super Senior'], [300, 116, 'Super Senior']].map(([months, human, stage]) => ({ months, human, stage })),
        perYearAfter2: 4, source: 'International Cat Care', updated: '28th Nov 2025',
        stages: { source: '2021 AAHA/AAFP Feline Life Stage Guidelines', kittenBelow: 1, youngAdultThrough: 6, matureThrough: 10 },
      },
      energy: { rer: { coef: 70, exp: 0.75 }, dog: { intact: 1.8, neutered: 1.6, obesityProne: 1.4, puppyUnder4: 3, puppyOver4: 2 }, cat: { intact: 1.4, neutered: 1.2, obesityProne: 1, kitten: 2.5 },
        osu: { weightLoss: 1, activeLow: 2, activeHigh: 5 }, treatMaxShare: 0.1, sources: { merck: { updated: 'Sept 2024' } } },
      gestation: { dog: { breeding: [58, 72], ovulation: [62, 64], lhPeak: [64, 66], diestrus: [56, 58] }, cat: { approx: 65 } },
      chocolate: {
        types: { cocoaPowder: { label: 'Cocoa powder', mgPerG: [28.5, 28.5] }, unsweetened: { label: "Unsweetened (baker's) chocolate", mgPerG: [15.5, 15.5] },
          semisweetDark: { label: 'Semisweet and sweet dark chocolate', mgPerG: [5.3, 5.6] }, milk: { label: 'Milk chocolate', mgPerG: [2.3, 2.3] },
          hulls: { label: 'Cocoa bean hulls', mgPerG: [9, 9] }, white: { label: 'White chocolate', mgPerG: [0.04, 0.04] } },
        unsweetenedMgPerG: 15.5, thresholds: { mild: 20, cardioLow: 40, cardioHigh: 50, seizure: 60, ld50Low: 100, ld50High: 200, milkLethalGPerKg: 62 },
        source: 'Merck Veterinary Manual — Chocolate Toxicosis in Animals', updated: 'Feb 2026',
        contacts: { aspca: { name: 'ASPCA Animal Poison Control Center', phone: '(888) 426-4435', fee: 'a consultation fee may apply' }, pph: { name: 'Pet Poison Helpline', phone: '(855) 764-7661', fee: '$89 incident fee' } },
      },
      insurance: { year: 2025, annual: { wellness: { dog: 1414, cat: 859 }, accidentIllness: { dog: 836, cat: 435 }, accidentOnly: { dog: 190, cat: 112 } }, source: 'NAPHIA — State of the Industry Report 2026', published: 'June 21, 2026' },
      costs: {
        annual: { food: { dog: 300, cat: 225 }, routineMedical: { dog: 225, cat: 160 }, preventiveMeds: { dog: 185, cat: 140 }, litter: { dog: 0, cat: 150 }, toys: { dog: 37, cat: 22 }, treats: { dog: 60, cat: 36 },
          insurance: { dog: 516, cat: 348 }, boardingPerDay: { dog: 25, cat: 25 }, license: { dog: 15, cat: 15 }, groomingSupplies: { dog: 28, cat: 28 } },
        initial: { spayNeuter: { dog: 300, cat: 150 }, initialMedical: { dog: 300, cat: 175 }, collarLeash: { dog: 60, cat: 15 }, microchip: { dog: 20, cat: 20 }, litterBox: { dog: 0, cat: 20 },
          scratchingPost: { dog: 0, cat: 15 }, carrier: { dog: 50, cat: 40 }, crate: { dog: 60, cat: 0 }, training: { dog: 200, cat: 0 }, groomingTools: { dog: 40, cat: 20 } },
        special: { professionalGrooming: { dog: 300, cat: 0 }, dental: { dog: 500, cat: 300 } },
        totals: { annual: { dog: 1391, cat: 1149 }, initial: { dog: 1030, cat: 455 }, firstYear: { dog: 3221, cat: 1904 } },
        source: 'ASPCA — Cutting Pet Care Costs (2021 update)',
      },
      breeds: { rows: [
        { breed: 'Labrador Retriever', male: 31.1, female: 26.2, nMale: 6222, nFemale: 6903, screenedAt: '12–24 months' },
        { breed: 'Great Dane', male: 64.8, female: 56.3, nMale: 183, nFemale: 215, screenedAt: '18–30 months' },
        { breed: 'Alaskan Malamute', male: 36.2, female: null, nMale: 176, nFemale: 167, screenedAt: '12–24 months' },
      ], source: 'Andersson L, et al. Scientific Reports 2023, Table 1' },
    },
    __tests: [
      // dog age
      { calc: 'dogAge', name: '5-year-old medium dog: chart 36; formula 16·ln5+31 = 56.75', input: { years: 5, months: 0, size: 'medium', weightLb: null }, expect: { chart: 36, epigenetic: 56.75 } },
      { calc: 'dogAge', name: '10 y 6 m, 120 lb → giant, chart between 79 and 86 = 82.5', input: { years: 10, months: 6, size: 'small', weightLb: 120 }, expect: { size: 'giant', chart: 82.5, epigenetic: 68.62 } },
      { calc: 'dogAge', name: '1-year-old small dog: chart 15, formula 31', input: { years: 1, months: 0, size: 'small', weightLb: null }, expect: { chart: 15, epigenetic: 31 } },
      { calc: 'dogAge', name: '3-month-old puppy: no chart row, formula 16·ln(0.25)+31 = 8.82', input: { years: 0, months: 3, size: 'large', weightLb: null }, expect: { chart: null, epigenetic: 8.82 } },
      { pure: true, name: 'size bands: 20 lb small, 20.5 medium, 50 medium, 100 large, 101 giant', run: P => ({ a: P.sizeFromLb(20), b: P.sizeFromLb(20.5), c: P.sizeFromLb(50), d: P.sizeFromLb(100), e: P.sizeFromLb(101) }), expect: { a: 'small', b: 'medium', c: 'medium', d: 'large', e: 'giant' } },
      // cat age
      { calc: 'catAge', name: '8-year-old cat = 48, mature adult, iCatCare "Mature"', input: { years: 8, months: 0 }, expect: { human: 48, aahaStage: 'Mature adult', icatStage: 'Mature' } },
      { calc: 'catAge', name: '1 y 3 m = 18 (between 15 and 21)', input: { years: 1, months: 3 }, expect: { human: 18, aahaStage: 'Young adult', icatStage: 'Junior' } },
      { calc: 'catAge', name: '27 years = 116 + 2×4 = 124, senior', input: { years: 27, months: 0 }, expect: { human: 124, aahaStage: 'Senior' } },
      { calc: 'catAge', name: '10 y 6 m is over 10 → senior; human 58', input: { years: 10, months: 6 }, expect: { human: 58, aahaStage: 'Senior', icatStage: 'Mature' } },
      { calc: 'catAge', name: '3 months = 4 human years, kitten', input: { years: 0, months: 3 }, expect: { human: 4, aahaStage: 'Kitten' } },
      { calc: 'catAge', name: '6 y 11 m is still a young adult (AAHA: 1 through 6 years)', input: { years: 6, months: 11 }, expect: { human: 43.67, aahaStage: 'Young adult', icatStage: 'Adult' } },
      // dog food
      { calc: 'dogFood', name: '10 kg neutered: RER 393.64, 629.82 kcal (OSU example ≈400 RER)', input: { unit: 'kg', weight: 10, stage: 'neutered', foodUnit: 'cup', kcal: null, treats: false, meals: 2 }, expect: { rer: 393.64, kcal: 629.82, portion: null } },
      { calc: 'dogFood', name: '30 lb neutered, 380 kcal/cup, 10% treats, 2 meals', input: { unit: 'lb', weight: 30, stage: 'neutered', foodUnit: 'cup', kcal: 380, treats: true, meals: 2 }, expect: { kg: 13.61, rer: 495.95, kcal: 793.52, treatKcal: 79.35, foodKcal: 714.17, portion: 1.88, perMeal: 0.94 } },
      { calc: 'dogFood', name: 'weight loss: 1.0 × RER of the 25 kg ideal weight', input: { unit: 'kg', weight: 25, stage: 'weightLoss', foodUnit: 'cup', kcal: null, treats: false, meals: 2 }, expect: { factor: 1, kcal: 782.62 } },
      { calc: 'dogFood', name: 'active dog, factor 7 is clamped to 5; raw food 1,500 kcal/kg → grams', input: { unit: 'kg', weight: 20, stage: 'active', factor: 7, foodUnit: 'kg', kcal: 1500, treats: false, meals: 2 }, expect: { factor: 5, rer: 662.02, kcal: 3310.1, portion: 2206.73 } },
      { calc: 'dogFood', name: 'puppy under 4 months: 3 × RER', input: { unit: 'kg', weight: 5, stage: 'puppyUnder4', foodUnit: 'cup', kcal: null, treats: false, meals: 3 }, expect: { factor: 3, kcal: 702.18 } },
      // cat food
      { calc: 'catFood', name: '10 lb neutered cat, 1.2 × RER, 400 kcal/cup, treats', input: { unit: 'lb', weight: 10, stage: 'neutered', foodUnit: 'cup', kcal: 400, treats: true, meals: 2 }, expect: { kg: 4.54, rer: 217.57, kcal: 261.08, foodKcal: 234.97, portion: 0.59 } },
      { calc: 'catFood', name: '4 kg kitten 2.5 × RER, 90 kcal per can → cans', input: { unit: 'kg', weight: 4, stage: 'kitten', foodUnit: 'can', kcal: 90, treats: false, meals: 3 }, expect: { factor: 2.5, kcal: 494.97, portion: 5.5 } },
      // puppy weight
      { calc: 'puppyWeight', name: 'male Labrador 31.1 kg = 68.56 lb; a 34.28 lb puppy is 50%', input: { breed: 'Labrador Retriever', sex: 'male', unit: 'lb', current: 34.28 }, expect: { kg: 31.1, lb: 68.56, share: 50 } },
      { calc: 'puppyWeight', name: 'female Great Dane 56.3 kg', input: { breed: 'Great Dane', sex: 'female', unit: 'kg', current: null }, expect: { kg: 56.3, lb: 124.12, share: null } },
      { calc: 'puppyWeight', name: 'withheld misprint returns no weight', input: { breed: 'Alaskan Malamute', sex: 'female', unit: 'kg', current: null }, expect: { kg: null } },
      // pregnancy
      { calc: 'petPregnancy', name: 'dog bred 2026-09-16 → 2026-11-13 to 2026-11-27 (58–72 d)', input: { species: 'dog', basis: 'breeding', date: '2026-09-16' }, expect: { earliest: '2026-11-13', latest: '2026-11-27' } },
      { calc: 'petPregnancy', name: 'LH surge 2026-12-20 → 2027-02-22 to 2027-02-24 (64–66 d, across a year end)', input: { species: 'dog', basis: 'lhPeak', date: '2026-12-20' }, expect: { earliest: '2027-02-22', latest: '2027-02-24' } },
      { calc: 'petPregnancy', name: 'diestrus day 1 2027-01-10 → 2027-03-07 to 2027-03-09', input: { species: 'dog', basis: 'diestrus', date: '2027-01-10' }, expect: { earliest: '2027-03-07', latest: '2027-03-09' } },
      { calc: 'petPregnancy', name: 'cat bred 2028-01-01 → 2028-03-06 (65 d, leap year)', input: { species: 'cat', basis: 'breeding', date: '2028-01-01' }, expect: { earliest: '2028-03-06' } },
      { calc: 'petPregnancy', name: 'no date → no window, no error', input: { species: 'dog', basis: 'breeding', date: '' }, expect: { earliest: null } },
      // chocolate
      { calc: 'chocolate', name: '20 lb dog, 2 oz milk chocolate → 130.41 mg, 14.38 mg/kg, below the mild level', input: { unit: 'lb', weight: 20, type: 'milk', amount: 2, amountUnit: 'oz' }, expect: { grams: 56.7, mgHigh: 130.41, mgPerKgHigh: 14.38, band: 'belowMild' } },
      { calc: 'chocolate', name: '10 kg dog, 50 g semisweet → 26.5–28 mg/kg, mild band', input: { unit: 'kg', weight: 10, type: 'semisweetDark', amount: 50, amountUnit: 'g' }, expect: { mgLow: 265, mgHigh: 280, mgPerKgLow: 26.5, mgPerKgHigh: 28, band: 'mild' } },
      { calc: 'chocolate', name: '15 lb dog, 1 oz 70% bar → 307.59 mg, 45.21 mg/kg, heart band', input: { unit: 'lb', weight: 15, type: 'labelPct', cocoaPct: 70, amount: 1, amountUnit: 'oz' }, expect: { mgHigh: 307.59, mgPerKgHigh: 45.21, band: 'cardio' } },
      { calc: 'chocolate', name: '30 lb dog, 1 oz baking chocolate → 439.42 mg, 32.29 mg/kg, mild band', input: { unit: 'lb', weight: 30, type: 'unsweetened', amount: 1, amountUnit: 'oz' }, expect: { mgHigh: 439.42, mgPerKgHigh: 32.29, band: 'mild' } },
      { calc: 'chocolate', name: '5 kg dog, 0.5 oz cocoa powder → 80.8 mg/kg, seizure band', input: { unit: 'kg', weight: 5, type: 'cocoaPowder', amount: 0.5, amountUnit: 'oz' }, expect: { mgPerKgHigh: 80.8, band: 'seizure' } },
      { pure: true, name: 'band edges: 20 → mild, 39.99 → mild, 40 → cardio, 60 → seizure, 19.99 → below', run: P => ({ a: P.chocolateBand(20), b: P.chocolateBand(39.99), c: P.chocolateBand(40), d: P.chocolateBand(60), e: P.chocolateBand(19.99) }), expect: { a: 'mild', b: 'mild', c: 'cardio', d: 'seizure', e: 'belowMild' } },
      // insurance
      { calc: 'petInsurance', name: 'dog, NAPHIA A&I average $836, $250 deductible, 80%, $2,000 bills', input: { species: 'dog', plan: 'accidentIllness', premiumMode: 'average', deductible: 250, pct: '80', limit: 0, bills: 2000, uncovered: 0 }, expect: { premium: 836, reimbursed: 1400, insured: 1436, uninsured: 2000, difference: 564, breakEven: 1295 } },
      { calc: 'petInsurance', name: '$45/month quote, $500 deductible, 90%, $5,000 limit, $12,000 bills + $300 uncovered', input: { species: 'cat', plan: 'accidentIllness', premiumMode: 'monthly', premium: 45, deductible: 500, pct: '90', limit: 5000, bills: 12000, uncovered: 300 }, expect: { premium: 540, reimbursed: 5000, insured: 7840, uninsured: 12300, difference: 4460, breakEven: 1100 } },
      { calc: 'petInsurance', name: 'cat accident-only average $112, small bill below the deductible', input: { species: 'cat', plan: 'accidentOnly', premiumMode: 'average', deductible: 250, pct: '70', limit: 0, bills: 200, uncovered: 0 }, expect: { premium: 112, reimbursed: 0, difference: -112, breakEven: 410 } },
      { calc: 'petInsurance', name: 'break-even beyond a tiny limit → none', input: { species: 'dog', plan: 'wellness', premiumMode: 'average', deductible: 0, pct: '80', limit: 500, bills: 1000, uncovered: 0 }, expect: { premium: 1414, reimbursed: 500, breakEven: null } },
      // vet cost
      { calc: 'vetCost', name: 'dog, ASPCA defaults with dental = $910', input: { species: 'dog', routine: null, preventive: null, dental: null, includeDental: true, firstYear: false, extra: [] }, expect: { total: 910, monthly: 75.83 } },
      { calc: 'vetCost', name: 'cat first year, own routine $300, extra $450 → $1,235', input: { species: 'cat', routine: 300, preventive: null, dental: null, includeDental: false, firstYear: true, extra: [{ item: 'Blood test', cost: 450 }] }, expect: { total: 1235 } },
      // pet cost
      { calc: 'petCost', name: 'dog defaults reproduce ASPCA: $1,391 a year, $3,221 first year; 10 years $15,740', input: { species: 'dog' }, expect: { annual: 1391, firstYear: 3221, lifetime: 15740, monthly: 115.92 } },
      { calc: 'petCost', name: 'cat defaults reproduce ASPCA: $1,149 and $1,904', input: { species: 'cat', years: 15 }, expect: { annual: 1149, firstYear: 1904, lifetime: 17990 } },
      { calc: 'petCost', name: 'dog, food $600, 7 boarding days, dental+grooming yearly, 12 years', input: { species: 'dog', food: 600, boardingDays: 7, specialEveryYear: true, years: 12 }, expect: { annual: 2641, firstYear: 3671, lifetime: 32722 } },
      { pure: true, name: 'reimbursement: (1,000 − 100) × 90% = 810; limit 500 caps it', run: P => ({ a: P.reimbursement({ bills: 1000, deductible: 100, pct: 90, limit: 0 }), b: P.reimbursement({ bills: 1000, deductible: 100, pct: 90, limit: 500 }) }), expect: { a: 810, b: 500 } },
    ],
  };
});
