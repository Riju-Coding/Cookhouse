import re

def update_file():
    with open('components/choice-selection-modal.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    target_start = r'return \(\s*<div key=\{item\.id\} className="flex items-start gap-1">'
    target_end = r'</div>\s*\)\s*\}\)\}\s*</div>\s*</div>\s*\)'

    match = re.search(target_start + r'[\s\S]*?' + target_end, content)
    if not match:
        print("Block not found!")
        return

    replacement = '''return (
                                                <div key={item.id} className="flex items-start gap-1">
                                                  {isSelectedHere && <span className="text-gray-400 font-normal mt-1.5 text-[10px] ml-1">|-</span>}
                                                  <label
                                                    title={item._debugReason}
                                                    className={`
                                                      flex-1 flex items-start gap-2 px-2 py-1.5 rounded text-[11px] transition-all border
                                                      ${!item._isIncluded 
                                                        ? 'opacity-40 cursor-not-allowed bg-red-50 border-red-200 grayscale pointer-events-none' 
                                                        : isDisabled
                                                          ? 'opacity-60 cursor-not-allowed bg-gray-200 border-gray-300'
                                                          : isSelectedHere
                                                            ? 'shadow-sm border-transparent'
                                                            : 'bg-white border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50'}
                                                    `}
                                                    style={isSelectedHere && cc ? { backgroundColor: cc.selectedBg } : {}}
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      className="mt-0.5 rounded border-gray-300 w-3 h-3 cursor-pointer disabled:cursor-not-allowed shrink-0"
                                                      checked={isSelectedHere}
                                                      disabled={isDisabled || !item._isIncluded}
                                                      onChange={() => {
                                                        if (!isDisabled && item._isIncluded) {
                                                          toggleSelection(choice.choiceId, itemRow, item)
                                                        }
                                                      }}
                                                      style={cc && isSelectedHere ? { accentColor: cc.primary } : {}}
                                                    />
                                                    <div className="flex flex-col leading-tight pt-[1px] w-full">
                                                      <span className={`${isSelectedHere ? 'font-bold' : 'font-medium'} ${isDisabled || !item._isIncluded ? 'text-gray-500' : 'text-gray-700'}`}>
                                                        {item.name}
                                                      </span>
                                                      {!item._isIncluded && (
                                                        <span className="text-[9px] text-red-500 font-medium leading-tight mt-0.5">
                                                          {item._debugReason}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </label>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )'''

    new_content = content.replace(match.group(0), replacement)
    
    with open('components/choice-selection-modal.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("UI rendering updated successfully.")

if __name__ == "__main__":
    update_file()
