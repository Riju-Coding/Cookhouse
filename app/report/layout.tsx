import { ReactNode } from 'react';
import NextTopLoader from 'nextjs-toploader';
import { ChefHat } from 'lucide-react';

export default function ReportLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-100 via-blue-50 to-slate-200 flex flex-col items-center font-sans selection:bg-blue-600 selection:text-white">
      <NextTopLoader color="#2563eb" showSpinner={false} shadow="0 0 10px #2563eb,0 0 5px #2563eb" />
      <header className="w-full max-w-2xl bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)] sticky top-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">Facility Feedback</h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Guest Services</p>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl p-4 sm:p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        {children}
      </main>
      <footer className="w-full max-w-2xl p-6 text-center mt-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 backdrop-blur-md rounded-full border border-white/40 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Powered by</span>
          <span className="text-[11px] font-black text-slate-800">Cookhouse IFMS</span>
        </div>
      </footer>
    </div>
  );
}
