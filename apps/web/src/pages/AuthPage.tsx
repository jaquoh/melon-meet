import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { logIn, signUp } from "../lib/api";
import { queryClient } from "../lib/query-client";
import { PanelCard } from "../components/PanelCard";

export function AuthPage({ viewer }: { viewer: ViewerSummary | null }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const authMutation = useMutation({
    mutationFn: async () =>
      mode === "login" ? logIn(email, password) : signUp(email, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
  });

  if (viewer) {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[1.05fr,0.95fr]">
        <PanelCard className="overflow-hidden bg-gradient-to-br from-orange-400 via-amber-300 to-teal-300 text-stone-950">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/80">
            Melon Meet Access
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
            Sign in to claim spots, run private groups, and post updates for your next outdoor game.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-stone-900/70">
            Public map browsing stays open, but account access unlocks group membership, recurring meetings, and role-aware editing.
          </p>
        </PanelCard>

        <PanelCard className="max-w-xl justify-self-end">
          <div className="flex gap-2 rounded-full bg-stone-100 p-1">
            <button className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${mode === "login" ? "bg-white shadow-sm" : "text-stone-500"}`} onClick={() => setMode("login")} type="button">
              Log in
            </button>
            <button className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${mode === "signup" ? "bg-white shadow-sm" : "text-stone-500"}`} onClick={() => setMode("signup")} type="button">
              Sign up
            </button>
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              authMutation.mutate();
            }}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-600">Email</span>
              <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-600">Password</span>
              <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>

            {authMutation.error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {authMutation.error.message}
              </p>
            ) : null}

            <button className="w-full rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={authMutation.isPending}>
              {authMutation.isPending
                ? "Working..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>
        </PanelCard>
      </div>
    </div>
  );
}
