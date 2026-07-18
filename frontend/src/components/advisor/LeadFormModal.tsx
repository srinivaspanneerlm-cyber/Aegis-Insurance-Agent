"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LeadForm from "@/components/LeadForm";

/** Modal wrapping the lead-capture form, shown when a plan is selected. */
export function LeadFormModal({ planName, onClose }: { planName: string | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {planName && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md pointer-events-auto"
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 150, damping: 20 }}
            className="w-full max-w-lg relative bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden text-left pointer-events-auto"
          >
            <button
              onClick={onClose}
              className="absolute right-5 top-5 z-10 p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer active:scale-95 touch-manipulation select-none"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
            <div className="p-3 max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <LeadForm initialPlanSelection={planName} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
