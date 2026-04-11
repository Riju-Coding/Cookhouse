"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CompanyBuilding {
  companyName: string
  buildingName: string
}

interface ItemRow {
  key: string
  subServiceName: string
  itemName: string
  companyCount: number
  companies: CompanyBuilding[]
}

interface CompanyBuildingModalProps {
  item: ItemRow
  onClose: () => void
}

export function CompanyBuildingModal({
  item,
  onClose,
}: CompanyBuildingModalProps) {
  if (!item) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Company Mappings</h2>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">{item.itemName}</span> from <span className="font-medium">{item.subServiceName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {item.companies.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {/* Table Header */}
              <div className="sticky top-0 bg-gray-50 grid grid-cols-2 gap-4 p-4 font-semibold text-sm text-gray-700">
                <div>Company Name</div>
                <div>Building Name</div>
              </div>

              {/* Table Body */}
              {item.companies.map((company, index) => (
                <div
                  key={index}
                  className="grid grid-cols-2 gap-4 p-4 text-sm hover:bg-gray-50 transition-colors"
                >
                  <div className="text-gray-900 font-medium">{company.companyName}</div>
                  <div className="text-gray-700">{company.buildingName}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center p-8 text-gray-500">
              No company-building mappings found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end shrink-0">
          <Button
            onClick={onClose}
            className="bg-blue-700 text-white hover:bg-blue-800"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
