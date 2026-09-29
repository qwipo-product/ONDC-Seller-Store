"""Add new Telangana customers from a Qwipo CustomersReport export to the seed.

Usage:
    python scripts/add-telangana-customers.py "<path to CustomersReport.xlsx>"

What it does
  1. Reads the report and keeps only State = Telangana rows.
  2. Skips any row whose customer id OR mobile number is already in
     src/app/lib/customer-raw-seed.csv (mobile is the uniqueness key), and
     any repeat of a mobile within the report itself. Existing customers are
     left untouched.
  3. Salesperson: the Digidukaan tagging (salesperson-tagging.json) wins when
     it has the mobile; otherwise the report's salesperson, normalised to the
     names already used in the seed (see apply-salesperson-tagging.py).
  4. The report has no coordinates, so each new customer is placed at the
     median location of existing seed customers in the same pincode.
     Customers whose pincode has no existing customers are skipped.
  5. Appends the new rows to the seed and drops their mobiles from
     salesperson-tagging.json (that file only holds mobiles not in the seed).
"""
import collections
import csv
import importlib.util
import json
import os
import re
import statistics
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, "src", "app", "lib", "customer-raw-seed.csv")
EXTRA = os.path.join(ROOT, "src", "app", "lib", "salesperson-tagging.json")

_spec = importlib.util.spec_from_file_location(
    "tagging", os.path.join(ROOT, "scripts", "apply-salesperson-tagging.py"))
tagging = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tagging)
canon, norm_phone, USER_ID = tagging.canon, tagging.norm_phone, tagging.USER_ID

# Report columns
ID, NAME, BUSINESS, MOBILE, BSTATUS, BTYPE, STATUS, SP_NAME, SP_NUM, CLUSTER, \
    STATE, CITY, PINCODE, REGISTERED = range(14)

ONDC_SUFFIX = re.compile(r"\s+ondc(\s+ba)?\s*$", re.I)


def iso_date(v):
    m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", str(v or "").strip())
    return f"{m[3]}-{m[2]}-{m[1]}" if m else ""


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    import openpyxl

    ws = openpyxl.load_workbook(sys.argv[1], read_only=True).worksheets[0]
    report = [r for r in ws.iter_rows(min_row=2, values_only=True)
              if str(r[STATE] or "").strip().lower() == "telangana"]

    with open(SEED, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        seed = list(reader)
    with open(EXTRA, encoding="utf-8") as f:
        tags = json.load(f)

    seed_ids = {r["customer_id"] for r in seed}
    seed_mobiles = {norm_phone(r["mobile_number"]) for r in seed} - {None}
    by_id = {r["customer_id"]: r for r in seed}

    # Salesperson names/numbers already in use, and who owns each number.
    known = collections.Counter()
    number_votes = collections.defaultdict(collections.Counter)
    for name, num in [(r["salesperson_name"], r["salesperson_number"]) for r in seed] \
            + [tuple(v) for v in tags.values()]:
        if name and not USER_ID.match(name):
            known[name] += 1
            if norm_phone(num):
                number_votes[name][norm_phone(num)] += 1
    number_of = {n: c.most_common(1)[0][0] for n, c in number_votes.items()}
    owner_of = {}
    for n, c in number_votes.items():
        for num, v in c.items():
            if num not in owner_of or v > number_votes[owner_of[num]][num]:
                owner_of[num] = n

    def salesperson(raw, raw_num):
        name = canon(ONDC_SUFFIX.sub("", str(raw or "")))
        num = norm_phone(raw_num)
        if not name:
            return "", ""
        # Unknown spelling of a known salesperson, e.g. "Md Khaleel" ->
        # "Mohammed Khaleel Ullah". Needs a shared name word as well as the
        # number, since company SIMs get handed from one BA to the next.
        owner = owner_of.get(num)
        if name not in known and owner and \
                {w for w in name.lower().split() if len(w) > 2} & set(owner.lower().split()):
            name = owner
        return name, number_of.get(name) or num or ""

    # Pincode -> median location of existing customers there.
    pin_points = collections.defaultdict(list)
    for r in report:
        s = by_id.get(r[ID])
        pin = str(r[PINCODE] or "").strip()
        if s and pin and pin != "0":
            pin_points[pin].append((float(s["latitude"]), float(s["longitude"])))
    pin_centre = {p: (statistics.median(a for a, _ in pts), statistics.median(b for _, b in pts))
                  for p, pts in pin_points.items()}

    stats = collections.Counter()
    added, taken = [], set(seed_mobiles)
    for r in report:
        mobile = norm_phone(r[MOBILE])
        if r[ID] in seed_ids:
            stats["already exists (customer id)"] += 1
            continue
        if not mobile:
            stats["skipped: invalid mobile"] += 1
            continue
        if mobile in taken:
            stats["already exists (mobile)"] += 1
            continue
        centre = pin_centre.get(str(r[PINCODE] or "").strip())
        if not centre:
            stats["skipped: no location for pincode"] += 1
            continue
        taken.add(mobile)

        if mobile in tags:
            sp_name, sp_num = tags[mobile]
            stats["salesperson from Digidukaan tagging"] += 1
        else:
            sp_name, sp_num = salesperson(r[SP_NAME], r[SP_NUM])
            stats["salesperson from report" if sp_name else "no salesperson"] += 1

        added.append({
            "customer_id": r[ID],
            "customer_name": (r[BUSINESS] or r[NAME] or "").strip(),
            "mobile_number": mobile,
            "business_type": r[BTYPE] or "",
            "business_status": r[BSTATUS] or "",
            "status": r[STATUS] or "",
            "salesperson_name": sp_name,
            "salesperson_number": sp_num,
            "cluster": (r[CLUSTER] or "").strip(),
            "registered_date": iso_date(r[REGISTERED]),
            "latitude": f"{centre[0]:.6f}",
            "longitude": f"{centre[1]:.6f}",
        })

    # Appended, not re-sorted: seed rows get positional `seed-N` ids, and the
    # admin's removed-seed list in localStorage refers to those.
    rows = seed + added
    with open(SEED, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    remaining = {k: v for k, v in tags.items() if k not in taken}
    with open(EXTRA, "w", encoding="utf-8") as f:
        f.write("{\n" + ",\n".join(
            f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}"
            for k, v in sorted(remaining.items())
        ) + "\n}\n")

    print(f"Telangana rows in report: {len(report)}")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")
    print(f"added {len(added)} customers; seed now {len(rows)}")
    print(f"salespersons on new customers: "
          f"{collections.Counter(a['salesperson_name'] for a in added if a['salesperson_name']).most_common()}")


if __name__ == "__main__":
    main()
