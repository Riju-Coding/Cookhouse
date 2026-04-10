import React from "react"
import { AlertCircle } from "lucide-react"
import type { FrequencyViolation } from "@/lib/frequency-validator"

interface FrequencyViolationsAlertProps {
  violations: FrequencyViolation[]
}

export function FrequencyViolationsAlert({ violations }: FrequencyViolationsAlertProps) {
  if (violations.length === 0) return null

  return (
    <div className="px-6 py-3 bg-red-50 border-b border-red-200">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-red-900 text-sm">
            {violations.length === 1
              ? "1 Sub-Meal Plan Exceeds Frequency Limit"
              : `${violations.length} Sub-Meal Plans Exceed Frequency Limits`}
          </h3>
          <div className="mt-2 space-y-1">
            {violations.map((violation) => (
              <p key={violation.subMealPlanId} className="text-xs text-red-700">
                <span className="font-medium">{violation.subMealPlanName}</span>:{" "}
                <span className="font-semibold text-red-900">{violation.current}</span> selections
                {violation.max > 0 && (
                  <>
                    {" "}(limit: <span className="font-semibold">{violation.max}</span> per week){" "}
                    <span className="inline-block ml-1 px-2 py-0.5 bg-red-200 text-red-800 rounded text-[10px] font-bold">
                      +{violation.excessAmount} {violation.excessAmount === 1 ? "over" : "over"}
                    </span>
                  </>
                )}
              </p>
            ))}
          </div>
          <p className="text-[11px] text-red-600 mt-2 font-medium">
            You can continue, but these items exceed their weekly frequency limits.
          </p>
        </div>
      </div>
    </div>
  )
}
