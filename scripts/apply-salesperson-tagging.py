"""Apply the Digidukaan salesperson-tagging sheet to the customer database.

Usage:
    python scripts/apply-salesperson-tagging.py "<path to Digidukaan Dashboard ... saleperson tagging.xlsx>"

What it does
  1. Reads the "Sale Person Taging" sheet: outlet mobile -> BA (salesperson)
     name + BA mobile. Spelling variants of the same person are merged
     (ALIASES) so reports group on one name per salesperson.
  2. Rewrites src/app/lib/customer-raw-seed.csv:
       - customer mobile found in the sheet -> salesperson taken from the sheet
         (the sheet is the source of truth for tagging)
       - otherwise existing salesperson kept, with its spelling normalised
       - salesperson number filled in wherever the salesperson is known
  3. Writes src/app/lib/salesperson-tagging.json with the sheet tags for
     mobiles NOT in the seed roster, so customers uploaded later through the
     Customer Database page get tagged too.
"""
import collections
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, "src", "app", "lib", "customer-raw-seed.csv")
EXTRA = os.path.join(ROOT, "src", "app", "lib", "salesperson-tagging.json")

# Spelling / format variants of the same salesperson, confirmed by a shared
# BA mobile number or the same full name. Keys are lower-cased raw values.
ALIASES = {
    "j akshay": "J Akshay",
    "n eshwar": "N Eshwar", "n. eshwar": "N Eshwar", "n.eshwar": "N Eshwar",
    "eshwar": "N Eshwar", "nerella eshwar": "N Eshwar",
    "satish": "Satish Kumar",
    "t purna chander rao": "T Purna Chander Rao",
    "mailagani ajaykumar": "Mailagani Ajaykumar", "ajaykumarm": "Mailagani Ajaykumar",
    "devasani srikanth": "Devasani Srikanth", "davasani srikanth": "Devasani Srikanth",
    "devayani srikanth": "Devasani Srikanth",
    "khaleel": "Mohammed Khaleel Ullah",
    "jashuva": "Baddireddy Jashuva", "baddireddy jashuva": "Baddireddy Jashuva",
    "kotte srikanth": "Kotte Srikanth",
    "sudhakar": "Sudhakar D", "sudhakar d": "Sudhakar D",
    "gadhara kiran": "Gandhara Kiran", "gandhara kiran": "Gandhara Kiran",
    "b dayakar": "Bachalakura Dayakar", "dayakar bachalakura": "Bachalakura Dayakar",
    "bachalakura dayakar": "Bachalakura Dayakar",
    "venkata saikrishna": "Venkata Saikrishna", "venkata sai krushna": "Venkata Saikrishna",
    "venkata sai": "Venkata Saikrishna",
    "neeraj": "Neeraj Pamulaparthi",
    "larence": "Tatiparthi Larence", "tatiparthi larence": "Tatiparthi Larence",
    "k gopal": "Kalyani Gopal", "kalyani gopal": "Kalyani Gopal",
    "kalyani gopal ondc": "Kalyani Gopal",
    "kommu janardhan": "Janardhan Kommu",
    "b sharath kumar": "B Sharath Kumar", "b sharah kumar": "B Sharath Kumar",
    "b sharthkumar": "B Sharath Kumar",
    "vijay kumar d": "Vijaykumar Dandugula", "d vijay kumar": "Vijaykumar Dandugula",
    "chalamani sai kiran": "Saikiran Chalamani", "saikiran chlamani": "Saikiran Chalamani",
    "deeti": "Deeti Satishkumar", "deeti satishkumar": "Deeti Satishkumar",
    "vallamdas.dharmaiah": "Vallamdas Dharmaiah", "vallamdas.dharamaiah": "Vallamdas Dharmaiah",
    "thaher": "Mahammad Thaher", "mahammad thaher ondc": "Mahammad Thaher",
    "karra.bhargava subrahmanyam": "Karra Bhargava Subrahmanyam",
    "bhargav": "Karra Bhargava Subrahmanyam",
    "vignesh": "Vignesh Pulimamidi",
    "sai charan": "K Sai Charan",
    "vallepu anilkumar": "Vallepu Anil Kumar",
    "podila kishor": "Podila Kishore",
    "k raja ramesh": "Raja Ramesh Kollu",
    "taaj uddin": "Syed Tajuddin",
    "p endar raj": "Pothuraj Endar Raj", "endar raj": "Pothuraj Endar Raj",
    "vinod": "Vinodkumar Musku",
    "sandeep": "G Sandeep",
    "g prasad": "Gattu Prasad",
    "akshay jyothi ondc": "Akshay Jyothi",
    "sai kiran reddy ondc": "Asireddy Saikiran Reddy",
    "m laxman kumar": "M Lakshman",
    "karthik": "Karthik Reddy",
    "mohd abdul asif ondc": "Mohd Abdul Asif",
    "badakala rajender ondc": "Badakala Rajender",
    "kamakshi tcl": "Kamakshi TCL",
}
# Values in the BA-name column that are not a salesperson.
NOT_A_PERSON = {"not tagged", "no ba in that area", "vendor team", "chandra"}
# Seed values that are internal user ids rather than names — kept untouched.
USER_ID = re.compile(r"^(?=.*\d)([0-9a-fA-F-]{32,36}|[A-Za-z0-9]{28})$")


