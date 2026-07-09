import { ReactNode } from 'react';
import NextTopLoader from 'nextjs-toploader';

export default function ReportLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center font-sans">
      <NextTopLoader color="#ffffff" showSpinner={false} />
      <header className="w-full max-w-xl bg-blue-600 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-lg font-bold">Facility Feedback</h1>
      </header>
      <main className="flex-1 w-full max-w-xl p-4">
        {children}
      </main>
      <footer className="w-full max-w-xl p-4 text-center text-xs text-gray-400 mt-auto pb-8">
        Powered by Cookhouse IFMS
      </footer>
    </div>
  );
}
