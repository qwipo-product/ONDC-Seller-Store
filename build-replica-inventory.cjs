// Consolidates Production Polygons/_captures/*.capture.json into one inventory:
// [{seller, phone, companies: [{name, beats: [{beat, file, days, geojson}]}]}]
// Day inference: beat chip text prefix (Mon/Tue/Wed/Thu/Thus/Fri/Sat/Sun) => that day;
// "·6d" suffix => Mon-Sat. Recorded as inferredDays; exact days can be patched later.
const fs = require('fs');
const path = require('path');

const capDir = path.join(__dirname, 'Production Polygons', '_captures');
const files = fs.readdirSync(capDir).filter(f => f.endsWith('.capture.json'));

const sellers = new Map();
const DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', thus: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(capDir, f), 'utf8'));
  for (const cap of data.captured) {
    const seller = cap.seller || data.seller;
    const phone = cap.phone || data.phone;
    const key = seller + '|' + phone;
    if (!sellers.has(key)) sellers.set(key, { seller, phone, companies: new Map() });
    const s = sellers.get(key);
    if (!s.companies.has(cap.company)) s.companies.set(cap.company, []);
    const chip = cap.beat;
    const multi = /·(\d)d$/.exec(chip);
    const cleanBeat = chip.replace(/·\dd$/, '').trim();
    const n = multi ? +multi[1] : 1;
    // leading day tokens in the beat name: "Mon Tue Thus Sat Ameerpet- X" => [Mon,Tue,Thu,Sat]
    const tokenDays = [];
    for (const w of cleanBeat.split(/[\s_,-]+/)) {
      const m = /^(mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thus|thurs|thursday|fri|friday|sat|saturday|sun|sunday)$/i.exec(w);
      if (!m) break;
      const d = DAY[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('thu') ? 4 : 3)] || DAY[m[1].toLowerCase().slice(0, 3)];
      if (d && !tokenDays.includes(d)) tokenDays.push(d);
    }
    let days = null;
    if (n === 6) days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    else if (n === 7) days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    else if (tokenDays.length === n) days = tokenDays;
    else if (tokenDays.length > 0 && n === 1) days = [tokenDays[0]];
    s.companies.get(cap.company).push({ beat: cleanBeat, file: cap.file, inferredDays: days, geojson: JSON.parse(cap.text) });
  }
}

const out = [...sellers.values()].map(s => ({
  seller: s.seller, phone: s.phone,
  companies: [...s.companies.entries()].map(([name, beats]) => ({ name, beats }))
}));

fs.writeFileSync(path.join(__dirname, 'Production Polygons', 'replica-inventory.json'), JSON.stringify(out, null, 1));
const nb = out.reduce((a, s) => a + s.companies.reduce((b, c) => b + c.beats.length, 0), 0);
const noDays = out.flatMap(s => s.companies.flatMap(c => c.beats.filter(b => !b.inferredDays).map(b => s.seller + ' / ' + c.name + ' / ' + b.beat)));
console.log('sellers:', out.length, 'beats:', nb, 'beatsWithoutDays:', noDays.length);
noDays.forEach(x => console.log('NO-DAYS:', x));
