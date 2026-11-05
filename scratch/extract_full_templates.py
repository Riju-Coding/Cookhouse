import json
import re

with open('C:/Cookhouseadmin-main/scratch/all_grids.json', 'r', encoding='utf-8') as f:
    sheets = json.load(f)

templates = []

def clean_str(s):
    if not s:
        return ""
    # remove line breaks and multiple spaces
    s = " ".join(str(s).split())
    # remove formula errors
    if s.startswith('#') or s.startswith('='):
        return ""
    return s.strip()

for s in sheets:
    sheet_name = s['sheet_name']
    grid = s['grid']
    
    # ── SPECIAL HANDLING PER SHEET TYPE ──
    if sheet_name == 'Water Disp.':
        # 12 steps
        questions = []
        for r_idx in range(3, min(len(grid), 16)):
            step_text = clean_str(grid[r_idx][1] if len(grid[r_idx]) > 1 else "")
            if step_text and not step_text.upper().startswith('CLEANING'):
                questions.append({
                    "question": f"Step {len(questions)+1}: {step_text}",
                    "type": "yes_no",
                    "isRequired": True,
                    "isPhotoRequired": "sumatab" in step_text.lower() or "rinse" in step_text.lower()
                })
        templates.append({
            "key": "water_dispenser_cleaning",
            "sheet_name": sheet_name,
            "title": "Water Dispenser 12-Step Chemical Sanitization Checklist",
            "department": "Housekeeping & Hygiene",
            "category": "Hygiene & Sanitization",
            "frequency": "weekly",
            "building_applicability": "BOTH",
            "assignedRole": "Housekeeper / Supervisor",
            "description": "Standardized 12-step sanitization cycle for water dispensers using Sumatab 150ppm solution with 15-minute contact time.",
            "questions": questions
        })
        continue

    if sheet_name == 'EYE WASH CHECKLIST':
        questions = [
            {"question": "Inspect Eye Wash Bottle seal, cleanliness and expiry date", "type": "yes_no", "isRequired": True, "isPhotoRequired": True},
            {"question": "Verify fluid permissible limit & clarity (clean, sterile saline/potable water)", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Housekeeper Refill Status (Full / Refilled / Replaced)", "type": "dropdown", "options": ["Adequate / No Refill Needed", "Refilled to Max Mark", "Bottle Replaced", "Defective - Escalated"], "isRequired": True, "isPhotoRequired": True},
            {"question": "Quantity refilled (ml)", "type": "number", "unit": "ml", "isRequired": False, "isPhotoRequired": False},
            {"question": "Inspection / Refill Remarks", "type": "text", "isRequired": False, "isPhotoRequired": False},
            {"question": "Supervisor / HSE Sign-off Verification", "type": "yes_no", "isRequired": True, "isPhotoRequired": False}
        ]
        templates.append({
            "key": "eye_wash_refilling",
            "sheet_name": sheet_name,
            "title": "Eye Wash Bottle Refilling & HSE Inspection Checklist",
            "department": "Health, Safety & Environment (HSE)",
            "category": "Safety & Emergency Readiness",
            "frequency": "daily",
            "building_applicability": "BOTH",
            "assignedRole": "Housekeeper / HSE Supervisor",
            "description": "Emergency eye wash station readiness, fluid permissible limits, seal verification, and housekeeper refilling log.",
            "questions": questions
        })
        continue

    if sheet_name == 'PAD':
        questions = [
            {"question": "Sanitary Pad Dispenser Stock Available (Units remaining)", "type": "number", "unit": "pcs", "isRequired": True, "isPhotoRequired": False},
            {"question": "Dispenser Cleanliness & Mechanical Functionality", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Refill Quantity Added (Units)", "type": "number", "unit": "pcs", "isRequired": True, "isPhotoRequired": True},
            {"question": "Disposal Bin Cleaned, Sanitized & Lined with Biohazard Bag", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Housekeeper Refill Verification Sign", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Supervisor Remarks / Restock Notes", "type": "text", "isRequired": False, "isPhotoRequired": False}
        ]
        templates.append({
            "key": "sanitary_pads_dispenser",
            "sheet_name": sheet_name,
            "title": "Sanitary Napkin Dispenser Restocking & Hygiene Checklist",
            "department": "Housekeeping & Female Restrooms",
            "category": "Female Hygiene",
            "frequency": "daily",
            "building_applicability": "BOTH",
            "assignedRole": "Female Housekeeper / Supervisor",
            "description": "Daily monitoring of sanitary napkin dispenser stocks, restocking counts, coin/twist mechanism check, and waste bin sanitation.",
            "questions": questions
        })
        continue

    if sheet_name == 'Front':
        # Front Office tasks
        questions = []
        raw_row = grid[1] if len(grid) > 1 else []
        for c in raw_row:
            txt = clean_str(c)
            if txt and txt.upper() not in ['DATE', 'SL', 'REMARKS']:
                questions.append({
                    "question": txt.title(),
                    "type": "yes_no",
                    "isRequired": True,
                    "isPhotoRequired": "scanned" in txt.lower() or "access" in txt.lower() or "register" in txt.lower()
                })
        templates.append({
            "key": "front_office_daily_work",
            "sheet_name": sheet_name,
            "title": "Front Office Daily Operations & Front Desk SOP Checklist",
            "department": "Front Office & Administration",
            "category": "Front Desk & Guest Logistics",
            "frequency": "daily",
            "building_applicability": "OB",
            "assignedRole": "Front Desk Executive / Supervisor",
            "description": "Daily administrative checklist covering biometric/touch card access, attendance records, P.O.B. counts, arrival/departure handover, and water reporting.",
            "questions": questions
        })
        continue

    if sheet_name == 'DRIVER BUNK':
        questions = [
            {"question": f"Driver Bunk No.{i} - Complete Bedding, Floor & Dusting Sanitation", "type": "yes_no", "isRequired": True, "isPhotoRequired": (i == 1 or i == 7)}
            for i in range(1, 15)
        ]
        questions.extend([
            {"question": "Driver Rest Area Bathrooms & Wash basins cleaned & sanitized", "type": "yes_no", "isRequired": True, "isPhotoRequired": True},
            {"question": "Linen / Blanket replacement completed for vacated driver bunks", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Housekeeper Name & Daily Shift Completion Sign", "type": "text", "isRequired": True, "isPhotoRequired": False},
            {"question": "Supervisor Verification & Shift Sign-off", "type": "yes_no", "isRequired": True, "isPhotoRequired": False}
        ])
        templates.append({
            "key": "driver_bunk_daily_cleaning",
            "sheet_name": sheet_name,
            "title": "Driver Bunk Quarters Daily Deep Cleaning Checklist",
            "department": "Housekeeping & Accommodation",
            "category": "Driver Living Quarters",
            "frequency": "daily",
            "building_applicability": "MPT",
            "assignedRole": "Housekeeper / Camp Supervisor",
            "description": "Driver accommodation bunks (Bunks 1-14) daily cleaning, linen change, dusting, pest repellant, and toilet sanitation.",
            "questions": questions
        })
        continue

    if sheet_name == 'STAFF BUNK ':
        questions = [
            {"question": f"Staff Bunk No.{i} - Complete Bedding, Floor Mopping & Dusting", "type": "yes_no", "isRequired": True, "isPhotoRequired": (i == 1 or i == 5)}
            for i in range(1, 6)
        ]
        questions.extend([
            {"question": "Staff Washroom, Geyser & Fittings Sanitization", "type": "yes_no", "isRequired": True, "isPhotoRequired": True},
            {"question": "All AC / Fan / Lights switches operational and clean", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Housekeeper / Staff Attendant Signature", "type": "text", "isRequired": True, "isPhotoRequired": False},
            {"question": "Supervisor Inspection Sign-off", "type": "yes_no", "isRequired": True, "isPhotoRequired": False}
        ])
        templates.append({
            "key": "staff_bunk_daily_cleaning",
            "sheet_name": sheet_name,
            "title": "Staff Bunk Quarters Daily Cleaning Checklist",
            "department": "Housekeeping & Accommodation",
            "category": "Staff Accommodation",
            "frequency": "daily",
            "building_applicability": "BOTH",
            "assignedRole": "Housekeeper / Supervisor",
            "description": "Sodexo staff quarters bunks 1 to 5 daily inspection, hygiene check, linen tidiness, and electrical fitting safety.",
            "questions": questions
        })
        continue

    if sheet_name == 'GATE. 2':
        questions = [
            {"question": "Gate No. 2 Security Cabin HK Status (Pass / Fail)", "type": "yes_no", "isRequired": True, "isPhotoRequired": True},
            {"question": "Floor swept, mopped, and free of sand/oil stains", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Security desk, glass panels & boom barrier console wiped clean", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Waste bin emptied and fresh bin liner installed", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Drinking water pot / dispenser replenished for on-duty guards", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Cleaner Name & Timestamp", "type": "text", "isRequired": True, "isPhotoRequired": False},
            {"question": "Security Guard On-Duty Name & Endorsement Sign", "type": "text", "isRequired": True, "isPhotoRequired": False},
            {"question": "Remarks / Maintenance Issues Noted", "type": "text", "isRequired": False, "isPhotoRequired": False}
        ]
        templates.append({
            "key": "gate_2_security_cleaning",
            "sheet_name": sheet_name,
            "title": "Gate No. 2 Security Post & Access Control Cleaning Checklist",
            "department": "Security & Plant Logistics",
            "category": "Security Outposts",
            "frequency": "daily",
            "building_applicability": "MPT",
            "assignedRole": "Housekeeper / Security Guard",
            "description": "Daily hygiene, glass cleaning, boom barrier perimeter, and dual sign-off between housekeeping cleaner and on-duty security guard.",
            "questions": questions
        })
        continue

    if sheet_name == 'GROOMING CHECK CARD ':
        questions = [
            {"question": "Uniform: Clean, ironed, complete company uniform with name badge", "type": "yes_no", "isRequired": True, "isPhotoRequired": True},
            {"question": "Shoes & Socks: Clean safety shoes / non-slip footwear and fresh dark socks", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Hair: Neatly groomed, trimmed hair / clean cap or hairnet in place", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Nails: Short, clean, trimmed without nail paint or dirt", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Shaving: Clean shaven or neatly manicured beard policy compliance", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Personal Hygiene: Clean hands, no body odor, fresh personal appearance", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Dusters: Correct color-coded microfibre dusters carrying on person", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Pledge Card: Sodexo / Cairn Quality & Safety Pledge Card carried", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Jewellery Policy: Zero rings, bracelets, or watches in sensitive zones", "type": "yes_no", "isRequired": True, "isPhotoRequired": False},
            {"question": "Staff Name, Designation & Shift", "type": "text", "isRequired": True, "isPhotoRequired": False},
            {"question": "Supervisor / Camp Boss Signature Verification", "type": "yes_no", "isRequired": True, "isPhotoRequired": False}
        ]
        templates.append({
            "key": "grooming_check_card",
            "sheet_name": sheet_name,
            "title": "Staff Personal Hygiene, Uniform & Grooming Audit Card",
            "department": "HSE & Quality Assurance",
            "category": "Staff Grooming & SOP",
            "frequency": "daily",
            "building_applicability": "BOTH",
            "assignedRole": "Housekeeping Supervisor / Camp Boss",
            "description": "Daily shift start line-up inspection: 10-point personal hygiene, uniform, nail, shaving, pledge card, and color-coded duster verification.",
            "questions": questions
        })
        continue

    # ── STANDARD MONTHLY MATRIX CHECKLISTS (Columns as Questions) ──
    # Find question header row
    header_idx = -1
    for r in range(1, 5):
        row = grid[r]
        valid_items = [clean_str(c) for c in row if len(clean_str(c)) > 2 and clean_str(c).upper() not in ['DATE', 'SL', 'NO']]
        if len(valid_items) >= 4:
            header_idx = r
            break
            
    if header_idx == -1:
        header_idx = 2 # fallback row 3
        
    raw_questions = []
    h_row = grid[header_idx]
    for c_idx, cell in enumerate(h_row):
        c_txt = clean_str(cell)
        if not c_txt:
            continue
        c_upper = c_txt.upper()
        if c_upper in ['DATE', 'SL', 'S.NO', 'S/N', 'DAY', 'SIGN', 'HOUSEKEEPER', 'SUPERVISOR', 'SIGNATURE', 'REMARKS', 'TIME']:
            continue
        if c_txt.isdigit():
            continue
        # Also check if row above or below had merged text
        combined = c_txt
        if header_idx > 0 and len(grid[header_idx-1]) > c_idx:
            above = clean_str(grid[header_idx-1][c_idx])
            if above and above.upper() not in ['DATE', 'MONTH', 'SODEXO'] and not above.isdigit() and len(above) < 20:
                if above not in combined:
                    combined = f"{above} {combined}"
        
        # Normalize text
        combined = " ".join(combined.split())
        if combined not in [q["question"] for q in raw_questions] and len(combined) > 1:
            is_photo = any(kw in combined.lower() for kw in ['mirror', 'toilet', 'urinal', 'bed', 'sofa', 'stair', 'plant', 'stp', 'floor', 'drain'])
            raw_questions.append({
                "question": combined,
                "type": "yes_no",
                "isRequired": True,
                "isPhotoRequired": is_photo
            })

    # Always ensure Housekeeper sign and Supervisor sign are present as checkpoints
    raw_questions.append({
        "question": "Housekeeper Shift Execution Sign-off",
        "type": "yes_no",
        "isRequired": True,
        "isPhotoRequired": False
    })
    raw_questions.append({
        "question": "Supervisor / Camp Boss Quality Verification Sign-off",
        "type": "yes_no",
        "isRequired": True,
        "isPhotoRequired": False
    })

    # Determine Title, Department, Category, Building
    norm_name = sheet_name.strip()
    
    # Building applicability
    bldg = "BOTH"
    if any(k in norm_name.upper() for k in ['OB', 'STP', 'MAHI', 'SARASWATI', 'PEE', 'C BUNK', 'CEC', 'RADIO', 'TELECOM', 'ADMIN']):
        bldg = "OB"
    elif any(k in norm_name.upper() for k in ['MPT', 'REST SHELTER', 'GATE. 2', 'GATE 2', 'DRIVER']):
        bldg = "MPT"
        
    # Department & Category
    dept = "Housekeeping & Facility Management"
    cat = "General Operations"
    
    if 'BUNK' in norm_name.upper() or 'ROOM' in norm_name.upper() or 'TOWER' in norm_name.upper() or 'WING' in norm_name.upper() or 'ACCOMMODATION' in norm_name.upper():
        dept = "Accommodation & Living Quarters"
        cat = "Resident Rooms & Bunks"
    elif 'RADIO' in norm_name or 'TELECOM' in norm_name or 'CEC' in norm_name or 'STP' in norm_name:
        dept = "Technical & Critical Infrastructure"
        cat = "Engineering & Plant Utilities"
    elif 'CAFE' in norm_name.upper() or 'PANTRY' in norm_name.upper() or 'REST SHELTER' in norm_name.upper():
        dept = "Food Services & Pantries"
        cat = "Cafeteria & Dining Areas"
    elif 'GYM' in norm_name.upper() or 'BADMINTON' in norm_name.upper() or 'RECREATION' in norm_name.upper():
        dept = "Recreation & Wellness"
        cat = "Sports & Fitness Amenities"
    elif 'MEDICAL' in norm_name.upper():
        dept = "Medical Center & First Aid"
        cat = "Healthcare Facility"
    elif 'SECURITY' in norm_name.upper() or 'ADMIN' in norm_name.upper():
        dept = "Administration & Security"
        cat = "Security & Corporate Buildings"
    elif 'WASHROOM' in norm_name.upper():
        dept = "Housekeeping & Hygiene"
        cat = "Sanitary Facilities"

    clean_title = f"{norm_name} Cleaning Checklist"
    if "CHECKLIST" in norm_name.upper() or "LIST" in norm_name.upper():
        clean_title = norm_name
    
    # clean extra spaces
    clean_title = " ".join(clean_title.split()).title()

    templates.append({
        "key": re.sub(r'[^a-z0-9]+', '_', norm_name.lower()).strip('_'),
        "sheet_name": sheet_name,
        "title": clean_title,
        "department": dept,
        "category": cat,
        "frequency": "daily",
        "building_applicability": bldg,
        "assignedRole": "Housekeeper / Supervisor",
        "description": f"Daily shift housekeeping and facility inspection checklist for {clean_title} at Cairn {bldg}.",
        "questions": raw_questions
    })

print(f"\n================ SUMMARY ================")
print(f"Total Standardized Templates: {len(templates)}")
with open('C:/Cookhouseadmin-main/scratch/cairn_standardized_templates.json', 'w', encoding='utf-8') as f:
    json.dump(templates, f, indent=2, ensure_ascii=False)

for t in templates:
    print(f"• [{t['building_applicability']}] {t['title']} ({t['department']}) -> {len(t['questions'])} checkpoints")
