"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import FeedItem, { PostWithData } from "@/components/FeedItem";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<PostWithData[]>([]);
  const [isScrollLocked, setIsScrollLocked] = useState<boolean>(false);

  const fetchFeed = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Tarik posts + profil penulis + daftar likes + daftar komentar
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          author:user_id (id, username, full_name, avatar_url),
          likes (user_id),
          comments (*, author:user_id(id, username, full_name, avatar_url))
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Mengacak array (Fisher-Yates Shuffle) agar feed tidak selalu berurutan
      const shuffledPosts = [...(data as unknown as PostWithData[])];
      for (let i = shuffledPosts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPosts[i], shuffledPosts[j]] = [
          shuffledPosts[j],
          shuffledPosts[i],
        ];
      }

      // Urutan komentar dari yang terlama ke terbaru
      const formattedPosts = shuffledPosts.map((post) => ({
        ...post,
        comments: post.comments.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
      }));

      setPosts(formattedPosts);
    } catch (error: unknown) {
      if (error instanceof Error)
        console.error("Gagal memuat feed:", error.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    setTimeout(() => {
      if (isMounted) fetchFeed();
    }, 0);
    return () => {
      isMounted = false;
    };
  }, [fetchFeed]);

  // ==========================================================================
  // PROTEKSI AKSI PRIVAT
  // ==========================================================================
  const requireAuth = async (actionFn: () => void) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      if (
        window.confirm("Anda harus masuk untuk berinteraksi. Ke halaman login?")
      ) {
        router.push("/auth");
      }
    } else {
      actionFn();
    }
  };

  // ==========================================================================
  // RENDER UI
  // ==========================================================================
  if (loading)
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center text-white font-bold">
        Memuat Feed...
      </div>
    );

  if (posts.length === 0)
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold mb-2">Feed Kosong</h2>
        <p className="text-gray-500 mb-6">
          Belum ada satupun konten yang diunggah.
        </p>
        <button
          onClick={() => router.push("/account")}
          className="bg-white text-black px-6 py-3 rounded-full font-bold"
        >
          Upload Konten Pertama
        </button>
      </div>
    );

  return (
    <main
      className={`h-[100dvh] w-full bg-black relative ${
        isScrollLocked
          ? "overflow-hidden"
          : "overflow-y-scroll snap-y snap-mandatory custom-scrollbar"
      }`}
    >
      {/* HEADER MENGAMBANG */}
      <header className="fixed top-0 left-0 w-full z-40 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <h1 className="text-white font-black text-2xl tracking-tighter drop-shadow-md">
          DiguDogu.
        </h1>
      </header>

      {/* RENDER LIST FEED (Menggunakan desain Desktop Sidebar & Mobile Overlay) */}
      {posts.map((post) => (
        <FeedItem
          key={post.id}
          post={post}
          currentUser={currentUser}
          onRequireAuth={requireAuth}
          onModalToggle={(isOpen) => setIsScrollLocked(isOpen)}
        />
      ))}
    </main>
  );
}
