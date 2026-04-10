import { memo } from "react"
import { ChevronRight } from "lucide-react"
import type { Service, SubService } from "@/lib/types"

export const ServiceNavigationPanel = memo(function ServiceNavigationPanel({
  services,
  subServices,
  selectedService,
  selectedSubService,
  onSelectService,
  onSelectSubService,
}: {
  services: Service[]
  subServices: Map<string, SubService[]>
  selectedService: Service | null
  selectedSubService: SubService | null
  onSelectService: (service: Service) => void
  onSelectSubService: (subService: SubService) => void
}) {
  return (
    <div className="w-full bg-gray-50 border-b flex gap-2 p-3 overflow-x-auto">
      <div className="flex gap-2">
        {services.map((service) => (
          <div key={service.id}>
            <button
              onClick={() => onSelectService(service)}
              className={`px-4 py-2 rounded font-medium text-sm transition-colors ${selectedService?.id === service.id ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-100"}`}
              type="button"
            >
              {service.name}
            </button>
          </div>
        ))}
      </div>
      {selectedService && (
        <>
          <div className="flex items-center text-gray-400 px-2">
            <ChevronRight className="h-4 w-4" />
          </div>
          <div className="flex gap-2">
            {(subServices.get(selectedService.id) || []).map((subService) => (
              <button
                key={subService.id}
                onClick={() => onSelectSubService(subService)}
                className={`px-4 py-2 rounded font-medium text-sm transition-colors ${selectedSubService?.id === subService.id ? "bg-green-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-100"}`}
                type="button"
              >
                {subService.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})
