import json
import re

with open('C:/Cookhouseadmin-main/scratch/all_grids.json', 'r', encoding='utf-8') as f:
    sheets = json.load(f)

extracted_templates = []

for s in sheets:
    sheet_name = s['sheet_name']
    grid = s['grid']
    if not grid:
        continue
    
    # 1. Identify title from top 3 rows
    title = ""
    for r in range(min(5, len(grid))):
        row_text = " ".join([c for c in grid[r] if c])
        if "CHECK" in row_text.upper() or "LIST" in row_text.upper() or "CARD" in row_text.upper() or "SODEXO" in row_text.upper() or "TOWER" in row_text.upper() or "BUNK" in row_text.upper() or "FRONT" in row_text.upper() or "GATE" in row_text.upper() or "ROOM" in row_text.upper():
            title = row_text
            break
    if not title and grid:
        title = " ".join([c for c in grid[0] if c])
    
    # Clean up title
    # e.g., remove "MONTH : SEP- 2026" or "FOR THE MONTH OF..."
    clean_title = re.sub(r'FOR THE MONTH OF\s*:\s*.*', '', title, flags=re.IGNORECASE)
    clean_title = re.sub(r'MONTH\s*:\s*.*', '', clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'AREA\s*/\s*LOCATION\s*:.*', '', clean_title, flags=re.IGNORECASE)
    clean_title = clean_title.strip(' -_:|')
    if not clean_title or len(clean_title) < 4:
        clean_title = sheet_name.replace('_', ' ').title() + " Checklist"
    
    # 2. Check header layout: Is it columns-as-questions or rows-as-questions?
    # In standard monthly HK sheets: Row 3 or 4 has questions across columns (col 2 to col N), and Rows 5..35 are dates (1..31).
    # In other sheets (like Front Office, Water Dispenser, Grooming, Pad): Rows 3..N are items, and columns are Dates or details!
    
    questions = []
    
    # Check if rows 4..35 start with dates (1, 2, 3...) in column 0 or 1
    col0_dates = False
    for r in range(3, min(10, len(grid))):
        if len(grid[r]) > 0 and grid[r][0] in ['1', '2', '3', '01', '02', '03']:
            col0_dates = True
            break
        if len(grid[r]) > 1 and grid[r][1] in ['1', '2', '3', '01', '02', '03']:
            col0_dates = True
            break
            
    if col0_dates:
        # Standard Sodexo monthly matrix: Columns are checkpoints!
        # Search for the checkpoint header row (usually row 2 or 3)
        header_row_idx = 2
        for r in range(1, 4):
            # count non-empty text in this row
            non_empty = [c for c in grid[r] if len(c) > 1 and not c.isdigit() and c.upper() != 'DATE']
            if len(non_empty) >= 3:
                header_row_idx = r
                break
                
        h_row = grid[header_row_idx]
        for c_idx, cell in enumerate(h_row):
            cell_txt = cell.strip()
            # If multi-line or whitespace, normalize
            cell_txt = " ".join(cell_txt.split())
            if not cell_txt or cell_txt.upper() in ['DATE', 'SL', 'S.NO', 'S/N', 'DAY', 'SIGN']:
                continue
            if cell_txt.isdigit() or cell_txt.startswith('='):
                continue
            # avoid duplicates
            if cell_txt not in questions and len(cell_txt) > 1:
                questions.append(cell_txt)
    else:
        # Row-based checklist! (e.g. Front Office, Grooming, Water Dispenser, Sanitary Pad, etc.)
        for r_idx in range(len(grid)):
            row = grid[r_idx]
            for c_idx in range(min(5, len(row))):
                cell_txt = row[c_idx].strip()
                cell_txt = " ".join(cell_txt.split())
                # Look for descriptive tasks or questions
                if len(cell_txt) > 3 and not cell_txt.isdigit() and not cell_txt.startswith('='):
                    if any(kw in cell_txt.upper() for kw in ['CLEAN', 'CHECK', 'REFLL', 'REFILL', 'DUST', 'MOP', 'EMPTY', 'INSPECT', 'ENSURE', 'DISINFECT', 'UNIFORM', 'NAIL', 'SHAV', 'BOOT', 'CAP', 'APRON', 'BOTTLE', 'PAD', 'MORNING', 'EVENING', 'NIGHT', 'STEP', 'WASH']):
                        if cell_txt not in questions and cell_txt != clean_title:
                            questions.append(cell_txt)
                            break
                    elif len(cell_txt) > 12 and not any(kw in cell_txt.upper() for kw in ['MONTH', 'SODEXO', 'SIGNATURE', 'SUPERVISOR', 'HOUSEKEEPER', 'LOCATION', 'REMARKS']):
                        if cell_txt not in questions and cell_txt != clean_title:
                            questions.append(cell_txt)
                            break

    extracted_templates.append({
        "sheet_name": sheet_name,
        "clean_title": clean_title,
        "question_count": len(questions),
        "questions": questions,
        "col0_dates": col0_dates
    })

print(f"Parsed {len(extracted_templates)} templates.")
with open('C:/Cookhouseadmin-main/scratch/extracted_summary.json', 'w', encoding='utf-8') as f:
    json.dump(extracted_templates, f, indent=2, ensure_ascii=False)

for t in extracted_templates:
    print(f"[{t['sheet_name']}] '{t['clean_title']}' -> {t['question_count']} questions (col_dates: {t['col0_dates']})")