def canon(raw):
    n = " ".join(str(raw).split())
    k = n.lower()
    if not n or k in NOT_A_PERSON:
        return None
    if USER_ID.match(n):
        return n
    return ALIASES.get(k, n.title())


def norm_phone(v):
    d = re.sub(r"\D", "", str(v or ""))
    if len(d) == 12 and d.startswith("91"):
        d = d[2:]
    return d if len(d) == 10 and d[0] in "6789" else None


def read_sheet(path):
    import openpyxl

    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    tags = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        ph = norm_phone(r[11])  # Outlet Phone Number
        if not ph or ph in tags:  # sheet is de-duplicated latest-first
            continue
        # Late-Aug form rows are shifted one column left: BA name sits in the
        # HUL-code column and the BA-mobile column holds "Qwipo"/"ONDC".
        if isinstance(r[16], str) and r[16] in ("Qwipo", "ONDC"):
            raw, ba_mobile = r[14], None
        else:
            raw, ba_mobile = r[15], r[16]
        name = canon(raw) if raw not in (None, 0) else None
        if name:
            tags[ph] = {"name": name, "mobile": norm_phone(ba_mobile)}
    return tags


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    tags = read_sheet(sys.argv[1])

    with open(SEED, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        rows = list(reader)

    # Best-known number per salesperson: sheet BA mobiles first, then seed.
    votes = collections.defaultdict(collections.Counter)
    for t in tags.values():
        if t["mobile"]:
            votes[t["name"]][t["mobile"]] += 1
    for r in rows:
        n, num = canon(r["salesperson_name"]), norm_phone(r["salesperson_number"])
        if n and num:
            votes[n][num] += 1
    # A number belongs to whoever uses it most — stops a stray BA-mobile entry
    # handing one salesperson another salesperson's phone.
    owner = {}
    for n, c in votes.items():
        for num, v in c.items():
            if num not in owner or v > votes[owner[num]][num]:
                owner[num] = n
    number_of = {}
    for n, c in votes.items():
        own = [num for num, _ in c.most_common() if owner[num] == n]
        if own:
            number_of[n] = own[0]

    stats = collections.Counter()
    seed_mobiles = set()
    for r in rows:
        ph = norm_phone(r["mobile_number"])
        seed_mobiles.add(ph)
        before = (r["salesperson_name"], r["salesperson_number"])
        tag = tags.get(ph)
        if tag:
            name = tag["name"]
            old = canon(before[0])
            stats["from sheet: newly tagged" if not old
                  else "from sheet: unchanged" if old == name
                  else "from sheet: reassigned"] += 1
        else:
            name = canon(before[0]) or ""
            stats["not in sheet: tagged" if name else "not in sheet: untagged"] += 1
        r["salesperson_name"] = name
        if not name:
            r["salesperson_number"] = ""
        elif not USER_ID.match(name):
            r["salesperson_number"] = number_of.get(name) or ""

    with open(SEED, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    extra = {
        ph: [t["name"], number_of.get(t["name"], "")]
        for ph, t in sorted(tags.items())
        if ph not in seed_mobiles
    }
    with open(EXTRA, "w", encoding="utf-8") as f:
        f.write("{\n" + ",\n".join(
            f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}"
            for k, v in extra.items()
        ) + "\n}\n")

    print(f"sheet: {len(tags)} tagged mobiles, {len(set(t['name'] for t in tags.values()))} salespersons")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")
    print(f"  sheet mobiles not in seed (-> salesperson-tagging.json): {len(extra)}")


if __name__ == "__main__":
    main()
