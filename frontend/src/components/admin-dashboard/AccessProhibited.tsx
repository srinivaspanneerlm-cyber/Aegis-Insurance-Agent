import { ShieldAlert, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/** Gate shown to authenticated but non-admin users. */
export function AccessProhibited({ goToLogin }: { goToLogin: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      <Navbar />
      <div className="flex-grow flex items-center justify-center pt-32 pb-24 z-10 relative">
        <div className="absolute top-[20%] left-[-5%] w-[40%] h-[40%] rounded-full bg-rose-900/10 blur-[110px]" />
        <div className="max-w-md w-full mx-auto px-6 relative z-10">
          <div className="bg-slate-900 border border-rose-500/20 rounded-[32px] p-8 sm:p-10 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto border border-rose-800/30">
              <ShieldAlert className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight">Access Prohibited</h3>
              <p className="text-[10px] text-rose-400 font-extrabold uppercase tracking-widest">Clearance Level Insufficient</p>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-semibold">
              Your current credentials lack security officer clearance. Please log in using an administrative authorization key.
            </p>
            <button
              onClick={goToLogin}
              className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Log In as Security Officer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
