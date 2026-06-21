"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "post" | "product";
  onSuccess: () => void; // Trigger untuk me-refresh data setelah berhasil upload
}

export default function UploadModal({
  isOpen,
  onClose,
  type,
  onSuccess,
}: UploadModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // State untuk Post
  const [caption, setCaption] = useState("");

  // State untuk Product
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");

  // State null
  const resetForm = () => {
    setFile(null);
    setCaption("");
    setName("");
    setPrice("");
    setStock("");
    setDescription("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Pilih file terlebih dahulu!");

    setLoading(true);
    try {
      // Dapatkan user ID yang sedang login
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Anda belum login!");

      // Tentukan bucket dan format nama file agar unik
      const bucket = type === "post" ? "media" : "products";
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Upload file ke Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Dapatkan URL Publik dari file yang baru diupload
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(fileName);

      // Simpan data ke Database (Tabel posts atau products)
      if (type === "post") {
        const isVideo = file.type.startsWith("video/");
        const { error: dbError } = await supabase.from("posts").insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: isVideo ? "video" : "image",
          caption: caption,
        });
        if (dbError) throw dbError;
      } else if (type === "product") {
        const { error: dbError } = await supabase.from("products").insert({
          seller_id: user.id,
          name,
          price: Number(price),
          stock: Number(stock),
          description,
          image_url: publicUrl,
        });
        if (dbError) throw dbError;
      }

      alert("Upload berhasil!");
      resetForm(); // Reset form setelah berhasil upload
      onSuccess(); // Refresh data
      onClose(); // Tutup modal
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Gagal upload: ${error.message}`);
      } else {
        alert("Gagal upload");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-md rounded-2xl p-6 border border-zinc-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl">
            Upload {type === "post" ? "Konten Baru" : "Produk Baru"}
          </h3>
          <button onClick={handleClose} className="text-xl">
            ✕
          </button>
        </div>

        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          {/* Input File Universal */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Pilih File ({type === "post" ? "Video/Gambar" : "Gambar"})
            </label>
            <input
              type="file"
              accept={type === "post" ? "video/*,image/*" : "image/*"}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer"
            />
          </div>

          {/* Form Khusus Post (Konten Feed) */}
          {type === "post" && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Caption
              </label>
              <textarea
                rows={4}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ceritakan tentang konten ini..."
                className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white resize-none"
              />
            </div>
          )}

          {/* Form Khusus Product (Shop) */}
          {type === "product" && (
            <>
              <input
                type="text"
                placeholder="Nama Produk"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white"
              />
              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="Harga (Rp)"
                  required
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white"
                />
                <input
                  type="number"
                  placeholder="Stok Awal"
                  required
                  min="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white"
                />
              </div>
              <textarea
                rows={4}
                placeholder="Deskripsi Produk"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white resize-none"
              />
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4 hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? "Mengunggah..." : "Upload Sekarang"}
          </button>
        </form>
      </div>
    </div>
  );
}
