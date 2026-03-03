"use client"

import { memo } from 'react'
import { ChevronDown, Clock, Plus, Trash2, ArrowRightLeft } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface TimelineEntry {
  timestamp: string
  company: string
  oldValue: string | null
  newValue: string | null
  action: 'added' | 'removed' | 'replaced'
}

export const TimelinePopover = memo(function TimelinePopover({
  timeline,
}: {
  timeline: TimelineEntry[]
}) {
  if (!timeline || timeline.length === 0) {
    return null
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'added':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'removed':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'replaced':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'added':
        return <Plus className="h-3.5 w-3.5" />
      case 'removed':
        return <Trash2 className="h-3.5 w-3.5" />
      case 'replaced':
        return <ArrowRightLeft className="h-3.5 w-3.5" />
      default:
        return <Clock className="h-3.5 w-3.5" />
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-0.5 rounded hover:bg-blue-200 transition-colors flex-shrink-0 bg-blue-100 inline-flex items-center gap-1"
          title={`Timeline: ${timeline.length} change${timeline.length > 1 ? 's' : ''}`}
        >
          <Clock className="h-3 w-3 text-blue-700" />
          <span className="text-xs font-semibold text-blue-700">{timeline.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="bg-white rounded-lg border border-gray-200 shadow-lg">
          <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-white border-b p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-gray-800">Update Timeline</h3>
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              {timeline.length} change{timeline.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            <div className="p-3 space-y-2">
              {timeline.map((entry, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-3 text-xs space-y-1 ${getActionColor(entry.action)}`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <div className="flex items-center gap-1.5">
                      {getActionIcon(entry.action)}
                      <span className="capitalize">{entry.action}</span>
                    </div>
                  </div>

                  <div className="text-[11px] opacity-80">
                    <span className="font-medium">{entry.company}</span>
                  </div>

                  {entry.action === 'replaced' ? (
                    <div className="flex items-center gap-1 pt-1 text-[10px] font-mono">
                      <span className="bg-white bg-opacity-60 px-1.5 py-0.5 rounded line-through">
                        {entry.oldValue || 'empty'}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="bg-white bg-opacity-60 px-1.5 py-0.5 rounded">
                        {entry.newValue || 'empty'}
                      </span>
                    </div>
                  ) : entry.action === 'added' ? (
                    <div className="flex items-center gap-1 pt-1 text-[10px] font-mono">
                      <span className="text-gray-500">added:</span>
                      <span className="bg-white bg-opacity-60 px-1.5 py-0.5 rounded font-semibold">
                        {entry.newValue || 'empty'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 pt-1 text-[10px] font-mono">
                      <span className="text-gray-500">removed:</span>
                      <span className="bg-white bg-opacity-60 px-1.5 py-0.5 rounded line-through">
                        {entry.oldValue || 'empty'}
                      </span>
                    </div>
                  )}

                  <div className="text-[10px] opacity-70 pt-1 border-t border-current border-opacity-20">
                    {new Date(entry.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t p-2 bg-gray-50 text-center">
            <p className="text-[10px] text-gray-500 italic">
              Timeline shows changes from company-wise edits
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
})
