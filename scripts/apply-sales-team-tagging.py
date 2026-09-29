"""Apply the sales team's final salesperson tagging to the customer database.

Usage:
    python scripts/apply-sales-team-tagging.py "<path to Sale person tagging.xlsx>"

The sheet has the CustomersReport layout (id, Name, Business Name, Mobile
Number, ... Salesperson Name, Salesperson Number, Cluster, State, City,
Pincode, Registered Date) and is the source of truth for tagging.

What it does
  1. Customers already in src/app/lib/customer-raw-seed.csv (matched by
     customer id, then mobile): salesperson name + number are replaced with
     the sheet's. Names are normalised to the spellings used in the seed.
     Business Status, Business Type and Status are taken from the sheet, and
     Cluster too when the sheet has one. Across the whole seed those values
     use the sheet's spelling (InActive, TiffinCenters, PgHostel, None).
  2. Seed customers not in the sheet keep their salesperson, but a salesperson
     who appears in the sheet gets the sheet's number, so each person has one
     number across the database.
  3. Customers not in the seed are appended, located at the median position of
     existing customers in the same pincode (the sheet has no coordinates).
     Customers whose pincode has no existing customers are skipped.
  4. Sheet mobiles are dropped from salesperson-tagging.json; the sheet
     supersedes the Digidukaan tags for them.
"""
import collections
import csv
import importlib.util
import json
import os
import re
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


tagging = _load("tagging", "apply-salesperson-tagging.py")
report = _load("report", "add-telangana-customers.py")
norm_phone, iso_date, ONDC_SUFFIX = tagging.norm_phone, report.iso_date, report.ONDC_SUFFIX

# Sheet spellings not covered by tagging.ALIASES, confirmed by the same
# salesperson number in the seed.
ALIASES = {
    "md salam": "Mohd Salam",
    "md khaleel": "Mohammed Khaleel Ullah",
    "d srikanth": "Devasani Srikanth",
}

ID, NAME, BUSINESS, MOBILE, BSTATUS, BTYPE, STATUS, SP_NAME, SP_NUM, CLUSTER, \
    STATE, CITY, PINCODE, REGISTERED = range(14)


def canon(raw):
    n = ONDC_SUFFIX.sub("", " ".join(str(raw or "").split()))
    return ALIASES.get(n.lower()) or tagging.canon(n) or ""


# Older seed spellings -> the CustomersReport spelling, so reports and the
# Customers page filters group each value once. Blank means "None" there.
VALUE_ALIASES = {
    "status": {"inactive": "InActive", "active": "Active"},
    "business_type": {"tiffin centers": "TiffinCenters", "pg_hostel": "PgHostel",
                      "bulkcategory": "Bulk Category", "": "None"},
    "business_status": {"": "None"},
}


