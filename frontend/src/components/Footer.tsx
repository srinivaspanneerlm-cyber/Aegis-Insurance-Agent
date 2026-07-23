"use client";

import { Shield, Mail, Phone, MapPin, Award, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-navy-950 text-slate-300 border-t border-slate-800/80">
      {/* Top Banner: What Aegis AI is (and isn't) */}
      <div className="max-w-7xl mx-auto px-6 py-10 border-b border-slate-800/60 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center text-cyan-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-base">Independent guidance, not a sales desk</h4>
            <p className="text-[13px] text-slate-400 mt-0.5">Aegis AI is an educational insurance-guidance platform — not a licensed insurer. You buy any policy directly from the insurer.</p>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
        {/* Brand Block */}
        <div className="col-span-2 flex flex-col gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-royal-600 to-cyan-500 flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Aegis <span className="text-cyan-400">AI</span>
            </span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-slate-400 pr-4">
            Aegis AI pairs specialist AI advisors with a curated policy catalogue so families can understand what they are buying before they buy it — in plain language, at their own pace.
          </p>
          <div className="flex flex-col gap-2.5 mt-2 text-[13.5px] text-slate-400">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-royal-500" />
              <span>1800-419-8800 (Toll-Free, 24/7 Support)</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-500" />
              <span>protection@aegis.ai</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500" />
              <span>Fintech Plaza, Outer Ring Road, Bangalore - 560103</span>
            </div>
          </div>
        </div>

        {/* Columns */}
        <div>
          <h5 className="font-semibold text-white text-[14px] uppercase tracking-wider mb-5">Products</h5>
          <ul className="space-y-3.5 text-[14px]">
            {["Family Health Shield", "AI Term Life Plan", "Smart Vehicle Guard", "Travel Secure Plus", "Critical Illness Cover"].map((item, idx) => (
              <li key={idx}>
                <a href="#" className="hover:text-white transition-colors">{item}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="font-semibold text-white text-[14px] uppercase tracking-wider mb-5">Resources</h5>
          <ul className="space-y-3.5 text-[14px]">
            {["AI Advisor Center", "Online Claims Filing", "Premium Calculator", "Help Center 24/7", "Network Hospitals"].map((item, idx) => (
              <li key={idx}>
                <a href="#" className="hover:text-white transition-colors">{item}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="font-semibold text-white text-[14px] uppercase tracking-wider mb-5">Legal & Trust</h5>
          <ul className="space-y-3.5 text-[14px]">
            {["Privacy Protection", "Terms of Service", "Claim Disclosure", "Security & Privacy", "Grievance Redressal"].map((item, idx) => (
              <li key={idx}>
                <a href="#" className="hover:text-white transition-colors">{item}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Compliance Disclaimer */}
      <div className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-800/60 text-[11px] text-slate-500 leading-relaxed space-y-3">
        <p>
          *Disclaimer: Insurance is the subject matter of solicitation. Standard terms and conditions apply. Aegis AI is an educational insurance-guidance platform — not a licensed insurer, and it is not registered with IRDAI as an intermediary. Recommendations are non-binding advisory calculations and are subject to the final terms and underwriting of the insurance provider you choose to buy from.
        </p>
        <p>
          © 2026 Aegis Insurance Solutions Ltd. All rights reserved. Made with <Heart className="w-3 h-3 text-red-500 inline fill-red-500" /> for family security and emotional wellness.
        </p>
      </div>
    </footer>
  );
}
