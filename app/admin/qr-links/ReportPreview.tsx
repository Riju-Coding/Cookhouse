import React from "react"
import { ChefHat, MapPin } from "lucide-react"

export default function ReportPreview({ customization, companyName, buildingName, cafeName }: any) {

  const category = "Food Quality" 

  return (
    <div className="bg-slate-100 rounded-[2rem] overflow-hidden w-full max-w-sm mx-auto shadow-xl border-[6px] border-slate-800 h-[700px] flex flex-col relative scale-[0.9] origin-top md:origin-top-right">
      {/* Dynamic Header */}
      {customization.showHeader !== false && (
      <header className="w-full bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-sm sticky top-0 z-50 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-1.5 rounded-lg shadow-lg">
            <ChefHat className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 truncate max-w-[180px]">
              {customization.headerText || "Facility Feedback"}
            </h1>
            <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">Guest Services</p>
          </div>
        </div>
      </header>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-12 custom-scrollbar">
        
        {/* Location Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-50 p-2 rounded-xl border border-blue-100/50 shrink-0 mt-1">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                {customization.showReportingIssueAt !== false && (
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider truncate">{customization.reportingIssueAtText || "Reporting issue at"}</p>
                )}
                <h2 className="text-lg font-black text-slate-800 leading-tight truncate">{cafeName || "Select a Cafe"}</h2>
                <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] font-semibold text-slate-500">
                  {customization.showBuildingName !== false && <span className="bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[100px]">{buildingName || "Building"}</span>}
                  {(customization.showBuildingName !== false && customization.showCompanyName !== false) && <span>•</span>}
                  {customization.showCompanyName !== false && <span className="truncate max-w-[100px]">{companyName || "Company"}</span>}
                </div>
              </div>
            </div>
            
            {customization.showTrackTicket !== false && (
              <div className="mt-3">
                <div className="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-lg text-xs font-bold text-blue-600 cursor-pointer">Track Ticket</div>
              </div>
            )}
          </div>
        </div>

        {/* Mock Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700">Issue Category <span className="text-red-500">*</span></label>
            <div className="w-full bg-white border-2 border-blue-500/20 ring-4 ring-blue-500/10 rounded-xl p-2.5 text-xs font-semibold text-slate-700 flex justify-between items-center">
              <span>{category}</span>
              <div className="w-2 h-2 border-b-2 border-r-2 border-slate-400 rotate-45 mr-1" />
            </div>
          </div>

          {customization.showPriority !== false && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">Urgency / Priority</label>
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-700 flex items-center justify-between">
                <span><span className="text-blue-600 font-bold mr-1">•</span>Medium</span>
                <div className="w-2 h-2 border-b-2 border-r-2 border-slate-400 rotate-45 mr-1" />
              </div>
            </div>
          )}

          {customization.showRemarks !== false && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">General Remarks (Optional)</label>
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-400 h-20 flex items-start">Any overall feedback...</div>
            </div>
          )}

          {/* Food Header Mock */}
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-5 relative shadow-md mt-6">
             <div className="absolute inset-0 opacity-20" style={{backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "20px 20px"}} />
             <div className="relative z-10">
                {customization.showFeedbackFormHeader !== false && (
                  <>
                    <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full mb-2">
                      <ChefHat className="w-3 h-3 text-white" />
                      <span className="text-[9px] font-black text-white uppercase tracking-wider">{customization.feedbackFormHeaderText || "Today's Meal Feedback"}</span>
                    </div>
                  </>
                )}
                {customization.showFeedbackFormHeader !== false && (
                    <h3 className="text-lg font-black text-white tracking-tight">How was your meal? 🍽️</h3>
                )}
                {customization.showFeedbackFormSubHeader !== false && (
                  <p className="text-white/80 text-[11px] font-medium mt-1 leading-snug">
                    {customization.feedbackFormSubHeaderText || "Rate each dish honestly — your feedback helps us improve!"}
                  </p>
                )}
              </div>
          </div>

          <div className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl py-3 text-center text-sm font-bold mt-6 shadow-lg shadow-blue-500/20 transform hover:scale-[1.02] transition-transform cursor-pointer">
             {customization.submitButtonText || "Submit Complaint"}
          </div>

        </div>

      </div>
    </div>
  )
}
