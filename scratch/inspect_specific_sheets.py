import json

with open('C:/Cookhouseadmin-main/scratch/all_grids.json', 'r', encoding='utf-8') as f:
    sheets = json.load(f)

sheets_to_inspect = [
    'Medical cleaning clecklist',
    'PROJECT BUNK ',
    'MAHI TOEWR',
    'PAD',
    'EYE WASH CHECKLIST',
    'STAFF BUNK ',
    'DRIVER BUNK',
    'Water Disp.',
    'GATE. 2',
    'Front'
]

for s in sheets:
    if s['sheet_name'] in sheets_to_inspect:
        print(f"\n==================== SHEET: {s['sheet_name']} (rows: {s['max_row']}, cols: {s['max_col']}) ====================")
        grid = s['grid']
        for r_idx in range(min(15, len(grid))):
            row = grid[r_idx]
            # print non empty
            items = [f"C{c}:{row[c]}" for c in range(min(len(row), 25)) if row[c]]
            if items:
                print(f"Row {r_idx+1}: " + " | ".join(items[:8]))
