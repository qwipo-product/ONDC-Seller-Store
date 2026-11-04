"""Set customer coordinates from a Qwipo customer_addresses export.

Usage:
    python scripts/apply-customer-addresses.py "<path to customer_addresses_*.csv>"

What it does
  1. Reads the export (one row per address: customer_id, latitude, longitude,
     is_default, status, updated_at, ...). For each customer it takes the
     active address (status 1) with usable coordinates — inside Telangana, so
     0,0 and stray points elsewhere are ignored — preferring the default
     address, then the most recently updated one.
  2. Seed customers whose position differs from that address by more than
     10 m are moved to it. Customers with no usable address keep theirs.
"""
import collections
import csv
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, "src", "app", "lib", "customer-raw-seed.csv")

# Generous Telangana bounding box.
LAT_RANGE, LNG_RANGE = (15.5, 20.5), (77.0, 81.5)


def best_locations(path):
    """customer_id -> (lat string, lng string) of its preferred usable address."""
    best = {}
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                lat, lng = float(r["latitude"]), float(r["longitude"])
            except ValueError:
                continue
            if r["status"] != "1" or not (LAT_RANGE[0] <= lat <= LAT_RANGE[1]
                                          and LNG_RANGE[0] <= lng <= LNG_RANGE[1]):
                continue
            rank = (r["is_default"] == "1", r["updated_at"])
            cur = best.get(r["customer_id"])
            if not cur or rank > cur[0]:
                best[r["customer_id"]] = (rank, r["latitude"].strip(), r["longitude"].strip())
    return {cid: (lat, lng) for cid, (_, lat, lng) in best.items()}


def km(a, b, c, d):
    p = math.sin(math.radians(c - a) / 2) ** 2 + math.cos(math.radians(a)) * \
        math.cos(math.radians(c)) * math.sin(math.radians(d - b) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(p))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    located = best_locations(sys.argv[1])

    with open(SEED, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        seed = list(reader)

    stats = collections.Counter()
    for s in seed:
        loc = located.get(s["customer_id"])
        if not loc:
            stats["no usable address: kept"] += 1
            continue
        try:
            d = km(float(s["latitude"]), float(s["longitude"]), float(loc[0]), float(loc[1]))
        except ValueError:
            d = math.inf
        if d <= 0.01:
            stats["already at address"] += 1
            continue
        s["latitude"], s["longitude"] = loc
        stats["moved " + ("< 1 km" if d < 1 else "1-5 km" if d < 5 else ">= 5 km")] += 1

    with open(SEED, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(seed)

    print(f"customers with a usable address in the export: {len(located)}")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")
    print(f"seed: {len(seed)} customers")


if __name__ == "__main__":
    main()
