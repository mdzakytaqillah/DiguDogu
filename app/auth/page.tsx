"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (isLogin) {
      // PROSES LOGIN
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setErrorMsg(error.message);
      else {
        router.refresh(); // Refresh agar middleware membaca sesi baru
        router.push("/"); // Kembali ke beranda
      }
    } else {
      // PROSES REGISTER
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase().replace(/\s/g, ""), // Hapus spasi
            full_name: fullName,
          },
        },
      });

      if (error) setErrorMsg(error.message);
      else {
        alert(
          "Registrasi berhasil! Periksa kotak masuk atau folder spam email Anda untuk mengonfirmasi pendaftaran akun sebelum login.",
        );
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 animate-in zoom-in-95 duration-300">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">
          DiguDogu
        </h1>
        <p className="text-gray-400 text-sm text-center mb-8">
          {isLogin
            ? "Masuk untuk berinteraksi dan belanja."
            : "Daftar untuk memulai perjalanan Anda."}
        </p>

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm mb-6 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {!isLogin && (
            <>
              <input
                type="text"
                required
                placeholder="Nama Lengkap"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-white text-white"
              />
              <input
                type="text"
                required
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-white text-white"
              />
            </>
          )}

          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-white text-white"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-white text-white"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4 hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? "Memproses..." : isLogin ? "Masuk" : "Daftar"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg("");
            }}
            className="text-white font-bold hover:underline"
          >
            {isLogin ? "Daftar di sini" : "Masuk di sini"}
          </button>
        </div>

        {/* Tombol kembali bagi tamu */}
        <button
          onClick={() => router.push("/")}
          className="w-full text-center text-xs text-gray-500 mt-8 hover:text-white"
        >
          ← Kembali ke Beranda (Mode Tamu)
        </button>
      </div>
    </main>
  );
}
