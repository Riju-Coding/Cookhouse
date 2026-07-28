import re

with open('app/admin/meal-plan-structure/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad = '''            {isSuperAdmin && <Button
              onClick={handleCopyStructureToBuildings}
              disabled={copyLoading || selectedTargetBuildings.length === 0}
            >
              {copyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Confirm Copy
            </Button>
          </DialogFooter>'''
good = '''            {isSuperAdmin && <Button
              onClick={handleCopyStructureToBuildings}
              disabled={copyLoading || selectedTargetBuildings.length === 0}
            >
              {copyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Confirm Copy
            </Button>}
          </DialogFooter>'''
content = content.replace(bad, good)

with open('app/admin/meal-plan-structure/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
