"""Refresh the customer seed from a newer Qwipo CustomersReport export.

Usage:
    python scripts/update-customers-from-report.py "<path to CustomersReport.xlsx>" \
        ["<path to customer_addresses_*.csv>"]

What it does
  1. Reads the report and keeps only State = Telangana rows.
  2. Customers already in src/app/lib/customer-raw-seed.csv (matched by
     customer id, then mobile): Business Status and Status are taken from the
     report. Nothing else changes; in particular the salesperson stays as the
     sales team's tagging sheet set it (apply-sales-team-tagging.py).
  3. Customers not in the seed are appended, located at their address from
     the customer_addresses export when one is given and usable (see
     apply-customer-addresses.py), else at the median position of existing
     customers in the same pincode (the report has no coordinates). Customers
     with neither are skipped and listed. Salespersons use the spelling and number already in
     the seed for that person, else the report's.
  4. Seed customers missing from the report are left untouched.
"""
import collections
import csv
import importlib.util
import json
import os
import statistics
import sys
import warnings

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, "src", "app", "lib", "customer-raw-seed.csv")
EXTRA = os.path.join(ROOT, "src", "app", "lib", "salesperson-tagging.json")

def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, "scripts", file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


team = _load("team", "apply-sales-team-tagging.py")
addresses = _load("addresses", "apply-customer-addresses.py")
canon, value, iso_date, norm_phone = team.canon, team.value, team.iso_date, team.norm_phone
ID, NAME, BUSINESS, MOBILE, BSTATUS, BTYPE, STATUS, SP_NAME, SP_NUM, CLUSTER, \
    STATE, CITY, PINCODE, REGISTERED = range(14)


def main():
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    import openpyxl

    located = addresses.best_locations(sys.argv[2]) if len(sys.argv) == 3 else {}

    warnings.filterwarnings("ignore", module="openpyxl")
    ws = openpyxl.load_workbook(sys.argv[1], read_only=True).worksheets[0]
    report = [r for r in ws.iter_rows(min_row=2, values_only=True)
              if r[ID] and str(r[STATE] or "").strip().lower() == "telangana"]

    with open(SEED, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        seed = list(reader)
    with open(EXTRA, encoding="utf-8") as f:
        tags = json.load(f)

    by_id = {r["customer_id"]: r for r in seed}
    by_mobile = {norm_phone(r["mobile_number"]): r for r in seed}
    by_mobile.pop(None, None)

    # The seed's spelling and number for each salesperson, by canonical key.
    spellings = collections.defaultdict(collections.Counter)
    numbers = collections.defaultdict(collections.Counter)
    for s in seed:
        if s["salesperson_name"]:
            key = canon(s["salesperson_name"])
            spellings[key][s["salesperson_name"]] += 1
            if s["salesperson_number"]:
                numbers[key][s["salesperson_number"]] += 1

    def salesperson(raw_name, raw_num):
        key = canon(raw_name)
        if not key:
            return "", ""
        name = spellings[key].most_common(1)[0][0] if spellings[key] \
            else " ".join(str(raw_name).split())
        num = numbers[key].most_common(1)[0][0] if numbers[key] else norm_phone(raw_num) or ""
        return name, num

    stats, transitions = collections.Counter(), collections.Counter()
    new = []
    for r in report:
        s = by_id.get(r[ID]) or by_mobile.get(norm_phone(r[MOBILE]))
        if not s:
            new.append(r)
            continue
        old = (value("business_status", s["business_status"]), value("status", s["status"]))
        # A blank Business Status in the report means "None", as in the seed.
        cur = (value("business_status", r[BSTATUS]), value("status", r[STATUS]))
        if old != cur:
            s["business_status"], s["status"] = cur
            transitions[f"{'/'.join(old)} -> {'/'.join(cur)}"] += 1
            stats["existing: status changed"] += 1
        else:
            stats["existing: unchanged"] += 1

    # Pincode -> median location of existing customers there.
    pin_points = collections.defaultdict(list)
    for r in report:
        s = by_id.get(r[ID])
        pin = str(r[PINCODE] or "").strip()
        if s and pin and pin != "0" and s["latitude"] and s["longitude"]:
            pin_points[pin].append((float(s["latitude"]), float(s["longitude"])))
    pin_centre = {p: (statistics.median(a for a, _ in pts), statistics.median(b for _, b in pts))
                  for p, pts in pin_points.items()}

    added, skipped, taken = [], [], set(by_mobile)
    for r in new:
        mobile = norm_phone(r[MOBILE])
        loc = located.get(r[ID]) or pin_centre.get(str(r[PINCODE] or "").strip())
        why = "invalid mobile" if not mobile else "duplicate mobile" if mobile in taken \
            else None if loc else "no address or pincode location"
        if why:
            stats[f"new: skipped, {why}"] += 1
            skipped.append((r, why))
            continue
        taken.add(mobile)
        stats["new: located at " + ("address" if r[ID] in located else "pincode median")] += 1
        lat, lng = map(float, loc)
        sp_name, sp_num = salesperson(r[SP_NAME], r[SP_NUM])
        added.append({
            "customer_id": r[ID],
            "customer_name": (r[BUSINESS] or r[NAME] or "").strip(),
            "mobile_number": mobile,
            "business_type": value("business_type", r[BTYPE]),
            "business_status": value("business_status", r[BSTATUS]),
            "status": value("status", r[STATUS]),
            "salesperson_name": sp_name,
            "salesperson_number": sp_num,
            "cluster": " ".join(str(r[CLUSTER] or "").split()),
            "registered_date": iso_date(r[REGISTERED]),
            "latitude": f"{lat:.6f}",
            "longitude": f"{lng:.6f}",
        })
        stats["new: added"] += 1

    # Appended, not re-sorted: seed rows get positional `seed-N` ids, and the
    # admin's removed-seed list in localStorage refers to those.
    rows = seed + added
    with open(SEED, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    # salesperson-tagging.json only holds mobiles not in the seed.
    remaining = {k: v for k, v in tags.items() if k not in taken}
    if len(remaining) != len(tags):
        with open(EXTRA, "w", encoding="utf-8") as f:
            f.write("{\n" + ",\n".join(
                f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}"
                for k, v in sorted(remaining.items())
            ) + "\n}\n")

    report_keys = {r[ID] for r in report} | {norm_phone(r[MOBILE]) for r in report}
    untouched = sum(1 for s in seed if s["customer_id"] not in report_keys
                    and norm_phone(s["mobile_number"]) not in report_keys)
    print(f"Telangana rows in report: {len(report)}")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")
    for k, v in transitions.most_common():
        print(f"    {v:5}  {k}")
    print(f"  seed customers not in report (left as is): {untouched}")
    print(f"seed now {len(rows)} customers")
    print("salespersons on new customers: "
          f"{collections.Counter(a['salesperson_name'] or '(none)' for a in added).most_common()}")
    for r, why in skipped:
        print(f"  not added ({why}): {r[ID]} | {(r[BUSINESS] or r[NAME] or '').strip()} | "
              f"{r[MOBILE]} | pincode {r[PINCODE]!r} | {' '.join(str(r[CITY] or '').split())}")


if __name__ == "__main__":
    main()
