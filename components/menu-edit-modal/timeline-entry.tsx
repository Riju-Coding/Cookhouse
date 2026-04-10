import { memo } from "react"
import { ArrowRightLeft, Building2, CheckCircle, Minus, Plus } from "lucide-react"

export const TimelineEntry = memo(function TimelineEntry({
  label,
  labelBg,
  itemName,
  action,
  isLive = false,
  buildingCount,
  onBuildingClick,
  removedCompanies = [],
}: {
  label: string
  labelBg: string
  itemName: string
  action: "added" | "removed" | "replaced" | "og" | "null" | "og-null"
  isLive?: boolean
  buildingCount?: number
  onBuildingClick?: () => void
  removedCompanies?: Array<{ companyId: string; buildingId: string }>
}) {
  const config = {
    added: { icon: <Plus className="h-2 w-2" />, color: "text-green-700", bg: "bg-green-50" },
    removed: { icon: <Minus className="h-2 w-2" />, color: "text-red-700", bg: "bg-red-50" },
    replaced: { icon: <ArrowRightLeft className="h-2 w-2" />, color: "text-orange-700", bg: "bg-orange-50" },
    og: { icon: <CheckCircle className="h-2 w-2" />, color: "text-blue-700", bg: "bg-blue-50" },
    null: { icon: <CheckCircle className="h-2 w-2" />, color: "text-gray-600", bg: "bg-gray-50" },
    "og-null": { icon: <CheckCircle className="h-2 w-2" />, color: "text-gray-600", bg: "bg-gray-50" },
  }

  const style = config[action] || config.added

  return (
    <div className={`mb-1.5 relative pl-3 border-l-2 ${isLive ? "border-dashed border-green-300" : "border-gray-200"}`}>
      <div className="flex flex-wrap items-center gap-1">
        <span className={`inline-block ${labelBg} text-white px-1 py-0 rounded text-[8px] font-black uppercase`}>{label}</span>
        <span className={`inline-flex items-center gap-0.5 ${style.bg} ${style.color} px-1 py-0 rounded text-[8px] font-bold border whitespace-nowrap`}>
          {style.icon} {action === "null" || action === "og-null" ? "NULL" : action.toUpperCase()}
        </span>
        {buildingCount && buildingCount > 0 && (
          <button
            onClick={onBuildingClick}
            className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-600 px-1 py-0 rounded text-[8px] font-bold border border-blue-200 hover:bg-blue-100 transition-colors"
            title={`Custom assignments: ${buildingCount} building(s)`}
          >
            <Building2 className="h-2 w-2" />
            <span className="font-semibold">{buildingCount}</span>
          </button>
        )}
      </div>
      <div className={`text-[11px] font-semibold mt-0.5 break-words ${action === "removed" ? "text-red-600 line-through" : "text-gray-800"}`}>
        {action === "null" || action === "og-null" ? "(Empty State)" : itemName}
      </div>
    </div>
  )
})
