import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('C:/Cookhouseadmin-main/scratch/cairn_standardized_templates.json', 'r', encoding='utf-8') as f:
    templates = json.load(f)

with open('C:/Cookhouseadmin-main/scratch/all_questions_out.txt', 'w', encoding='utf-8') as out:
    for t in templates:
        out.write(f"\n=======================================================\n")
        out.write(f"TITLE: {t['title']}\n")
        out.write(f"APPLICABILITY: Cairn {t['building_applicability']} | DEPT: {t['department']} | FREQ: {t['frequency']}\n")
        out.write(f"TOTAL CHECKPOINTS: {len(t['questions'])}\n")
        for i, q in enumerate(t['questions']):
            photo = " [Photo Required]" if q.get('isPhotoRequired') else ""
            out.write(f"  {i+1}. {q['question']}{photo}\n")

print(f"Successfully generated summary for {len(templates)} templates.")
