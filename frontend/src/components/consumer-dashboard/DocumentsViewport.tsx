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
/**
 * Sprint 8 status, in words a customer can act on.
 *
 * "PENDING_REVIEW" is a database value; "Being checked" is what somebody reads
 * while wondering whether their claim has stalled.
 */
const DOC_STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Received",
  PROCESSING: "Being checked",
  PENDING_REVIEW: "Waiting for a person",
  VERIFIED: "Accepted",
  REJECTED: "Not accepted",
};

const DOC_STATUS_TONE: Record<string, string> = {
  UPLOADED: "text-slate-500",
  PROCESSING: "text-cyan-400",
  PENDING_REVIEW: "text-cyan-400",
  VERIFIED: "text-emerald-400",
  REJECTED: "text-amber-400",
};

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
        <p className="text-xs text-slate-400 mt-1 font-medium">Upload your KYC and ID documents securely.</p>
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
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Stored securely and privately</p>
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
          <div key={doc.id} className={`p-4 border rounded-2xl flex flex-wrap items-start justify-between gap-2 bg-slate-50 border-slate-200 dark:bg-white/[0.01] dark:border-white/5`}>
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-purple-950/40 text-purple-400 border border-purple-800/30 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className={`text-xs font-bold truncate text-content`}>{doc.name}</p>
                <p className="text-[9px] text-slate-550 mt-0.5 leading-none font-semibold">{doc.size}</p>
                {/* The status, and on a rejection the reason. A filename and a date tell
                    somebody nothing about whether their case is blocked — which is the
                    only reason most people open this screen. */}
                {doc.status ? (
                  <p className={`text-[9px] mt-1 font-black uppercase tracking-wider ${DOC_STATUS_TONE[doc.status] ?? "text-slate-500"}`}>
                    {DOC_STATUS_LABEL[doc.status] ?? doc.status.toLowerCase()}
                  </p>
                ) : null}
                {doc.rejectionReason ? (
                  <p className="text-[10px] mt-1 font-semibold text-amber-400 leading-snug break-words">
                    {doc.rejectionReason}
                  </p>
                ) : null}
              </div>
            </div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex-shrink-0">{doc.date}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
