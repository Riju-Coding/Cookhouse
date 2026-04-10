import { Building2 } from "lucide-react"
import type { UpdationRecord } from "./types"

export const UpdationRecordBadge = ({ updation }: { updation: UpdationRecord }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-700">#{updation.updationNumber}</span>
      {updation.isCompanyWiseChange && updation.sourcedFromCompanyName ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
          <Building2 className="h-3 w-3" />
          {updation.sourcedFromCompanyName}
        </span>
      ) : null}
    </div>
  )
}
