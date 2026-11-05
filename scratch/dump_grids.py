import openpyxl
import json
import re

wb_path = 'C:/Users/Sudipta/.gemini/antigravity/brain/c57882e7-b38f-4cf1-ba98-c33ed9636659/.user_uploaded/media_1791869408941_22111678.xlsx'
wb = openpyxl.load_workbook(wb_path, data_only=True)

all_checklists = []

for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    if ws.max_row <= 2 and ws.max_column <= 2:
        continue # skip empty
    
    # Read grid
    grid = []
    for r in range(1, min(ws.max_row + 1, 45)):
        row_cells = []
        for c in range(1, min(ws.max_column + 1, 40)):
            v = ws.cell(r, c).value
            row_cells.append("" if v is None else str(v).strip())
        grid.append(row_cells)
    
    all_checklists.append({
        "sheet_name": sheet_name,
        "max_row": ws.max_row,
        "max_col": ws.max_column,
        "grid": grid
    })

print(f"Loaded {len(all_checklists)} sheets for deep analysis.")

with open('C:/Cookhouseadmin-main/scratch/all_grids.json', 'w', encoding='utf-8') as f:
    json.dump(all_checklists, f, ensure_ascii=False)
