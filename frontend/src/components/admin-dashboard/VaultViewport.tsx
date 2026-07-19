"use client";

import { UploadCloud, FileText } from "lucide-react";
import { motion } from "framer-motion";
import type { DocumentRecord, PageInfo } from "@/types/domain";
import { Pagination } from "@/components/shared/Pagination";

interface VaultViewportProps {
  documents: DocumentRecord[];
  pagination: PageInfo | null;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  dragActive: boolean;
  isSubmittingFile: boolean;
  uploadProgress: number;
  validationError: string;
  uploadSuccess: string;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Secure Crypt-Vault: drag-and-drop document upload and archived files ledger (nav: "vault"). */
export function VaultViewport({
  documents, pagination, isLoading, onPageChange,
  dragActive, isSubmittingFile, uploadProgress, validationError, uploadSuccess,
  handleDrag, handleDrop, handleFileSelect,
}: VaultViewportProps) {
  return (
    <motion.div
      key="vault"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className="font-extrabold text-white text-base">Secure Crypt-Vault Locker</h3>
        <p className="text-xs text-slate-400 mt-1 font-semibold">Dynamic underwriting rule documents and actuarial spreadsheets encrypted directly.</p>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl py-10 px-6 text-center flex flex-col items-center justify-center gap-3 bg-slate-950/60 transition-all ${
          dragActive ? "border-cyan-400 bg-cyan-950/10" : "border-cyan-500/20"
        }`}
      >
        <input
          type="file"
          id="admin-crypt-picker"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isSubmittingFile}
        />
        <label htmlFor="admin-crypt-picker" className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center cursor-pointer hover:bg-cyan-500/20 transition-all">
          <UploadCloud className="w-6 h-6 animate-pulse" />
        </label>

        <div className="space-y-1">
          <p className="text-xs font-black text-white">Drag & drop files or click to upload</p>
          <p className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-widest">Only PDF & DOCX accepted (Max 10MB)</p>
        </div>

        {isSubmittingFile && (
          <div className="w-full max-w-xs mt-3">
            <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold mb-1.5 uppercase">
              <span>Syncing Blocks...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div style={{ width: `${uploadProgress}%` }} className="h-full bg-cyan-400 transition-all" />
            </div>
          </div>
        )}

        {validationError && (
          <div className="text-[11px] text-rose-450 font-bold mt-2">
            {validationError}
          </div>
        )}

        {uploadSuccess && (
          <div className="text-[11px] text-emerald-450 font-bold mt-2">
            {uploadSuccess}
          </div>
        )}
      </div>

      {/* Archived Files ledger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {documents.length > 0 ? (
          documents.map((doc, idx) => (
            <div key={doc.id || idx} className="p-4 bg-slate-950 border border-white/5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black text-white truncate">{doc.name || doc.filename}</p>
                  <p className="text-[9.5px] text-slate-500 mt-0.5 leading-none font-bold uppercase tracking-wider">{doc.size || `${((doc.sizeBytes ?? 0) / 1024).toFixed(1)} KB`}</p>
                </div>
              </div>
              <span className="text-[9px] text-slate-550 font-extrabold uppercase tracking-widest">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "Active"}</span>
            </div>
          ))
        ) : (
          <div className="col-span-2 p-6 text-center text-slate-550 font-black uppercase tracking-widest bg-slate-950 border border-white/5 rounded-2xl">
            No encrypted assets logged in vault room.
          </div>
        )}
      </div>

      {pagination && (
        <Pagination pagination={pagination} onPageChange={onPageChange} busy={isLoading} />
      )}
    </motion.div>
  );
}
