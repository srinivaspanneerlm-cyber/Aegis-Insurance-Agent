"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePurchase } from "@/context/PurchaseContext";
import { Phone, Mail, CheckCircle2, ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";

const DEMO_OTP = "123456";
const OTP_TTL = 60;

function OTPInput({
  value, onChange, verified, label, icon: Icon, channel,
}: {
  value: string; onChange: (v: string) => void; verified: boolean;
  label: string; icon: React.ComponentType<{ className?: string }>; channel: string;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const arr = value.padEnd(6, " ").split("");
    arr[i] = v || " ";
    const next = arr.join("").replace(/ /g, "");
    onChange(next.slice(0, 6));
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const digits = value.padEnd(6, "").split("").slice(0, 6);

  return (
    <div className={`rounded-2xl border p-5 space-y-4 transition-all duration-300
      ${verified ? "border-emerald-500/25 bg-emerald-500/5" : "border-white/5 bg-white/[0.02]"}`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center
          ${verified ? "bg-emerald-500/15" : "bg-white/5"}`}>
          <Icon className={`w-4 h-4 ${verified ? "text-emerald-400" : "text-white/40"}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-white/30">{channel}</p>
        </div>
        {verified && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </motion.div>
        )}
      </div>

      {!verified && (
        <div className="flex gap-2 justify-center">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d === " " || d === "" ? "" : d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              className={`w-10 h-12 text-center text-lg font-bold rounded-xl border bg-white/[0.04] text-white
                outline-none transition-all duration-200
                focus:border-cyan-500/60 focus:bg-white/[0.08] focus:ring-1 focus:ring-cyan-500/30
                ${d && d !== " " ? "border-cyan-500/40" : "border-white/10"}`}
            />
          ))}
        </div>
      )}
      {verified && (
        <p className="text-center text-emerald-400 text-sm font-medium">✔ OTP Verified Successfully</p>
      )}
    </div>
  );
}

export default function OTPPage() {
  const router = useRouter();
  const { state, setOtpDone } = usePurchase();
  const c = state.customerDetails;

  const [mobileOtp, setMobileOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileSent, setMobileSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileTimer, setMobileTimer] = useState(0);
  const [emailTimer, setEmailTimer] = useState(0);
  const [error, setError] = useState("");
  const [allVerified, setAllVerified] = useState(false);

  useEffect(() => {
    if (mobileTimer > 0) { const t = setTimeout(() => setMobileTimer(p => p - 1), 1000); return () => clearTimeout(t); }
  }, [mobileTimer]);
  useEffect(() => {
    if (emailTimer > 0) { const t = setTimeout(() => setEmailTimer(p => p - 1), 1000); return () => clearTimeout(t); }
  }, [emailTimer]);

  const sendMobileOtp = () => { setMobileSent(true); setMobileTimer(OTP_TTL); setMobileOtp(""); setError(""); };
  const sendEmailOtp = () => { setEmailSent(true); setEmailTimer(OTP_TTL); setEmailOtp(""); setError(""); };

  const verifyOtps = () => {
    if (mobileOtp !== DEMO_OTP) { setError("Mobile OTP is incorrect. (Demo: 123456)"); return; }
    if (emailOtp !== DEMO_OTP)  { setError("Email OTP is incorrect. (Demo: 123456)"); return; }
    setMobileVerified(true);
    setEmailVerified(true);
    setError("");
    setTimeout(() => { setAllVerified(true); setOtpDone(true); }, 400);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">OTP Verification</h1>
        <p className="text-white/40 text-sm">Verify your mobile and email to secure your application</p>
      </div>

      {/* Demo notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
        <p className="text-amber-300 text-xs">
          <ShieldCheck className="w-3 h-3 inline mr-1" />
          Demo mode — use <span className="font-mono font-bold">123456</span> for both OTPs
        </p>
      </div>

      {/* Mobile OTP */}
      <div className="space-y-3">
        {!mobileSent ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <Phone className="w-4 h-4 text-white/40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Mobile OTP</p>
                <p className="text-xs text-white/30">{c?.mobile ? `+91 ${c.mobile}` : "+91 XXXXXXXXXX"}</p>
              </div>
            </div>
            <button onClick={sendMobileOtp}
              className="px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-xs font-medium hover:bg-cyan-500/25 transition-colors">
              Send OTP
            </button>
          </div>
        ) : (
          <OTPInput
            value={mobileOtp} onChange={setMobileOtp} verified={mobileVerified}
            label="Mobile OTP" icon={Phone}
            channel={c?.mobile ? `+91 ${c.mobile}` : "+91 XXXXXXXXXX"}
          />
        )}
        {mobileSent && !mobileVerified && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-white/30">
              {mobileTimer > 0 ? `Resend in ${mobileTimer}s` : ""}
            </p>
            {mobileTimer === 0 && (
              <button onClick={sendMobileOtp} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                <RefreshCw className="w-3 h-3" /> Resend OTP
              </button>
            )}
          </div>
        )}
      </div>

      {/* Email OTP */}
      <div className="space-y-3">
        {!emailSent ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <Mail className="w-4 h-4 text-white/40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Email OTP</p>
                <p className="text-xs text-white/30">{c?.email || "user@email.com"}</p>
              </div>
            </div>
            <button onClick={sendEmailOtp}
              className="px-4 py-2 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-400 text-xs font-medium hover:bg-purple-500/25 transition-colors">
              Send OTP
            </button>
          </div>
        ) : (
          <OTPInput
            value={emailOtp} onChange={setEmailOtp} verified={emailVerified}
            label="Email OTP" icon={Mail}
            channel={c?.email || "user@email.com"}
          />
        )}
        {emailSent && !emailVerified && (
          <div className="flex justify-end px-1">
            {emailTimer === 0 && (
              <button onClick={sendEmailOtp} className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                <RefreshCw className="w-3 h-3" /> Resend OTP
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>
      )}

      {/* Verify button */}
      {mobileSent && emailSent && !allVerified && (
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          onClick={verifyOtps}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm
            flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25"
        >
          <ShieldCheck className="w-4 h-4" /> Verify Both OTPs
        </motion.button>
      )}

      <AnimatePresence>
        {allVerified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 text-center space-y-3"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
              className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </motion.div>
            <div>
              <h2 className="text-lg font-bold text-white">Both OTPs Verified</h2>
              <p className="text-emerald-300/60 text-sm">Mobile & Email authentication complete</p>
            </div>
            <button onClick={() => router.push("/purchase/review")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm">
              Continue to Final Review <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
