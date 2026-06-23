"use client";

import { Shield, Mail, Phone, MapPin, Award, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-navy-950 text-slate-300 border-t border-slate-800/80">
      {/* Top Banner: Safe & Certified */}
      <div className="max-w-7xl mx-auto px-6 py-10 border-b border-slate-800/60 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center text-cyan-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-base">IRDAI Certified & Regulated</h4>
            <p className="text-[13px] text-slate-400 mt-0.5">Registration No. 999 • Evaluated & certified under digital fintech protection code.</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <img src="https://img.shields.io/badge/Security-ISO%2027001-blue" alt="ISO Certification" className="h-6 opacity-75 hover:opacity-100 transition-opacity" />
          <img src="https://img.shields.io/badge/Privacy-GDPR%20Compliant-cyan" alt="GDPR compliance badge" className="h-6 opacity-75 hover:opacity-100 transition-opacity" />
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
            Aegis AI leverages enterprise machine learning and emotional protection frameworks to secure over 50,000+ families across the country with 99.2% claim support success.
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
            {["Privacy Protection", "Terms of Service", "Claim Disclosure", "ISO Certifications", "Grievance Redressal"].map((item, idx) => (
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
          *Disclaimer: Insurance is the subject matter of solicitation. Standard terms and conditions apply. Aegis AI Protection acts as a corporate digital agency (IRDAI Reg. No 999). Information portal is powered by proprietary artificial intelligence models trained on certified open insurance logs. Recommendations provided are non-binding advisory calculations and are subject to final underwriting criteria set by respective insurance partners.
        </p>
        <p>
          © 2026 Aegis Insurance Solutions Ltd. All rights reserved. Made with <Heart className="w-3 h-3 text-red-500 inline fill-red-500" /> for family security and emotional wellness.
        </p>
      </div>
    </footer>
  );
}