def value(field, raw):
    v = " ".join(str(raw if raw is not None else "").split())
    return VALUE_ALIASES[field].get(v.lower(), v)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    import openpyxl

    warnings.filterwarnings("ignore", module="openpyxl")
    ws = openpyxl.load_workbook(sys.argv[1], read_only=True).worksheets[0]
    sheet = [r for r in ws.iter_rows(min_row=2, values_only=True) if r[ID]]

    with open(SEED, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        seed = list(reader)
    with open(EXTRA, encoding="utf-8") as f:
        tags = json.load(f)

    by_id = {r["customer_id"]: r for r in seed}
    by_mobile = {norm_phone(r["mobile_number"]): r for r in seed}
    by_mobile.pop(None, None)

    # One number per salesperson, as the sheet has it.
    number_of = {}
    for r in sheet:
        name, num = canon(r[SP_NAME]), norm_phone(r[SP_NUM])
        if name and num:
            number_of.setdefault(name, num)

    stats = collections.Counter()
    matched, new = set(), []
    for r in sheet:
        mobile = norm_phone(r[MOBILE])
        s = by_id.get(r[ID]) or by_mobile.get(mobile)
        if not s:
            new.append(r)
            continue
        matched.add(id(s))
        name = canon(r[SP_NAME])
        num = number_of.get(name) or norm_phone(r[SP_NUM]) or ""
        old = s["salesperson_name"]
        stats["existing: unchanged" if old == name
              else "existing: newly tagged" if not old
              else "existing: untagged" if not name
              else "existing: reassigned"] += 1
        s["salesperson_name"], s["salesperson_number"] = name, num if name else ""
        for field, col in (("business_status", BSTATUS), ("business_type", BTYPE),
                           ("status", STATUS)):
            v = value(field, r[col])
            if value(field, s[field]) != v:
                stats[f"existing: {field} changed"] += 1
            s[field] = v
        cluster = " ".join(str(r[CLUSTER] or "").split())
        if cluster and cluster != s["cluster"]:
            s["cluster"] = cluster
            stats["existing: cluster changed"] += 1

    for s in seed:
        for field in VALUE_ALIASES:
            s[field] = value(field, s[field])

    for s in seed:
        if id(s) not in matched and s["salesperson_name"] in number_of \
                and s["salesperson_number"] != number_of[s["salesperson_name"]]:
            s["salesperson_number"] = number_of[s["salesperson_name"]]
            stats["not in sheet: number aligned"] += 1

    # Older tagging stored the salesperson's own app-account id instead of a
    # name. That account's mobile is the salesperson's number, so resolve it
    # to whoever holds that number; blank it when nobody does.
    name_of_number = {num: name for name, num in number_of.items()}
    for s in seed:
        if s["salesperson_name"] and s["salesperson_number"] \
                and not tagging.USER_ID.match(s["salesperson_name"]):
            name_of_number.setdefault(s["salesperson_number"], s["salesperson_name"])
    for s in seed:
        if tagging.USER_ID.match(s["salesperson_name"]):
            account = by_id.get(s["salesperson_name"])
            num = norm_phone(account["mobile_number"]) if account else None
            name = name_of_number.get(num, "")
            s["salesperson_name"], s["salesperson_number"] = name, num if name else ""
            stats["account-id salesperson " + ("resolved" if name else "blanked")] += 1

    # Pincode -> median location of existing customers there.
    pin_points = collections.defaultdict(list)
    for r in sheet:
        s = by_id.get(r[ID])
        pin = str(r[PINCODE] or "").strip()
        if s and pin and pin != "0" and s["latitude"] and s["longitude"]:
            pin_points[pin].append((float(s["latitude"]), float(s["longitude"])))
    pin_centre = {p: (statistics.median(a for a, _ in pts), statistics.median(b for _, b in pts))
                  for p, pts in pin_points.items()}

    added, taken = [], set(by_mobile)
    for r in new:
        mobile = norm_phone(r[MOBILE])
        if not mobile:
            stats["new: skipped, invalid mobile"] += 1
            continue
        if mobile in taken:
            stats["new: skipped, duplicate mobile"] += 1
            continue
        centre = pin_centre.get(str(r[PINCODE] or "").strip())
        if not centre:
            stats["new: skipped, no location for pincode"] += 1
            continue
        taken.add(mobile)
        name = canon(r[SP_NAME])
        added.append({
            "customer_id": r[ID],
            "customer_name": (r[BUSINESS] or r[NAME] or "").strip(),
            "mobile_number": mobile,
            "business_type": value("business_type", r[BTYPE]),
            "business_status": value("business_status", r[BSTATUS]),
            "status": value("status", r[STATUS]),
            "salesperson_name": name,
            "salesperson_number": (number_of.get(name) or norm_phone(r[SP_NUM]) or "") if name else "",
            "cluster": (r[CLUSTER] or "").strip(),
            "registered_date": iso_date(r[REGISTERED]),
            "latitude": f"{centre[0]:.6f}",
            "longitude": f"{centre[1]:.6f}",
        })
        stats["new: added"] += 1

    # Appended, not re-sorted: seed rows get positional `seed-N` ids, and the
    # admin's removed-seed list in localStorage refers to those.
    rows = seed + added
    with open(SEED, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    sheet_mobiles = {norm_phone(r[MOBILE]) for r in sheet}
    remaining = {k: v for k, v in tags.items() if k not in sheet_mobiles and k not in taken}
    with open(EXTRA, "w", encoding="utf-8") as f:
        f.write("{\n" + ",\n".join(
            f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}"
            for k, v in sorted(remaining.items())
        ) + "\n}\n")

    print(f"sheet rows: {len(sheet)}, salespersons: {len(number_of)}")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")
    print(f"  salesperson-tagging.json: {len(tags)} -> {len(remaining)}")
    print(f"seed now {len(rows)} customers")


if __name__ == "__main__":
    main()
