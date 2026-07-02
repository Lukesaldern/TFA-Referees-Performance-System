"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard/referee");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/tfa-badge.svg" alt="Touch Football Australia" width={120} height={36} priority />
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8e5] p-8 shadow-sm">
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
              disabled={loading || !password || !confirm}
              className="w-full rounded-lg px-4 py-2.5 font-medium text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#007239" }}
            >
              {loading ? "Saving…" : "Set password & sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
