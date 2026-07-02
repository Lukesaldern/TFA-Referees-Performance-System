"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (!token_hash || !type) {
      // No token — user is already signed in (e.g. password reset from within app)
      setReady(true);
      return;
    }

    // Verify the invite token client-side. The browser Supabase client stores the
    // resulting session in cookies automatically — no server-side cookie juggling needed.
    setVerifying(true);
    const supabase = createClient();
    supabase.auth
      .verifyOtp({ token_hash, type: type as "invite" | "magiclink" | "recovery" })
      .then(({ error }) => {
        setVerifying(false);
        if (error) {
          setError(
            "This invite link has expired or has already been used. Ask your admin for a new one."
          );
        } else {
          setReady(true);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      router.push("/dashboard/referee");
      router.refresh();
    }
  };

  // ── Loading spinner ──
  if (verifying) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-[#007239] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#6b7c75]">Verifying your invite link…</p>
      </div>
    );
  }

  // ── Expired / bad token ──
  if (error && !ready) {
    return (
      <>
        <h1 className="text-xl font-bold text-[#002e23] mb-2">Link expired</h1>
        <p className="text-sm text-red-600">{error}</p>
      </>
    );
  }

  // ── Password form ──
  return (
    <>
      <h1 className="text-xl font-bold text-[#002e23] mb-1">Set your password</h1>
      <p className="text-sm text-[#6b7c75] mb-6">Choose a password to secure your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#002e23] mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            placeholder="At least 8 characters"
            className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#002e23] mb-1">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !password || !confirm}
          className="w-full rounded-lg px-4 py-2.5 font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "#007239" }}
        >
          {submitting ? "Saving…" : "Set password & sign in"}
        </button>
      </form>
    </>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/tfa-badge.svg" alt="Touch Football Australia" width={120} height={36} priority />
        </div>
        <div className="bg-white rounded-2xl border border-[#e2e8e5] p-8 shadow-sm">
          <Suspense fallback={
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-[#007239] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          }>
            <SetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
