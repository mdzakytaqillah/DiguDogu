"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import UploadModal from "@/components/UploadModal";
import { Profile, Post, Product } from "@/types/database";

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<"konten" | "produk">("konten");
  const router = useRouter();
  const supabase = createClient();

  // State Utama
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // State Modals
  const [uploadModal, setUploadModal] = useState<{
    isOpen: boolean;
    type: "post" | "product";
  }>({
    isOpen: false,
    type: "post",
  });
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    full_name: "",
    username: "",
  });
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "post" | "product";
    id: string;
  } | null>(null);

  // Tarik data dari Supabase
  const fetchMyData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [profRes, postsRes, prodsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("*")
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (profRes.data) setProfile(profRes.data as Profile);
      if (postsRes.data) setPosts(postsRes.data as Post[]);
      if (prodsRes.data) setProducts(prodsRes.data as Product[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    if (isMounted) {
      setTimeout(() => {
        if (isMounted) {
          fetchMyData();
        }
      }, 0);
    }

    return () => {
      isMounted = false;
    };
  }, [fetchMyData]);

  const handleLogout = async () => {
    // Konfirmasi sebelum logout
    if (window.confirm("Apakah Anda yakin ingin keluar?")) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert("Gagal keluar: " + error.message);
      } else {
        router.push("/"); // Lempar ke halaman utama
        router.refresh(); // Refresh state middleware global
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editProfileData.full_name,
        username: editProfileData.username,
      })
      .eq("id", profile.id);

    if (error) alert("Gagal update profil: " + error.message);
    else {
      setProfile({ ...profile, ...editProfileData });
      setEditProfileModal(false);
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPost) return;
    const { error } = await supabase
      .from("posts")
      .update({ caption: editPost.caption })
      .eq("id", editPost.id);

    if (error) alert("Gagal update: " + error.message);
    else {
      setPosts(posts.map((p) => (p.id === editPost.id ? editPost : p)));
      setEditPost(null);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    const { error } = await supabase
      .from("products")
      .update({
        name: editProduct.name,
        price: editProduct.price,
        stock: editProduct.stock,
        description: editProduct.description,
      })
      .eq("id", editProduct.id);

    if (error) alert("Gagal update: " + error.message);
    else {
      setProducts(
        products.map((p) => (p.id === editProduct.id ? editProduct : p)),
      );
      setEditProduct(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const isPost = deleteConfirm.type === "post";
      const table = isPost ? "posts" : "products";
      const bucket = isPost ? "media" : "products";

      // Amankan nama file dari state LOKAL sebelum data di database terhapus
      const item = isPost
        ? posts.find((p) => p.id === deleteConfirm.id)
        : products.find((p) => p.id === deleteConfirm.id);

      const fileUrl = isPost
        ? (item as Post)?.media_url
        : (item as Product)?.image_url;

      // HAPUS BARIS DATA DARI DATABASE
      const { error: dbError } = await supabase
        .from(table)
        .delete()
        .eq("id", deleteConfirm.id);
      if (dbError) throw dbError;

      // JIKA DATABASE BERHASIL, BARU HAPUS FILE FISIK DI STORAGE
      if (fileUrl) {
        const urlParts = fileUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];

        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([fileName]);
        if (storageError) {
          // Hanya log error, karena data di database sudah terhapus
          console.error(
            "Data DB terhapus, tapi gagal hapus file storage:",
            storageError.message,
          );
        }
      }

      // PERBARUI UI LOKAL (Optimistic Update agar item langsung hilang dari layar tanpa reload)
      if (isPost) {
        setPosts(posts.filter((p) => p.id !== deleteConfirm.id));
      } else {
        setProducts(products.filter((p) => p.id !== deleteConfirm.id));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert("Gagal menghapus data: " + error.message);
      } else {
        alert("Gagal menghapus data");
      }
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Memuat profil...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center pb-24 md:pb-8">
      <div className="w-full max-w-4xl">
        {/* HEADER PROFIL */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-10 pt-4 md:pt-0">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-zinc-800 rounded-full border-4 border-zinc-900 shadow-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-zinc-600">
                {profile?.username?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-2xl font-bold">
              {profile?.full_name || "Pengguna"}
            </h1>
            <p className="text-gray-400 font-medium">
              @{profile?.username || "user"}
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

            <div className="flex justify-center md:justify-start gap-3 mt-6">
              <button
                onClick={() => {
                  setEditProfileData({
                    full_name: profile?.full_name || "",
                    username: profile?.username || "",
                  });
                  setEditProfileModal(true);
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-sm font-bold px-6 py-2 rounded-lg transition-colors"
              >
                Edit Profil
              </button>

              <button
                onClick={handleLogout}
                className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white text-sm font-bold px-6 py-2 rounded-lg transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-zinc-800 mb-6">
          <button
            onClick={() => setActiveTab("konten")}
            className={`flex-1 py-4 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === "konten" ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            <span>📱</span> Konten Saya
          </button>
          <button
            onClick={() => setActiveTab("produk")}
            className={`flex-1 py-4 text-sm font-bold flex justify-center items-center gap-2 transition-colors ${activeTab === "produk" ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            <span>🛍️</span> Produk Saya
          </button>
        </div>

        {/* TAB 1: KONTEN SAYA */}
        {activeTab === "konten" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 animate-in fade-in duration-500">
            {/* Tombol Tambah Konten */}
            <div
              onClick={() => setUploadModal({ isOpen: true, type: "post" })}
              className="aspect-[9/16] bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 hover:bg-zinc-800 transition-colors"
            >
              <span className="text-4xl mb-2 text-gray-500">+</span>
              <span className="text-xs font-bold text-gray-500">
                Upload Konten
              </span>
            </div>

            {posts.map((post) => (
              <div
                key={post.id}
                className="aspect-[9/16] bg-zinc-800 rounded-xl relative group overflow-hidden"
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
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs font-bold backdrop-blur-sm">
                  ❤️ {post.likes_count}
                </div>

                {/* Action Hover/Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                  <button
                    onClick={() => setEditPost(post)}
                    className="bg-white text-black font-bold text-sm px-6 py-2 rounded-full w-32 hover:scale-105 transition-transform"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      setDeleteConfirm({ type: "post", id: post.id })
                    }
                    className="bg-red-500 text-white font-bold text-sm px-6 py-2 rounded-full w-32 hover:scale-105 transition-transform"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: PRODUK SAYA */}
        {activeTab === "produk" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
            {/* Tombol Tambah Produk */}
            <div
              onClick={() => setUploadModal({ isOpen: true, type: "product" })}
              className="bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 hover:bg-zinc-800 transition-colors min-h-[250px]"
            >
              <span className="text-4xl mb-2 text-gray-500">+</span>
              <span className="text-xs font-bold text-gray-500">
                Tambah Produk
              </span>
            </div>

            {products.map((product) => (
              <div
                key={product.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col relative group"
              >
                <div className="aspect-square w-full bg-zinc-800 relative">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="object-cover w-full h-full"
                  />
                  <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
                    Stok: {product.stock}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-sm line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-green-400 font-bold mt-1">
                    Rp {product.price.toLocaleString("id-ID")}
                  </p>
                </div>

                {/* Action Hover/Overlay */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                  <button
                    onClick={() => setEditProduct(product)}
                    className="bg-white text-black font-bold text-sm px-6 py-2 rounded-full w-32 hover:scale-105 transition-transform"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      setDeleteConfirm({ type: "product", id: product.id })
                    }
                    className="bg-red-500 text-white font-bold text-sm px-6 py-2 rounded-full w-32 hover:scale-105 transition-transform"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================== */}
      {/* MODAL UPLOAD */}
      {/* ========================================================================== */}
      <UploadModal
        isOpen={uploadModal.isOpen}
        type={uploadModal.type}
        onClose={() => setUploadModal({ ...uploadModal, isOpen: false })}
        onSuccess={fetchMyData}
      />

      {/* ========================================================================== */}
      {/* MODAL EDIT PROFIL */}
      {/* ========================================================================== */}
      {editProfileModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProfile}
            className="bg-zinc-900 w-full max-w-md rounded-2xl p-6 border border-zinc-800"
          >
            <h3 className="font-bold text-xl mb-4">Edit Profil</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editProfileData.full_name}
                  onChange={(e) =>
                    setEditProfileData({
                      ...editProfileData,
                      full_name: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={editProfileData.username}
                  onChange={(e) =>
                    setEditProfileData({
                      ...editProfileData,
                      username: e.target.value.toLowerCase().replace(/\s/g, ""),
                    })
                  }
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditProfileModal(false)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold text-sm hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200"
              >
                Simpan Profil
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================== */}
      {/* MODAL EDIT POST */}
      {/* ========================================================================== */}
      {editPost && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePost}
            className="bg-zinc-900 w-full max-w-md rounded-2xl p-6 border border-zinc-800"
          >
            <h3 className="font-bold text-xl mb-4">Edit Konten</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Caption
              </label>
              <textarea
                rows={4}
                required
                value={editPost.caption}
                onChange={(e) =>
                  setEditPost({ ...editPost, caption: e.target.value })
                }
                className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white resize-none"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditPost(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold text-sm hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================== */}
      {/* MODAL EDIT PRODUCT */}
      {/* ========================================================================== */}
      {editProduct && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-zinc-900 w-full max-w-md rounded-2xl p-6 border border-zinc-800 max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <h3 className="font-bold text-xl mb-4">Edit Produk</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Nama Produk
                </label>
                <input
                  type="text"
                  required
                  value={editProduct.name}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, name: e.target.value })
                  }
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-2">
                    Harga (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={editProduct.price}
                    onChange={(e) =>
                      setEditProduct({
                        ...editProduct,
                        price: Number(e.target.value),
                      })
                    }
                    className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-2">
                    Stok
                  </label>
                  <input
                    type="number"
                    required
                    value={editProduct.stock}
                    onChange={(e) =>
                      setEditProduct({
                        ...editProduct,
                        stock: Number(e.target.value),
                      })
                    }
                    className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Deskripsi
                </label>
                <textarea
                  rows={4}
                  required
                  value={editProduct.description}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold text-sm hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================== */}
      {/* MODAL KONFIRMASI HAPUS */}
      {/* ========================================================================== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-sm rounded-2xl p-6 border border-zinc-800 text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ⚠️
            </div>
            <h3 className="font-bold text-xl mb-2">Konfirmasi Hapus</h3>
            <p className="text-sm text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus{" "}
              {deleteConfirm.type === "post" ? "konten" : "produk"} ini?
              Tindakan ini akan menghapusnya secara permanen dari database.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold text-sm hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
