import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Image from "next/image";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  async function signIn(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    } else {
      redirect("/dashboard/squad");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/tfa-badge.svg" alt="Touch Football Australia" width={120} height={36} priority />
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8e5] p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[#002e23] mb-1">Sign in</h1>
          <p className="text-sm text-[#6b7c75] mb-6">Referee Performance Platform</p>

          <form action={signIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#002e23] mb-1">Email address</label>
              <input
                type="email"
                name="email"
                required
                autoFocus
                placeholder="you@example.com"
                className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#002e23] mb-1">Password</label>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg px-4 py-2.5 font-medium text-white"
              style={{ backgroundColor: "#007239" }}
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6b7c75] mt-6">
          Touch Football Australia · Officiating Performance
        </p>
      </div>
    </div>
  );
}
