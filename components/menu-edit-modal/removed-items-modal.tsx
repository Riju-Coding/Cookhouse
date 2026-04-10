import { memo } from "react"
import { Building2, X } from "lucide-react"

export const RemovedItemsModal = memo(function RemovedItemsModal({
  isOpen,
  onClose,
  itemName,
  companies: removedCompanies,
  allCompanies,
  allBuildings,
}: {
  isOpen: boolean
  onClose: () => void
  itemName: string
  companies: Array<{ companyId: string; buildingId: string }>
  allCompanies: any[]
  allBuildings: any[]
}) {
  if (!isOpen) return null

  const companyBuildingMap = removedCompanies.reduce((acc, comp) => {
    if (!acc[comp.companyId]) {
      acc[comp.companyId] = []
    }
    acc[comp.companyId].push(comp.buildingId)
    return acc
  }, {} as Record<string, string[]>)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[150] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[60vh] overflow-auto">
        <div className="sticky top-0 bg-gradient-to-r from-red-50 to-white border-b p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-red-600" />
              Removed From
            </h3>
            <p className="text-sm text-gray-600 mt-1 font-medium">{itemName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {Object.entries(companyBuildingMap).map(([compId, buildingIds]) => {
            const company = allCompanies?.find((c: any) => c.id === compId)
            return (
              <div key={compId} className="border rounded-lg p-3 bg-red-50 border-red-200">
                <div className="text-sm font-semibold text-gray-900">{company?.name || compId}</div>
                <div className="mt-2 space-y-1">
                  {(buildingIds as string[]).map((buildingId) => {
                    const building = allBuildings?.find((b: any) => b.id === buildingId)
                    return (
                      <div key={buildingId} className="text-sm text-gray-700 ml-3 flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-gray-400" />
                        {building?.name || buildingId}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
