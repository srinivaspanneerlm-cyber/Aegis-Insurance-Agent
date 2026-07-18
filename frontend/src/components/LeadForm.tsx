"use client";

import { useState, useEffect } from "react";
import { User, Phone, Mail, ChevronRight, ChevronLeft, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { leadService } from "@/services/api";
import { notify } from "@/lib/toast";

interface LeadFormProps {
  initialPlanSelection: string;
}

export default function LeadForm({ initialPlanSelection }: LeadFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    insuranceType: "Health Protection",
    familySize: "Self + Spouse + 1 Kid",
    annualBudget: "₹10,000 - ₹25,000",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [leadId, setLeadId] = useState("");

  useEffect(() => {
    if (initialPlanSelection) {
      // Auto-assign corresponding insurance type when plan selected from recommendations
      let type = "Health Protection";
      if (initialPlanSelection.includes("Life")) type = "AI Term Life Shield";
      if (initialPlanSelection.includes("Auto") || initialPlanSelection.includes("Vehicle")) type = "Smart Vehicle Guard";
      if (initialPlanSelection.includes("Travel")) type = "Travel Secure Plus";
      
      setFormData((prev) => ({
        ...prev,
        insuranceType: type,
      }));
    }
  }, [initialPlanSelection]);

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim() || !formData.email.trim()) {
      notify.error("Please fill out all contact fields.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const lead = await leadService.createLead({
        customerName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        insuranceType: `${formData.insuranceType} (${formData.familySize})`,
        budget: formData.annualBudget,
      });
      if (lead && lead.id) {
        setLeadId(lead.id);
      }
      setIsSuccess(true);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to submit underwriting details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="lead-capture" className="py-24 bg-white relative overflow-hidden">
      {/* Decorative Blur Ambient */}
      <div className="absolute top-1/2 left-[-10%] w-72 h-72 rounded-full bg-royal-600/5 blur-3xl pointer-events-none" />

      <div className="max-w-xl mx-auto px-6">
        
        {/* Progress Tracker Headers */}
        {!isSuccess && (
          <div className="mb-10 text-center space-y-4">
            <div className="inline-flex items-center gap-1.5 text-royal-600 bg-blue-50 py-1.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 fill-white animate-spin-slow" />
              <span>Instant Qualification</span>
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-navy-900 leading-tight">
              Get Your Qualified Quote
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              Step {step} of 2: {step === 1 ? "Coverage & Protection Scope" : "Secure Contact Vault"}
            </p>

            {/* Custom Premium Progress Bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-6 border border-slate-200/40">
              <div
                className="h-full bg-gradient-to-r from-royal-600 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${(step / 2) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Lead Capture Interactive Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-premium p-6 sm:p-10 relative overflow-hidden text-left">
          
          <AnimatePresence mode="wait">
            {isSuccess ? (
              // Success Screen with Qualified notification
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center py-6 space-y-6"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto shadow-sm border border-emerald-100">
                  <CheckCircle2 className="w-12 h-12 stroke-[2.2]" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-navy-900 tracking-tight">Profile Approved!</h3>
                  <span className="inline-block bg-emerald-100 text-emerald-700 font-extrabold text-[10px] uppercase tracking-widest py-1 px-3.5 rounded-full">
                    99.2% Claim Track Qualified
                  </span>
                </div>

                <p className="text-slate-600 text-[13.5px] leading-relaxed max-w-sm mx-auto font-medium">
                  Congratulations <span className="font-extrabold text-navy-900">{formData.fullName}</span>, our Aegis underwriting model has cleared your profile for instant secure coverage.
                </p>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[12.5px] text-slate-500 text-left space-y-2 font-medium">
                  <p><strong>🔒 Secure ID:</strong> {leadId || "AEG-Pending"}</p>
                  <p><strong>📋 Scope Selected:</strong> {formData.insuranceType}</p>
                  <p><strong>📞 Contact Direct:</strong> An Aegis Certified Family Officer will contact you at <strong>{formData.phone}</strong> within 10 minutes to verify medical details and trigger cover.</p>
                </div>

                <div className="pt-2 text-[11px] text-slate-400">
                  Secured & underwritten in partnership with IRDAI-registered carriers.
                </div>
              </motion.div>
            ) : step === 1 ? (
              // STEP 1: Coverage & Scope Details
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Insurance Type */}
                <div className="flex flex-col gap-2">
                  <label className="text-[12.5px] font-bold text-navy-800 uppercase tracking-wider">
                    Desired Insurance Area
                  </label>
                  <select
                    value={formData.insuranceType}
                    onChange={(e) => setFormData({ ...formData, insuranceType: e.target.value })}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] text-navy-900 focus:bg-white focus:border-royal-500 focus:ring-1 focus:ring-royal-500/20 outline-none transition-all cursor-pointer font-medium"
                  >
                    <option value="Health Protection">Family Health Shield</option>
                    <option value="AI Term Life Shield">AI Term Life Shield</option>
                    <option value="Smart Vehicle Guard">Smart Vehicle Guard</option>
                    <option value="Travel Secure Plus">Travel Secure Plus</option>
                  </select>
                </div>

                {/* Family Size */}
                <div className="flex flex-col gap-2">
                  <label className="text-[12.5px] font-bold text-navy-800 uppercase tracking-wider">
                    Family Members to Protect
                  </label>
                  <select
                    value={formData.familySize}
                    onChange={(e) => setFormData({ ...formData, familySize: e.target.value })}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] text-navy-900 focus:bg-white focus:border-royal-500 focus:ring-1 focus:ring-royal-500/20 outline-none transition-all cursor-pointer font-medium"
                  >
                    <option value="Self Only">Self Only</option>
                    <option value="Self + Spouse">Self + Spouse</option>
                    <option value="Self + Spouse + 1 Kid">Self + Spouse + 1 Kid</option>
                    <option value="Self + Spouse + 2 Kids">Self + Spouse + 2 Kids</option>
                    <option value="Self + Spouse + Parents">Self + Spouse + Dependent Parents</option>
                  </select>
                </div>

                {/* Annual Budget */}
                <div className="flex flex-col gap-2">
                  <label className="text-[12.5px] font-bold text-navy-800 uppercase tracking-wider">
                    Target Annual Premium Budget
                  </label>
                  <select
                    value={formData.annualBudget}
                    onChange={(e) => setFormData({ ...formData, annualBudget: e.target.value })}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] text-navy-900 focus:bg-white focus:border-royal-500 focus:ring-1 focus:ring-royal-500/20 outline-none transition-all cursor-pointer font-medium"
                  >
                    <option value="₹5,000 - ₹10,000">₹5,000 - ₹10,000 (Basic Shield)</option>
                    <option value="₹10,000 - ₹25,000">₹10,000 - ₹25,000 (Supreme Guard)</option>
                    <option value="₹25,000 - ₹50,000">₹25,000 - ₹50,000 (Elite Protection)</option>
                    <option value="₹50,000+">₹50,000+ (Comprehensive Global cover)</option>
                  </select>
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full mt-4 bg-navy-900 hover:bg-navy-950 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer text-[14.5px]"
                >
                  <span>Proceed to Secure Contact</span>
                  <ChevronRight className="w-4.5 h-4.5" />
                </button>
              </motion.div>
            ) : (
              // STEP 2: Secure Contact Information
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Full Name */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[12.5px] font-bold text-navy-800 uppercase tracking-wider">
                      Full Legal Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="E.g., Aravind Sharma"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] text-navy-900 focus:bg-white focus:border-royal-500 focus:ring-1 focus:ring-royal-500/20 outline-none transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[12.5px] font-bold text-navy-800 uppercase tracking-wider">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input
                        type="tel"
                        required
                        pattern="[0-9]{10}"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="E.g., 9876543210"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] text-navy-900 focus:bg-white focus:border-royal-500 focus:ring-1 focus:ring-royal-500/20 outline-none transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[12.5px] font-bold text-navy-800 uppercase tracking-wider">
                      Work or Personal Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="E.g., sharma@corporate.com"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] text-navy-900 focus:bg-white focus:border-royal-500 focus:ring-1 focus:ring-royal-500/20 outline-none transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Trust disclaimer badge */}
                  <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-[11.5px] text-slate-600 font-medium">
                    <ShieldCheck className="w-5 h-5 text-royal-600 flex-shrink-0 mt-0.5" />
                    <span>Privacy Assured: We enforce a zero-marketing spam rule. Your digits will only be used by certified claim support officers.</span>
                  </div>

                  {/* Controls */}
                  <div className="flex gap-4 pt-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200/60 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-gradient-to-r from-royal-600 to-royal-700 hover:from-royal-700 hover:to-royal-800 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer text-[14.5px]"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>AI Underwriting Active...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit & Qualify Coverage</span>
                          <CheckCircle2 className="w-4.5 h-4.5 text-cyan-300" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
