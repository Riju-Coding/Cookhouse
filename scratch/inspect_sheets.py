import openpyxl

wb_path = 'C:/Users/Sudipta/.gemini/antigravity/brain/c57882e7-b38f-4cf1-ba98-c33ed9636659/.user_uploaded/media_1791869408941_22111678.xlsx'
wb = openpyxl.load_workbook(wb_path, data_only=True)

print(f"Total Sheets: {len(wb.sheetnames)}")
for idx, name in enumerate(wb.sheetnames):
    ws = wb[name]
    # find first non-empty text
    headers = []
    for r in range(1, min(10, ws.max_row + 1)):
        row_vals = [str(ws.cell(r, c).value).strip() for c in range(1, min(15, ws.max_column + 1)) if ws.cell(r, c).value is not None]
        if row_vals:
            headers.append(f"R{r}: " + " | ".join(row_vals[:5]))
    preview = "\n  ".join(headers[:3])
    print(f"[{idx+1}] '{name}' (rows: {ws.max_row}, cols: {ws.max_column}):\n  {preview}")
