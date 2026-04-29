"""
Build assets/zip-density.json — compact ZIP → urbanity classification map.

Source: SimpleMaps US Zips Basic (MIT-licensed, free for commercial use).
https://simplemaps.com/data/us-zips

Output schema: {"00501": "R", "00544": "R", "33602": "U", ...}
  R = rural    (< 500 people/sq mile)
  S = suburban (500–2500)
  U = urban    (> 2500)

Run when you want to refresh the offline density data:
    py scripts/build_zip_density.py
"""
import csv
import io
import json
import urllib.request
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "assets" / "zip-density.json"
ZIP_URL = "https://simplemaps.com/static/data/us-zips/1.83/basic/simplemaps_uszips_basicv1.83.zip"


def classify(density: float) -> str:
    if density < 500:
        return "R"
    if density < 2500:
        return "S"
    return "U"


def main() -> None:
    print(f"Downloading {ZIP_URL} ...")
    req = urllib.request.Request(
        ZIP_URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; mdally-roi-calc-build/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        blob = resp.read()
    print(f"Got {len(blob):,} bytes")

    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        csv_name = next(n for n in zf.namelist() if n.endswith(".csv"))
        print(f"Reading {csv_name}")
        with zf.open(csv_name) as f:
            text = io.TextIOWrapper(f, encoding="utf-8")
            reader = csv.DictReader(text)
            mapping: dict[str, str] = {}
            for row in reader:
                zip_code = row["zip"].strip()
                if not zip_code or len(zip_code) != 5 or not zip_code.isdigit():
                    continue
                density_str = row.get("density", "").strip()
                if not density_str:
                    continue
                try:
                    density = float(density_str)
                except ValueError:
                    continue
                mapping[zip_code] = classify(density)

    print(f"Built {len(mapping):,} ZIP classifications")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(mapping, f, separators=(",", ":"), sort_keys=True)
    size_kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
