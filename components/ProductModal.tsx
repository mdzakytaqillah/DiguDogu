"use client";

import { useEffect } from "react";
import { Product, Profile } from "@/types/database";
import { User } from "@supabase/supabase-js";

interface ProductWithSeller extends Product {
  seller_id: string;
  seller?: Profile;
}

interface ProductModalProps {
  product: ProductWithSeller;
  currentUser: User | null;
  onClose: () => void;
  onStartChat: (product: ProductWithSeller) => void;
}

export default function ProductModal({
  product,
  currentUser,
  onClose,
  onStartChat,
}: ProductModalProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4">
      <div className="bg-zinc-900 w-full md:max-w-lg h-[80vh] md:h-auto md:max-h-[90vh] rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 z-10 sticky top-0">
          <h3 className="font-bold text-lg">Detail Produk</h3>
          <button onClick={onClose} className="text-xl px-2">
            ✕
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
          <div className="relative w-full aspect-square bg-zinc-800">
            <img
              src={product.image_url || ""}
              alt={product.name}
              className={`w-full aspect-square object-cover select-none pointer-events-none ${product.stock <= 0 ? "grayscale opacity-50" : ""}`}
              onContextMenu={(e) => e.preventDefault()}
              draggable="false"
            />
            {product.stock <= 0 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-red-500 font-extrabold text-3xl tracking-widest drop-shadow-lg">
                  SOLD OUT
                </span>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex justify-between items-start gap-4">
              <h2 className="text-xl font-bold">{product.name}</h2>
              <span className="bg-zinc-800 text-xs px-2 py-1 rounded whitespace-nowrap">
                Stok: {product.stock}
              </span>
            </div>
            <p className="text-2xl font-bold text-green-400 mt-2">
              Rp {product.price.toLocaleString("id-ID")}
            </p>

            <div className="mt-6 border-t border-zinc-800 pt-6">
              <h4 className="font-bold mb-2">Deskripsi Produk</h4>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {product.description || "Tidak ada deskripsi."}
              </p>
            </div>

            <div className="mt-6 border-t border-zinc-800 pt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center font-bold">
                {product.seller?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-gray-400">Dijual oleh</p>
                <p className="font-bold">
                  @{product.seller?.username || "user"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Fixed Footer Action */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex gap-4 pb-safe">
          {currentUser && product.seller_id === currentUser.id ? (
            <button
              disabled
              className="w-full py-3 rounded-xl bg-zinc-800 text-gray-500 font-bold text-sm cursor-not-allowed"
            >
              Ini adalah produk Anda
            </button>
          ) : (
            <button
              disabled={product.stock <= 0}
              onClick={() => {
                onStartChat(product);
              }}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${product.stock <= 0 ? "bg-zinc-800 text-gray-500 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200"}`}
            >
              {product.stock <= 0 ? "HABIS" : "💬 Chat Penjual"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
