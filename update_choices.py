import re

def update_file():
    with open('components/choice-selection-modal.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    target_start = r'const filteredItemIds = cell\.menuItemIds\.filter\(\(itemId: string\) => \{'
    target_end = r'\.filter\(Boolean\)'

    # Find the block
    match = re.search(target_start + r'[\s\S]*?' + target_end, content)
    if not match:
        print("Block not found!")
        return

    replacement = '''const itemsData = cell.menuItemIds.map((itemId: string) => {
      const itemCustom = customAssignments[itemId]
      let isIncluded = false;
      let debugReason = "";

      // ═══ PRIORITY 1: Manual (non-choice) custom assignments ═══
      // These come from the ItemCompanyAssignmentModal and ALWAYS take priority
      const manualAssignments = (itemCustom || []).filter((a: any) => !a.isFromChoice)
      if (manualAssignments.length > 0) {
        if (manualAssignments.some((a: any) => a.companyId === companyId && a.buildingId === buildingId)) {
          isIncluded = true;
          debugReason = "Included: Manual assignment (Priority 1)";
        } else {
          isIncluded = false;
          debugReason = "Excluded: Manual assignment for another company (Priority 1)";
        }
      } else if (cellHasChoiceForThisCompany) {
        // ═══ PRIORITY 2: Choice-based assignments ═══
        const isExplicitlyChosen = itemCustom && Array.isArray(itemCustom) && 
               itemCustom.some((a: any) => 
                 a.companyId === companyId && 
                 a.buildingId === buildingId &&
                 a.isFromChoice === true
               )
        if (isExplicitlyChosen) {
          isIncluded = true;
          debugReason = "Included: Explicitly chosen (Priority 2)";
        } else {
          // Check if this item belongs to ANY choice (it's a choice item for another company)
          const isAChoiceItem = itemCustom && Array.isArray(itemCustom) &&
            itemCustom.some((a: any) => a.isFromChoice)

          // ═══ PRIORITY 3: Base (non-choice) item — use default structure ═══
          if (!isAChoiceItem) {
            isIncluded = isDefaultPath;
            debugReason = isIncluded ? "Included: Base item in default structure (Priority 3)" : "Excluded: Not in default structure (Priority 3)";
          } else {
            // Item is a choice item for another company — exclude from this company
            isIncluded = false;
            debugReason = "Excluded: Choice item for another company (Priority 2)";
          }
        }
      } else {
        // ═══ No choice governs this cell — fallback to default structure ═══
        isIncluded = isDefaultPath;
        debugReason = isIncluded ? "Included: Default structure (Fallback)" : "Excluded: Not in default structure (Fallback)";
      }
      return { itemId, isIncluded, debugReason };
    })

    return itemsData
      .map((data: any) => {
        const menuItem = menuItemMap.get(data.itemId);
        if (!menuItem) return null;
        return { ...menuItem, _isIncluded: data.isIncluded, _debugReason: data.debugReason };
      })
      .filter(Boolean)'''

    new_content = content.replace(match.group(0), replacement)
    
    # 2. Update getAllItemsForChoice to use map so it doesn't overwrite items with the same id if they have different debug reasons (wait, it uses a map with item.id, which means it will overwrite. But it's fine for pooling.)
    # Actually, we should only render items that are valid choices? No, we render all of them.
    
    with open('components/choice-selection-modal.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Choice selection modal updated.")

if __name__ == "__main__":
    update_file()
