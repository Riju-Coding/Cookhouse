import openpyxl
import json
import re

wb_path = 'C:/Users/Sudipta/.gemini/antigravity/brain/c57882e7-b38f-4cf1-ba98-c33ed9636659/.user_uploaded/media_1791869408941_22111678.xlsx'
wb = openpyxl.load_workbook(wb_path, data_only=True)

results = []

for name in wb.sheetnames:
    ws = wb[name]
    if ws.max_row <= 2 and ws.max_column <= 2:
        continue # skip empty sheets
    
    # Collect all non-empty rows up to row 10 to understand header/structure
    sheet_data = {
        "sheet_name": name,
        "max_row": ws.max_row,
        "max_column": ws.max_column,
        "raw_header_rows": []
    }
    
    for r in range(1, min(12, ws.max_row + 1)):
        row_vals = []
        for c in range(1, ws.max_column + 1):
            val = ws.cell(r, c).value
            if val is not None:
                row_vals.append({"col": c, "val": str(val).strip()})
        if row_vals:
            sheet_data["raw_header_rows"].append({"row": r, "cells": row_vals})
            
    results.append(sheet_data)

print(f"Total non-empty sheets found: {len(results)}")
with open('C:/Cookhouseadmin-main/scratch/all_raw_sheets.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

for item in results:
    title = ""
    for hr in item["raw_header_rows"]:
        for cell in hr["cells"]:
            if len(cell["val"]) > 10 and not cell["val"].startswith("="):
                title = cell["val"]
                break
        if title:
            break
    print(f"- Sheet '{item['sheet_name']}': {title[:60]}")
