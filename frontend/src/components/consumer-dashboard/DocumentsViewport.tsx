"use client";

import { Upload, FileText } from "lucide-react";
import { motion } from "framer-motion";
import type { DashboardDoc } from "./types";

interface DocumentsViewportProps {
  uploadedFiles: DashboardDoc[];
  uploadingDoc: boolean;
  uploadSuccess: string;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Secure document vault with simulated KYC upload (nav: "documents"). */
export function DocumentsViewport({
  uploadedFiles, uploadingDoc, uploadSuccess, handleFileUpload,
}: DocumentsViewportProps) {
  return (
    <motion.div
      key="documents"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 bg-white border-slate-200 dark:bg-slate-900/40 dark:border-white/5`}
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className={`font-black text-base text-content`}>Secure Document Vault</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">Encrypt and seed sovereign KYC ID assets directly into decentralized ledger storage.</p>
      </div>

      <div className={`border-2 border-dashed rounded-2xl py-10 px-6 text-center flex flex-col items-center justify-center gap-3 border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.01]`}>
        <input
          type="file"
          id="consumer-vault-picker"
          onChange={handleFileUpload}
          className="hidden"
          disabled={uploadingDoc}
        />
        <label htmlFor="consumer-vault-picker" className="w-12 h-12 rounded-xl bg-purple-950/50 text-purple-400 border border-purple-800/30 flex items-center justify-center cursor-pointer hover:bg-purple-900/30 transition-all">
          <Upload className="w-6 h-6" />
        </label>

        <div className="space-y-1">
          <p className={`text-xs font-bold text-content`}>Click upload to deposit secure PDF KYC assets</p>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Decentralized DPDP locker protocol</p>
        </div>

        {uploadingDoc && (
          <div className="text-[10px] text-purple-400 animate-pulse font-extrabold mt-2 uppercase tracking-widest">
            Syncing digital vault blocks...
          </div>
        )}

        {uploadSuccess && (
          <div className="text-[11px] text-emerald-450 font-bold mt-2">
            {uploadSuccess}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {uploadedFiles.map((doc) => (
          <div key={doc.id} className={`p-4 border rounded-2xl flex items-center justify-between bg-slate-50 border-slate-200 dark:bg-white/[0.01] dark:border-white/5`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-purple-950/40 text-purple-400 border border-purple-800/30 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className={`text-xs font-bold truncate text-content`}>{doc.name}</p>
                <p className="text-[9px] text-slate-550 mt-0.5 leading-none font-semibold">{doc.size}</p>
              </div>
            </div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex-shrink-0">{doc.date}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
