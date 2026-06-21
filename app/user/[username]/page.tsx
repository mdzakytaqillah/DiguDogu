"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Profile, Post, Product } from "@/types/database";
import { User } from "@supabase/supabase-js";
import ProductModal from "@/components/ProductModal";

interface ProductWithSeller extends Product {
  seller?: Profile;
}

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const supabase = createClient();

  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<"konten" | "produk">("konten");

  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithSeller | null>(null);

  const fetchCreatorData = useCallback(async () => {
    try {
      // Cari profil berdasarkan username
      const { data: profData, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (profError || !profData) throw new Error("Kreator tidak ditemukan");
      setProfile(profData as Profile);

      // Tarik Konten milik kreator
      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", profData.id)
        .order("created_at", { ascending: false });

      setPosts((postsData as Post[]) || []);

      // Tarik Produk milik kreator
      const { data: prodsData } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", profData.id)
        .order("created_at", { ascending: false });

      const formattedProducts = (prodsData as Product[]).map((p) => ({
        ...p,
        seller: profData,
      }));
      setProducts(formattedProducts);
    } catch (error) {
      console.error(error);
      alert("Halaman kreator tidak ditemukan.");
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [supabase, username, router]);

  useEffect(() => {
    let isMounted = true;
    setTimeout(() => {
      if (isMounted) fetchCreatorData();
    }, 0);
    return () => {
      isMounted = false;
    };
  }, [fetchCreatorData]);

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Memuat Profil Kreator...
      </div>
    );
  if (!profile)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Kreator tidak ditemukan.
      </div>
    );

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center pb-24 md:pb-8">
      {/* Tombol Kembali */}
      <div className="w-full max-w-4xl mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white font-bold flex items-center gap-2"
        >
          <span>⬅</span> Kembali
        </button>
      </div>

      <div className="w-full max-w-4xl">
        {/* HEADER PROFIL KREATOR */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-10">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-zinc-800 rounded-full border-4 border-zinc-900 shadow-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover pointer-events-none select-none"
              />
            ) : (
              <span className="text-3xl font-bold text-zinc-600">
                {profile.username?.charAt(0).toUpperCase() || "U"}
              </span>
            )}
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-2xl font-bold">
              {profile.full_name || "Pengguna"}
            </h1>
            <p className="text-gray-400 font-medium">
              @{profile.username || "user"}
            </p>

            <div className="flex justify-center md:justify-start gap-6 mt-4">
              <div className="text-center">
                <p className="font-bold text-xl">{posts.length}</p>
                <p className="text-xs text-gray-500">Konten</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-xl">{products.length}</p>
                <p className="text-xs text-gray-500">Produk</p>
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-zinc-800 mb-6">
          <button
            onClick={() => setActiveTab("konten")}
            className={`flex-1 py-4 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === "konten" ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            📱 Konten
          </button>
          <button
            onClick={() => setActiveTab("produk")}
            className={`flex-1 py-4 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === "produk" ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            🛍️ Produk
          </button>
        </div>

        {/* TAB 1: KONTEN */}
        {activeTab === "konten" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 animate-in fade-in duration-500">
            {posts.length === 0 && (
              <div className="col-span-full py-10 text-center text-gray-500 text-sm">
                Belum ada konten.
              </div>
            )}
            {posts.map((post) => (
              <div
                key={post.id}
                className="aspect-[9/16] bg-zinc-800 rounded-xl relative overflow-hidden"
              >
                {post.media_type === "video" ? (
                  <video
                    src={post.media_url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={post.media_url}
                    alt="post"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: PRODUK */}
        {activeTab === "produk" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
            {products.length === 0 && (
              <div className="col-span-full py-10 text-center text-gray-500 text-sm">
                Belum ada produk yang dijual.
              </div>
            )}
            {products.map((product) => {
              const isSoldOut = product.stock <= 0;
              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col cursor-pointer hover:border-gray-600 transition-colors"
                >
                  <div className="aspect-square w-full bg-zinc-800 relative">
                    <img
                      src={product.image_url || ""}
                      alt={product.name}
                      className={`object-cover w-full h-full ${isSoldOut ? "grayscale opacity-50" : ""}`}
                    />
                    {isSoldOut ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-red-500 font-extrabold tracking-widest drop-shadow-md">
                          SOLD OUT
                        </span>
                      </div>
                    ) : (
                      <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm z-10">
                        Stok: {product.stock}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm line-clamp-1">
                      {product.name}
                    </h3>
                    <p
                      className={`font-bold mt-1 ${isSoldOut ? "text-gray-500" : "text-green-400"}`}
                    >
                      Rp {product.price.toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          currentUser={null}
          onClose={() => setSelectedProduct(null)}
          onStartChat={() => {
            router.push("/shop");
          }}
        />
      )}
    </main>
  );
}
