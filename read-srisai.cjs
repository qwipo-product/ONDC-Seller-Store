const XLSX = require('xlsx');
const wb = XLSX.readFile('C:\\Users\\Lenovo\\Downloads\\Sri Sai Ram Agencies 2.xlsx');
console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
  console.log(`\n--- Sheet: ${name} (rows=${rows.length}) ---`);
  rows.slice(0, 15).forEach((r, i) => console.log(i, JSON.stringify(r)));
  if (rows.length > 15) console.log(`... +${rows.length - 15} more rows`);
}
