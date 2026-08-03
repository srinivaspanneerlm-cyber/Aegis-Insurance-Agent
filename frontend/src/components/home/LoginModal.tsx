"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { WelcomeCard } from "./login/WelcomeCard";
import { LoginCard } from "./login/LoginCard";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Login modal triggered from the navbar and hero. Owns its own form state so
 * the landing page does not have to; login itself is delegated to `AuthContext`.
 *
 * This is the customer portal — there is no administrative sign-in here. Staff
 * authenticate in the separate Enterprise Admin application against the same
 * backend.
 */
export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login, loginWithGoogle, loading } = useAuth();
  const { theme } = useTheme();

  // Consumer Login Form values
  const [consumerEmail, setConsumerEmail] = useState("");
  const [consumerPassword, setConsumerPassword] = useState("");
  const [showConsumerPassword, setShowConsumerPassword] = useState(false);
  const [consumerError, setConsumerError] = useState("");


  // Real Google sign-in. Both cards mount their own Google button because GIS
  // renders into a specific element; the flow behind them is identical.
  //
  // Labelled, not an icon: a bare Google glyph tells a first-time buyer nothing
  // about what pressing it does. Matches the `/login` page so the same choice
  // looks the same wherever it is offered. No fixed width — the modal is
  // narrower than that page, so the button is left to size to its own label.
  const googleAppearance = useMemo(
    () => ({ theme: theme === "dark" ? ("filled_black" as const) : ("outline" as const) }),
    [theme]
  );

  const consumerGoogle = useGoogleSignIn({
    enabled: isOpen,
    appearance: googleAppearance,
    onCredential: async (credential) => {
      setConsumerError("");
      await loginWithGoogle(credential);
      onClose();
    },
    onError: setConsumerError,
  });


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

            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch">
              {/* COLUMN 1: WELCOME CARD (Cols 1-4) */}
              <WelcomeCard />

              {/* Sign-in card */}
              <LoginCard
                email={consumerEmail}
                setEmail={setConsumerEmail}
                password={consumerPassword}
                setPassword={setConsumerPassword}
                showPassword={showConsumerPassword}
                onTogglePassword={() => setShowConsumerPassword(!showConsumerPassword)}
                error={consumerError}
                googleRef={consumerGoogle.containerRef}
                googleStatus={consumerGoogle.status}
                onSubmit={handleConsumerSubmit}
                loading={loading}
                footer={
                  <p className="text-[11px] font-semibold text-slate-500">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="font-black text-purple-400 hover:underline">Register here</Link>
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
