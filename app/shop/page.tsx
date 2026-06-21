"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Product, Profile } from "@/types/database";
import { User } from "@supabase/supabase-js";
import ProductModal from "@/components/ProductModal";

interface ProductWithSeller extends Product {
  seller?: Profile;
}

interface ChatMessage {
  id: string;
  transaction_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  status: "ongoing" | "completed" | "cancelled";
  created_at: string;
  product: ProductWithSeller;
  buyer: Profile;
  seller: Profile;
  messages: ChatMessage[];
}

export default function ShopPage() {
  const router = useRouter();
  const supabase = createClient();

  // State Utama
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // State Tab & Filter
  const [activeTab, setActiveTab] = useState<"katalog" | "chat">("katalog");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [chatFilter, setChatFilter] = useState<"beli" | "jual">("beli");

  // State Data dari Supabase
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [transactions, setTransactions] = useState<ChatSession[]>([]);

  // State Interaksi
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithSeller | null>(null);
  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
  const [chatInput, setChatInput] = useState<string>("");

  // Modals
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [qtySold, setQtySold] = useState<number>(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // FETCH DATA PRODUK DARI SUPABASE
  // ==========================================================================
  const fetchShopData = useCallback(async () => {
    try {
      // Ambil data user yang sedang login (jika ada)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUser(user);

      // Tarik semua produk dari database, join dengan data profil penjual
      const { data: prodsData, error } = await supabase
        .from("products")
        .select(
          `
          *,
          seller:profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts((prodsData as ProductWithSeller[]) || []);

      // Tarik data transaksi jika user sudah login
      if (user) {
        const { data: txData, error: txError } = await supabase
          .from("transactions")
          .select(
            `
            *,
            product:product_id (*, seller:seller_id(*)),
            buyer:buyer_id (id, username, full_name, avatar_url),
            seller:seller_id (id, username, full_name, avatar_url),
            messages (*)
          `,
          )
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (txError) throw txError;

        // Urutkan pesan dari yang terlama ke terbaru
        const formattedTx = (txData as unknown as ChatSession[]).map((tx) => ({
          ...tx,
          messages: tx.messages.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          ),
        }));
        setTransactions(formattedTx);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Gagal memuat:", error.message);
      } else {
        console.error("Gagal memuat:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      setTimeout(() => {
        if (isMounted) fetchShopData();
      }, 0);
    }
    return () => {
      isMounted = false;
    };
  }, [fetchShopData]);

  useEffect(() => {
    if (activeChat)
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  useEffect(() => {
    if (!currentUser) return;

    // Listener Pesan Baru (Real-time Chat)
    const msgChannel = supabase
      .channel("realtime_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          setTransactions((prev) =>
            prev.map((tx) => {
              if (
                tx.id === newMsg.transaction_id &&
                !tx.messages.some((m) => m.id === newMsg.id)
              ) {
                return { ...tx, messages: [...tx.messages, newMsg] };
              }
              return tx;
            }),
          );

          setActiveChat((prev) => {
            if (
              prev?.id === newMsg.transaction_id &&
              !prev.messages.some((m) => m.id === newMsg.id)
            ) {
              return { ...prev, messages: [...prev.messages, newMsg] };
            }
            return prev;
          });
        },
      )
      .subscribe();

    // Listener Update Transaksi
    const txChannel = supabase
      .channel("realtime_transactions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        async (payload) => {
          const newRawTx = payload.new as {
            id: string;
            buyer_id: string;
            seller_id: string;
          };
          // Jika kita adalah pembeli atau penjual di transaksi baru ini
          if (
            newRawTx.buyer_id === currentUser.id ||
            newRawTx.seller_id === currentUser.id
          ) {
            // Tarik data utuh beserta relasinya
            const { data: newFullTx } = await supabase
              .from("transactions")
              .select(
                `*, product:product_id (*, seller:seller_id(*)), buyer:buyer_id(*), seller:seller_id(*), messages(*)`,
              )
              .eq("id", newRawTx.id)
              .single();

            if (newFullTx) {
              setTransactions((prev) => {
                if (prev.some((t) => t.id === newFullTx.id)) return prev;
                return [newFullTx as unknown as ChatSession, ...prev];
              });
            }
          }
        },
      )
      // Pendeteksi UPDATE
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions" },
        (payload) => {
          const updatedTx = payload.new as {
            id: string;
            status: "ongoing" | "completed" | "cancelled";
          };
          setTransactions((prev) =>
            prev.map((tx) =>
              tx.id === updatedTx.id ? { ...tx, status: updatedTx.status } : tx,
            ),
          );
          setActiveChat((prev) =>
            prev?.id === updatedTx.id
              ? { ...prev, status: updatedTx.status }
              : prev,
          );
        },
      )
      .subscribe();

    // Listener Update Produk (Menangkap perubahan stok secara real-time)
    const prodChannel = supabase
      .channel("realtime_products")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          const updatedProd = payload.new as { id: string; stock: number };

          setProducts((prev) =>
            prev.map((p) =>
              p.id === updatedProd.id ? { ...p, stock: updatedProd.stock } : p,
            ),
          );
          setTransactions((prev) =>
            prev.map((tx) =>
              tx.product_id === updatedProd.id
                ? {
                    ...tx,
                    product: { ...tx.product, stock: updatedProd.stock },
                  }
                : tx,
            ),
          );
          setActiveChat((prev) =>
            prev?.product_id === updatedProd.id
              ? {
                  ...prev,
                  product: { ...prev.product, stock: updatedProd.stock },
                }
              : prev,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(txChannel);
      supabase.removeChannel(prodChannel);
    };
  }, [currentUser, supabase]);

  // Fungsi pelindung Auth
  const requireAuth = async (actionFn: () => void) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      if (
        window.confirm("Login dibutuhkan untuk bertransaksi. Ke halaman login?")
      ) {
        router.push("/auth");
      }
    } else {
      actionFn();
    }
  };

  const handleStartChat = async (product: ProductWithSeller) => {
    if (product.stock <= 0) return alert("Maaf, produk ini sudah habis.");

    requireAuth(async () => {
      if (!currentUser) return;

      const targetSellerId = product.seller?.id || product.seller_id;

      if (!targetSellerId) {
        alert("Gagal memproses: Data penjual tidak ditemukan.");
        return;
      }

      // Cek apakah transaksi ongoing sudah ada
      let existingTx = transactions.find(
        (tx) =>
          tx.product_id === product.id &&
          tx.buyer_id === currentUser.id &&
          tx.status === "ongoing",
      );

      if (!existingTx) {
        // BUAT SESI SEMENTARA DI LOKAL (Belum masuk database)
        existingTx = {
          id: "temp-tx", // Penanda bahwa ini belum permanen
          product_id: product.id,
          buyer_id: currentUser.id,
          seller_id: targetSellerId,
          status: "ongoing",
          created_at: new Date().toISOString(),
          product: product,
          seller: product.seller,
          buyer: {} as Profile,
          messages: [],
        } as ChatSession;
      }

      setActiveTab("chat");
      setActiveChat(existingTx);
      setSelectedProduct(null);
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChat || !currentUser) return;

    const tempMsg = chatInput;
    setChatInput(""); // Kosongkan input

    let currentTxId = activeChat.id;

    // JIKA INI ADALAH PESAN PERTAMA DALAM SATU SESI TRANSAKSI
    if (currentTxId === "temp-tx") {
      const { data: newTx, error: txError } = await supabase
        .from("transactions")
        .insert({
          product_id: activeChat.product_id,
          buyer_id: currentUser.id,
          seller_id: activeChat.seller_id,
          status: "ongoing",
        })
        .select(
          `*, product:product_id (*, seller:seller_id(*)), buyer:buyer_id(*), seller:seller_id(*), messages(*)`,
        )
        .single();

      if (txError) {
        alert("Gagal membuat transaksi: " + txError.message);
        setChatInput(tempMsg);
        return;
      }

      currentTxId = newTx.id;

      // Update state dengan data asli dari database
      setActiveChat(newTx as unknown as ChatSession);
      setTransactions((prev) => [newTx as unknown as ChatSession, ...prev]);
    }

    // KIRIM PESAN KE DATABASE
    const { error: msgError } = await supabase.from("messages").insert({
      transaction_id: currentTxId,
      sender_id: currentUser.id,
      content: tempMsg,
    });

    if (msgError) {
      alert("Gagal mengirim pesan.");
      setChatInput(tempMsg);
    }
  };

  const handleCancelTransaction = async () => {
    if (!activeChat) return;

    if (
      window.confirm(
        "Apakah Anda yakin untuk menyatakan transaksi ini teelah dibatalkan? Ruang percakapan akan ditutup.",
      )
    ) {
      try {
        const { error } = await supabase
          .from("transactions")
          .update({ status: "cancelled" })
          .eq("id", activeChat.id);

        if (error) throw error;
        alert("Transaksi resmi dibatalkan.");
      } catch (error: unknown) {
        if (error instanceof Error)
          alert("Gagal membatalkan transaksi: " + error.message);
      }
    }
  };

  const handleCompleteTransaction = async () => {
    if (!activeChat) return;
    try {
      // Potong stok produk
      const newStock = activeChat.product.stock - qtySold;
      const { error: stockErr } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", activeChat.product.id);
      if (stockErr) throw stockErr;

      // Update status transaksi
      const { error: txErr } = await supabase
        .from("transactions")
        .update({ status: "completed" })
        .eq("id", activeChat.id);
      if (txErr) throw txErr;

      setShowCompleteModal(false);
      alert("Transaksi berhasil diselesaikan!");
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Gagal menyelesaikan: ${error.message}`);
      } else {
        alert("Gagal menyelesaikan");
      }
    }
  };

  // ==========================================================================
  // UI
  // ==========================================================================
  // Filter pencarian di sisi klien
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredTransactions = transactions
    .filter((tx) =>
      chatFilter === "beli"
        ? tx.buyer_id === currentUser?.id
        : tx.seller_id === currentUser?.id,
    )
    .sort((a, b) => {
      // Ambil waktu pesan terakhir (atau waktu pembuatan transaksi jika belum ada pesan)
      const timeA =
        a.messages.length > 0
          ? a.messages[a.messages.length - 1].created_at
          : a.created_at;
      const timeB =
        b.messages.length > 0
          ? b.messages[b.messages.length - 1].created_at
          : b.created_at;
      // Urutkan dari yang terbaru ke terlama
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Memuat Marketplace...
      </div>
    );
  }

  // ==========================================================================
  // RENDER RUANG CHAT
  // ==========================================================================
  if (activeChat) {
    const isSeller = currentUser?.id === activeChat.seller_id;
    const oppositeUser = isSeller ? activeChat.buyer : activeChat.seller;

    // Logika penguncian chat jika stock habis atau transaksi tidak lagi ongoing
    const isSoldOut = activeChat.product.stock <= 0;
    const isChatLocked = activeChat.status !== "ongoing" || isSoldOut;
    let placeholderText = "Ketik pesan...";
    if (activeChat.status !== "ongoing")
      placeholderText = "Transaksi telah ditutup.";
    else if (isSoldOut) placeholderText = "Produk telah habis.";

    return (
      <main className="fixed inset-0 z-[150] bg-zinc-950 flex flex-col items-center">
        <div className="w-full max-w-2xl h-full flex flex-col bg-black border-x border-zinc-800">
          <div className="flex items-center gap-4 p-4 border-b border-zinc-800 bg-zinc-900">
            <button
              onClick={() => setActiveChat(null)}
              className="text-xl px-2"
            >
              ⬅
            </button>
            <div className="flex-1">
              <h2 className="font-bold">@{oppositeUser?.username || "user"}</h2>
              <p className="text-xs text-gray-400">
                {isSeller ? "Pembeli" : "Penjual"} •{" "}
                {activeChat.status.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/50 p-3 m-4 rounded-xl border border-zinc-800 flex gap-4 items-center">
            <div className="relative">
              <img
                src={activeChat.product.image_url}
                alt="product"
                className="w-14 h-14 object-cover rounded-lg pointer-events-none select-none ${isSoldOut ? 'opacity-50 grayscale' : ''}"
                onContextMenu={(e) => e.preventDefault()}
              />
              {isSoldOut && (
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold bg-black/60 text-red-500 rounded-lg">
                  SOLD OUT
                </span>
              )}
            </div>
            <div className="flex-1 text-sm">
              <p className="font-bold line-clamp-1">
                {activeChat.product.name}
              </p>
              <p className="text-green-400 font-semibold">
                Rp {activeChat.product.price.toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {activeChat.messages.length === 0 && (
              <p className="text-center text-gray-500 text-sm mt-10">
                Kirim pesan pertama Anda untuk menanyakan produk ini.
              </p>
            )}

            {activeChat.messages.map((msg) => {
              const isMe = msg.sender_id === currentUser?.id;
              return (
                <div
                  key={msg.id}
                  className={`max-w-[75%] rounded-2xl p-3 text-sm ${isMe ? "bg-blue-600 self-end rounded-tr-sm" : "bg-zinc-800 self-start rounded-tl-sm"}`}
                >
                  <p>{msg.content}</p>
                  <span
                    className={`text-[10px] mt-1 block ${isMe ? "text-blue-200 text-right" : "text-gray-400 text-left"}`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {isSeller && activeChat.status === "ongoing" && !isSoldOut && (
            <div className="p-3 border-t border-zinc-800 bg-zinc-900 flex gap-2">
              <button
                onClick={handleCancelTransaction}
                className="flex-1 py-2 text-xs font-bold text-red-400 bg-red-400/10 rounded-lg"
              >
                Transaksi Dibatalkan
              </button>
              <button
                onClick={() => setShowCompleteModal(true)}
                className="flex-1 py-2 text-xs font-bold text-green-400 bg-green-400/10 rounded-lg"
              >
                Tandai Selesai
              </button>
            </div>
          )}

          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t border-zinc-800 bg-black flex gap-2 pb-safe"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isChatLocked}
              placeholder={placeholderText}
              className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLocked}
              className="bg-white text-black p-2 rounded-full w-10 h-10 flex items-center justify-center"
            >
              ➤
            </button>
          </form>

          {showCompleteModal && (
            <div className="absolute inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-sm border border-zinc-800">
                <h3 className="font-bold text-lg mb-2">Transaksi Selesai</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Potong stok berdasarkan jumlah terjual.
                </p>

                <label className="block text-sm font-semibold mb-2">
                  Terjual (Max: {activeChat.product.stock})
                </label>
                <input
                  type="number"
                  min="1"
                  max={activeChat.product.stock}
                  value={qtySold}
                  onChange={(e) => setQtySold(Number(e.target.value))}
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-white mb-6 outline-none"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCompleteModal(false)}
                    className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold text-sm"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleCompleteTransaction}
                    className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm"
                  >
                    Konfirmasi
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ==========================================================================
  // RENDER HALAMAN UTAMA SHOP
  // ==========================================================================
  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        {/* Header & Main Tabs */}
        <div className="flex flex-col gap-6 mb-8 pt-4 md:pt-0">
          <h1 className="text-2xl font-bold tracking-wide">Marketplace</h1>

          <div className="flex bg-zinc-900 rounded-full p-1 w-full md:w-80">
            <button
              onClick={() => setActiveTab("katalog")}
              className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === "katalog" ? "bg-white text-black shadow-md" : "text-gray-400 hover:text-white"}`}
            >
              Katalog
            </button>
            <button
              onClick={() => requireAuth(() => setActiveTab("chat"))}
              className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === "chat" ? "bg-white text-black shadow-md" : "text-gray-400 hover:text-white"}`}
            >
              Transaksi
            </button>
          </div>
        </div>

        {/* TAB 1: KATALOG PRODUK */}
        {activeTab === "katalog" && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative w-full max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-gray-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredProducts.map((product) => {
                const isSoldOut = product.stock <= 0;
                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col transition-colors ${isSoldOut ? 'opacity-60 cursor-not-allowed' : 'hover:border-gray-600 cursor-pointer'}"
                  >
                    <div className="aspect-square w-full bg-zinc-800 relative">
                      <img
                        src={product.image_url || ""}
                        alt={product.name}
                        className="object-cover w-full h-full select-none pointer-events-none ${isSoldOut ? 'grayscale' : ''}"
                        onContextMenu={(e) => e.preventDefault()}
                        draggable="false"
                      />
                      {isSoldOut ? (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-red-500 font-extrabold text-xl tracking-widest drop-shadow-md">
                            SOLD OUT
                          </span>
                        </div>
                      ) : (
                        product.stock <= 2 && (
                          <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                            Sisa {product.stock}
                          </span>
                        )
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-bold text-sm line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-base font-bold text-green-400 mt-1 ${isSoldOut ? 'text-gray-500' : 'text-green-400'}">
                        Rp {product.price.toLocaleString("id-ID")}
                      </p>
                      <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-medium">
                          @{product.seller?.username || "user"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredProducts.length === 0 && (
              <div className="py-20 text-center text-gray-500 text-sm">
                {searchQuery
                  ? "Tidak ada produk yang ditemukan."
                  : "Belum ada produk yang dijual di katalog."}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DAFTAR TRANSAKSI (CHAT) */}
        {activeTab === "chat" && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filter Sub-Tab (Beli / Jual) */}
            <div className="flex gap-4 border-b border-zinc-800 pb-2">
              <button
                onClick={() => setChatFilter("beli")}
                className={`text-sm font-bold pb-2 border-b-2 ${chatFilter === "beli" ? "border-white text-white" : "border-transparent text-gray-500"} transition-colors`}
              >
                Pembelian Saya
              </button>
              <button
                onClick={() => setChatFilter("jual")}
                className={`text-sm font-bold pb-2 border-b-2 ${chatFilter === "jual" ? "border-white text-white" : "border-transparent text-gray-500"} transition-colors hover:text-gray-300"`}
              >
                Penjualan Saya
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {filteredTransactions.length === 0 ? (
                <div className="py-20 text-center text-gray-500 text-sm">
                  Tidak ada transaksi{" "}
                  {chatFilter === "beli" ? "pembelian" : "penjualan"}.
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const oppositeUser =
                    chatFilter === "beli" ? tx.seller : tx.buyer;
                  const lastMessage = tx.messages[tx.messages.length - 1];

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setActiveChat(tx)}
                      className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-zinc-800 transition-colors"
                    >
                      <img
                        src={tx.product.image_url || ""}
                        alt="product"
                        className="w-16 h-16 object-cover rounded-lg ${tx.product.stock <= 0 ? 'grayscale opacity-50' : ''}"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-sm">
                            @{oppositeUser?.username}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${tx.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}
                          >
                            {tx.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-1 line-clamp-1">
                          {tx.product.name}
                        </p>
                        {lastMessage && (
                          <p className="text-sm text-gray-300 line-clamp-1">
                            {lastMessage.sender_id === currentUser?.id
                              ? "Anda: "
                              : ""}
                            {lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================== */}
      {/* MODAL DETAIL PRODUK OVERLAY */}
      {/* ========================================================================== */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          currentUser={currentUser}
          onClose={() => setSelectedProduct(null)}
          onStartChat={handleStartChat}
        />
      )}
    </main>
  );
}
