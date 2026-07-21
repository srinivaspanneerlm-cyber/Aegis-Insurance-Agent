"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { WelcomeCard } from "./login/WelcomeCard";
import { LoginCard } from "./login/LoginCard";

/** Simulated SSO delay before prompting for password (ms). */
const SSO_SIMULATE_DELAY = 1200;

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Triple-card login modal (welcome / consumer / admin) triggered from the
 * navbar and hero. Owns all of its own form state so the landing page no longer
 * has to; login itself is delegated to `AuthContext`.
 */
export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login, loading } = useAuth();

  // Consumer Login Form values
  const [consumerEmail, setConsumerEmail] = useState("");
  const [consumerPassword, setConsumerPassword] = useState("");
  const [showConsumerPassword, setShowConsumerPassword] = useState(false);
  const [consumerError, setConsumerError] = useState("");
  const [consumerGoogleLoading, setConsumerGoogleLoading] = useState(false);

  // Admin Login Form values
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminGoogleLoading, setAdminGoogleLoading] = useState(false);

  const handleConsumerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsumerError("");

    if (!consumerEmail.trim() || !consumerPassword.trim()) {
      setConsumerError("Please fill in email and passcode parameters.");
      return;
    }

    try {
      await login(consumerEmail, consumerPassword);
      onClose();
    } catch (err) {
      setConsumerError(err instanceof Error ? err.message : "Invalid credentials. Verify your vault keys.");
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setAdminError("Please fill in admin email and passcode parameters.");
      return;
    }

    try {
      await login(adminEmail, adminPassword);
      onClose();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Invalid admin credentials. Verify authorized keys.");
    }
  };

  // Google SSO simulated click
  const handleGoogleSimulate = (role: "consumer" | "admin") => {
    if (role === "consumer") {
      setConsumerGoogleLoading(true);
      setTimeout(() => {
        setConsumerGoogleLoading(false);
        setConsumerError("SSO Active: Complete password credentials to verify session.");
      }, SSO_SIMULATE_DELAY);
    } else {
      setAdminGoogleLoading(true);
      setTimeout(() => {
        setAdminGoogleLoading(false);
        setAdminError("Admin SSO Active: Complete password credentials to verify session.");
      }, SSO_SIMULATE_DELAY);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md"
        >
          {/* Modal main box */}
          <motion.div
            initial={{ scale: 0.96, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 15 }}
            className="w-full max-w-6xl relative my-auto"
          >

            {/* Close trigger button */}
            <button
              onClick={onClose}
              aria-label="Close login"
              className={`absolute right-0 -top-12 p-2.5 rounded-xl border transition-colors cursor-pointer bg-white border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/15`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* COLUMN 1: WELCOME CARD (Cols 1-4) */}
              <WelcomeCard />

              {/* COLUMN 2: CONSUMER LOGIN CARD (Cols 5-8) */}
              <LoginCard
                variant="consumer"
                email={consumerEmail}
                setEmail={setConsumerEmail}
                password={consumerPassword}
                setPassword={setConsumerPassword}
                showPassword={showConsumerPassword}
                onTogglePassword={() => setShowConsumerPassword(!showConsumerPassword)}
                error={consumerError}
                googleLoading={consumerGoogleLoading}
                onGoogle={() => handleGoogleSimulate("consumer")}
                onSubmit={handleConsumerSubmit}
                loading={loading}
                footer={
                  <p className="text-[11px] font-semibold text-slate-500">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="font-black text-purple-400 hover:underline">Register here</Link>
                  </p>
                }
              />

              {/* COLUMN 3: ADMIN LOGIN CARD (Cols 9-12) */}
              <LoginCard
                variant="admin"
                email={adminEmail}
                setEmail={setAdminEmail}
                password={adminPassword}
                setPassword={setAdminPassword}
                showPassword={showAdminPassword}
                onTogglePassword={() => setShowAdminPassword(!showAdminPassword)}
                error={adminError}
                googleLoading={adminGoogleLoading}
                onGoogle={() => handleGoogleSimulate("admin")}
                onSubmit={handleAdminSubmit}
                loading={loading}
                footer={
                  <p className="text-[11px] font-semibold text-slate-500">
                    Not an admin?{" "}
                    <button onClick={() => setConsumerEmail("admin@aegis.com")} className="font-black text-cyan-400 hover:underline cursor-pointer bg-transparent border-0 outline-none">
                      Go to Consumer Login
                    </button>
                  </p>
                }
              />
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
