import { ReactNode } from 'react';
import NextTopLoader from 'nextjs-toploader';
import { ChefHat } from 'lucide-react';

export default function ReportLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-100 via-blue-50 to-slate-200 flex flex-col items-center font-sans selection:bg-blue-600 selection:text-white">
      <NextTopLoader color="#2563eb" showSpinner={false} shadow="0 0 10px #2563eb,0 0 5px #2563eb" />
      
      <main className="flex-1 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out flex flex-col">
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
