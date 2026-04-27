
"use client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [msg, setMsg]     = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sb = createClient();

  async function login() {
    setLoading(true); setMsg("");
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    router.push("/");
  }

  async function register() {
    setLoading(true); setMsg("");
    const { error } = await sb.auth.signUp({ email, password: pass });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    setMsg("Conta criada! Verifique seu e-mail se necessário.");
  }

  async function loginGoogle() {
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` }
    });
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">家計簿</div>
          <h1 className="font-display text-2xl font-black bg-gradient-to-r from-white to-violet-l bg-clip-text text-transparent">
            Kakebo Pro
          </h1>
          <p className="text-[9px] text-muted tracking-[3px] uppercase mt-1">Controle Financeiro</p>
        </div>

        <div className="card space-y-3">
          {msg && (
            <div className="text-[11px] p-3 rounded-lg bg-violet/10 text-violet-l border border-violet/20 text-center">
              {msg}
            </div>
          )}
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" placeholder="seu@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()} />
          </div>
          <div>
            <label className="label">Senha</label>
            <input className="input" type="password" placeholder="mínimo 6 caracteres"
              value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()} />
          </div>
          <button onClick={login} disabled={loading}
            className="w-full btn-primary py-3 disabled:opacity-50 rounded-lg font-bold text-xs tracking-wider bg-violet text-white border-none">
            {loading ? "Aguarde..." : "ENTRAR"}
          </button>
          <button onClick={register} disabled={loading}
            className="w-full btn-ghost py-3 rounded-lg">
            CRIAR CONTA
          </button>
          <div className="flex items-center gap-2 my-1">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[9px] text-muted">ou</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <button onClick={loginGoogle}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-lg text-xs text-muted hover:border-violet/40 hover:text-white transition-all cursor-pointer bg-transparent">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </button>
        </div>
        <p className="text-center text-[9px] text-muted mt-4 tracking-wider">
          🔒 Dados sincronizados com segurança
        </p>
      </div>
    </div>
  );
}
