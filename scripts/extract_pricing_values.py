"""Extract computed values from Direct ARR Inputs at known populations to derive a JS-ready formula."""
import openpyxl
from pathlib import Path

XLSX = Path(r"C:/Users/MikeGuadan/Downloads/Public Safety Offering Price Book.xlsx")

wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["Direct ARR Inputs"]

# Print computed values for key cells
print("=== Key constants (computed) ===")
labels = {
    "C4": "Uninsured Population (decimal)",
    "C5": "Platform & Maintenance Fee",
    "C7": "Population (input)",
    "F6": "Discount (decimal)",
    "F8": "Effective Price",
    "C8": "Annual Calls",
    "C10": "List Price",
    "H22": "Total Customer List Price",
    "L7": "Total Calls",
    "M11": "Pop to Eligible Call Rate",
    "M12": "Eligible to Triaged Call",
    "M16": "Uninsured Pop multiplier",
    "M17": "Uninsured Pop to Eligible Call Rate",
    "M19": "Price per Call (insured? base)",
    "M22": "Follow-up EOC Call Rate",
    "M23": "Price per Call (EOC)",
    "M26": "Anchor Cost/Call",
    "N4": "Uninsured Price",
    "N5": "Insured Price",
    "N6": "EOC Price",
    "N7": "Total Pricing",
    "N8": "Blended PMPY",
    "N9": "Blended Cost per Call",
    "N33": "Diversion Rate",
    "M13": "Price per Call (M26/3)",
    "M34": "Tier 2 discount",
    "M35": "Tier 3 increment",
    "M36": "Tier 4 increment",
    "M37": "Tier 5 increment",
    "M38": "Tier 6 increment",
    "D38": "Tier 1 max pop",
    "D39": "Tier 2 max pop",
    "D40": "Tier 3 max pop",
    "D41": "Tier 4 max pop",
    "D42": "Tier 5 max pop",
    "D43": "Tier 6 max pop",
    "E38": "Tier 1 customer pop",
    "E39": "Tier 2 customer pop",
    "E40": "Tier 3 customer pop",
    "E41": "Tier 4 customer pop",
    "E42": "Tier 5 customer pop",
    "E43": "Tier 6 customer pop",
    "F38": "Tier 1 discount",
    "F39": "Tier 2 discount",
    "F40": "Tier 3 discount",
    "F41": "Tier 4 discount",
    "F42": "Tier 5 discount",
    "F43": "Tier 6 discount",
    "G38": "Tier 1 blended price/call",
    "G39": "Tier 2 blended price/call",
    "H38": "Tier 1 list price",
    "H39": "Tier 2 list price",
    "H40": "Tier 3 list price",
    "H41": "Tier 4 list price",
    "H42": "Tier 5 list price",
    "H43": "Tier 6 list price",
    "H34": "Total at Max Pop List Price",
}
for cell, label in labels.items():
    v = ws[cell].value
    print(f"  {cell:5s}  {label:40s}  =  {v}")

print()
print("=== Direct ARR Price Sheet computed ===")
ws2 = wb["Direct ARR Price Sheet "]
for cell, label in [
    ("D7", "Program Annual List Price"),
    ("D9", "Partner Discount"),
    ("D11", "Total Effective Annual Price"),
    ("H7", "Avg Price / Call"),
    ("H9", "Avg Price / Diversion"),
    ("H11", "Avg Calls / Month"),
    ("H13", "Avg Diversions / Month"),
    ("C18", "Total Calls / Year"),
    ("D18", "Total Diversions / Year"),
    ("E25", "Tier 1 Discounted Price"),
    ("E26", "Tier 2 Discounted Price"),
    ("E27", "Tier 3 Discounted Price"),
    ("E28", "Tier 4 Discounted Price"),
    ("E29", "Tier 5 Discounted Price"),
    ("E30", "Tier 6 Discounted Price"),
    ("D25", "Tier 1 List Price"),
    ("D26", "Tier 2 List Price"),
    ("D27", "Tier 3 List Price"),
    ("D28", "Tier 4 List Price"),
    ("D29", "Tier 5 List Price"),
    ("D30", "Tier 6 List Price"),
]:
    v = ws2[cell].value
    print(f"  {cell:5s}  {label:40s}  =  {v}")
