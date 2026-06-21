"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatPostDate } from "@/utils/dateFormatter";
import { Post, Profile } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";

// ============================================================================
// DEFINISI TIPE DATA
// ============================================================================
export interface CommentWithAuthor {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author: Profile;
}

export interface PostWithData extends Post {
  author: Profile;
  likes: { user_id: string }[];
  comments: CommentWithAuthor[];
}

interface FeedItemProps {
  post: PostWithData;
  currentUser: User | null;
  onRequireAuth: (actionFn: () => void) => void;
  onModalToggle?: (isOpen: boolean) => void;
}

// ============================================================================
// KOMPONEN UTAMA
// ============================================================================
export default function FeedItem({
  post,
  currentUser,
  onRequireAuth,
  onModalToggle,
}: FeedItemProps) {
  const supabase = createClient();
  const router = useRouter();

  // Refs untuk navigasi DOM
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  // Refs untuk mapping posisi touch
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // State UI
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hideUI, setHideUI] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // State Data Interaktif
  const [isLiked, setIsLiked] = useState<boolean>(
    post.likes.some((l) => l.user_id === currentUser?.id),
  );
  const [likesCount, setLikesCount] = useState<number>(post.likes.length);
  const [commentsList, setCommentsList] = useState<CommentWithAuthor[]>(
    post.comments,
  );
  const [commentInput, setCommentInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [replyTo, setReplyTo] = useState<CommentWithAuthor | null>(null);

  // Limit karakter caption
  const MOBILE_CAPTION_LIMIT = 80;
  const DESKTOP_CAPTION_LIMIT = 150;
  const isMobileCaptionLong = post.caption?.length > MOBILE_CAPTION_LIMIT;
  const isDesktopCaptionLong = post.caption?.length > DESKTOP_CAPTION_LIMIT;

  const toggleCommentsModal = (status: boolean) => {
    setShowCommentsModal(status);
    if (onModalToggle) onModalToggle(status);
  };

  // ==========================================================================
  // AUTOPLAY VIDEO LOGIC
  // ==========================================================================
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (post.media_type === "video" && videoRef.current) {
              videoRef.current
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
            }
          } else {
            if (post.media_type === "video" && videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
              setIsPlaying(false);
            }
            setShowFullCaption(false);
            setShowCommentsModal(false);
            if (onModalToggle) onModalToggle(false);
          }
        });
      },
      { threshold: 0.6 },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [post.media_type]);

  // ==========================================================================
  // HANDLERS UI (Menahan Sentuhan, SeekBar Video)
  // ==========================================================================

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    pressTimer.current = setTimeout(() => setHideUI(true), 600);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Toleransi pergeseran jari 15px.
    // Jika jari bergetar/geser sedikit, timer hideUI TIDAK dibatalkan.
    const moveX = Math.abs(e.touches[0].clientX - touchStartX.current);
    const moveY = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (moveX > 15 || moveY > 15) {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    }
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleMediaClick = () => {
    if (post.media_type === "video" && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser?.id === post.user_id) {
      router.push("/account"); // Lempar ke halaman akun sendiri
    } else {
      router.push(`/user/${post.author?.username}`); // Lempar ke profil kreator
    }
  };

  const handleCommentProfileClick = (username: string, userId: string) => {
    if (currentUser?.id === userId) {
      router.push("/account");
    } else {
      router.push(`/user/${username}`);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setProgress(
        (videoRef.current.currentTime / videoRef.current.duration) * 100,
      );
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const seekTo =
        (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = seekTo;
      setProgress(parseFloat(e.target.value));
    }
  };

  // ==========================================================================
  // HANDLERS DATA LIKES & COMMENTS
  // ==========================================================================
  const handleToggleLike = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onRequireAuth(async () => {
      if (!currentUser) return;
      const wasLiked = isLiked;
      setIsLiked(!wasLiked);
      setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1)); // Optimistic Update

      if (wasLiked) {
        await supabase
          .from("likes")
          .delete()
          .match({ post_id: post.id, user_id: currentUser.id });
      } else {
        await supabase
          .from("likes")
          .insert({ post_id: post.id, user_id: currentUser.id });
      }
    });
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (!currentUser) {
      e.currentTarget.blur();
      onRequireAuth(() => {});
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !currentUser) return;

    setIsSubmitting(true);
    const parentIdToUse = replyTo ? replyTo.parent_id || replyTo.id : null;
    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: post.id,
        user_id: currentUser.id,
        content: commentInput.trim(),
        parent_id: parentIdToUse,
      })
      .select(`*, author:user_id(id, username, full_name, avatar_url)`)
      .single();

    setIsSubmitting(false);
    if (error) {
      alert("Gagal mengirim komentar: " + error.message);
      return;
    }

    setCommentInput("");
    setReplyTo(null);
    setCommentsList((prev) => [...prev, data as unknown as CommentWithAuthor]);
  };

  // ==========================================================================
  // RENDER UI UTAMA
  // ==========================================================================
  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100dvh] flex flex-col md:flex-row bg-black text-white snap-center overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. AREA KONTEN (60% Desktop / 100% Mobile) */}
      <div className="relative w-full h-full md:w-[60%] lg:w-[70%] flex items-center justify-center bg-black">
        <div
          className={`absolute inset-0 z-10 ${post.media_type === "video" ? "cursor-pointer" : ""}`}
          onClick={handleMediaClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        />

        {post.media_type === "video" ? (
          <video
            ref={videoRef}
            src={post.media_url}
            loop
            muted={isMuted}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-full object-contain relative z-0"
          />
        ) : (
          <img
            src={post.media_url}
            alt="Post"
            className="w-full h-full object-contain relative z-0 select-none pointer-events-none"
            onContextMenu={(e) => e.preventDefault()}
            draggable="false"
          />
        )}

        {post.media_type === "video" && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-20">
            <span className="text-white text-5xl opacity-80 drop-shadow-lg">
              ▶
            </span>
          </div>
        )}

        {post.media_type === "video" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className={`absolute bottom-20 md:bottom-6 right-4 p-2 bg-black/50 rounded-full z-50 ${hideUI ? "md:block hidden" : "block"}`}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
        )}

        {post.media_type === "video" && (
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="absolute bottom-14 md:bottom-0 left-0 w-full h-1 bg-gray-600 appearance-none z-50 cursor-pointer accent-white"
          />
        )}
      </div>

      {hideUI && (
        <button
          onClick={() => setHideUI(false)}
          className="md:hidden absolute bottom-18 right-4 z-[110] bg-white/20 p-2 rounded-full backdrop-blur"
        >
          👁️ Tampilkan Info
        </button>
      )}

      {/* 2. OVERLAY MOBILE */}
      {!hideUI && (
        <div className="md:hidden absolute inset-0 pointer-events-none flex flex-col justify-end p-4 pb-20 z-40 bg-gradient-to-t from-black/80 via-transparent to-transparent">
          <div className="flex items-end justify-between w-full">
            <div
              className="flex-1 pr-12 text-sm"
              onClick={() => {
                if (showFullCaption) setShowFullCaption(false);
              }}
            >
              <h3
                className="font-bold cursor-pointer drop-shadow-md hover:underline w-max inline-block select-none"
                onClick={handleProfileClick}
              >
                @{post.author?.username || "user"}
              </h3>
              <p className="text-xs text-gray-300 drop-shadow-md select-none">
                {formatPostDate(post.created_at)}
              </p>

              <div className="mt-2 text-white drop-shadow-md select-none pointer-events-auto inline-block">
                {showFullCaption ? (
                  <p>{post.caption}</p>
                ) : (
                  <p className="line-clamp-2">{post.caption}</p>
                )}
                {isMobileCaptionLong && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullCaption(!showFullCaption);
                    }}
                    className="font-bold text-gray-300 mt-1"
                  >
                    {showFullCaption ? "Read less" : "Read more"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 mb-12 select-none [-webkit-touch-callout:none] pointer-events-auto">
              <div
                className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-white overflow-hidden mb-2"
                onClick={handleProfileClick}
              >
                {post.author?.avatar_url ? (
                  <img
                    src={post.author.avatar_url}
                    alt="avatar"
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-lg bg-zinc-700">
                    {post.author?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center">
                <button
                  onClick={handleToggleLike}
                  className="bg-black/40 p-3 rounded-full backdrop-blur transition-transform hover:scale-110"
                >
                  <span
                    className={`text-xl drop-shadow-lg ${isLiked ? "text-red-500" : "text-white"}`}
                  >
                    {isLiked ? "❤️" : "🤍"}
                  </span>
                </button>
                <span className="text-xs font-bold mt-1 drop-shadow-md">
                  {likesCount}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCommentsModal(true);
                    if (onModalToggle) onModalToggle(true);
                  }}
                  className="bg-black/40 p-3 rounded-full backdrop-blur transition-transform hover:scale-110"
                >
                  <span className="text-xl drop-shadow-lg text-white">💬</span>
                </button>
                <span className="text-xs font-bold mt-1 drop-shadow-md">
                  {commentsList.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BOTTOM SHEET KOMENTAR (MOBILE SAJA) */}
      {showCommentsModal && (
        <div className="md:hidden absolute inset-0 z-[110] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => toggleCommentsModal(false)}
          />
          <div className="relative bg-zinc-900 w-full h-[70vh] rounded-t-2xl flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex justify-center items-center">
              <h4 className="font-bold text-sm">
                Komentar ({commentsList.length})
              </h4>
              <button
                onClick={() => toggleCommentsModal(false)}
                className="absolute right-4 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24">
              {renderCommentsList(
                commentsList,
                post.user_id,
                currentUser,
                onRequireAuth,
                handleCommentProfileClick,
                setReplyTo,
              )}
            </div>
            {replyTo && (
              <div className="flex justify-between items-center text-xs text-gray-400 px-4 pt-3 pb-1">
                <span>
                  Membalas{" "}
                  <span className="font-bold text-gray-300">
                    @{replyTo.author.username}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="hover:text-white font-bold"
                >
                  ✕ Batal
                </button>
              </div>
            )}
            <form
              onSubmit={handleSubmitComment}
              className="absolute bottom-0 w-full p-4 border-t border-zinc-800 bg-zinc-900 pb-8 flex gap-2"
            >
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onClick={handleInputClick}
                placeholder={
                  replyTo ? "Ketik balasan..." : "Tambahkan komentar..."
                }
                className="flex-1 bg-zinc-800 rounded-full px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white disabled={!currentUser || isSubmitting}"
              />
              <button
                type="submit"
                disabled={!commentInput.trim() || isSubmitting || !currentUser}
                className="bg-white text-black font-bold px-4 rounded-full text-sm disabled:opacity-50"
              >
                Kirim
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. BOX KANAN DESKTOP (Sidebar Statis) */}
      <div
        className="hidden md:flex flex-col w-[40%] lg:w-[30%] bg-zinc-900 h-full border-l border-zinc-800 z-10 relative"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-zinc-800">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold"
                onClick={handleProfileClick}
              >
                {post.author?.avatar_url ? (
                  <img
                    src={post.author.avatar_url}
                    alt="avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  post.author?.username?.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h3
                  className="font-bold cursor-pointer w-max inline-block select-none"
                  onClick={handleProfileClick}
                >
                  @{post.author?.username || "user"}
                </h3>
                <p className="text-xs text-gray-400">
                  {formatPostDate(post.created_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm">
            <p
              className={
                showFullCaption ? "" : "line-clamp-4 whitespace-pre-wrap"
              }
            >
              {post.caption}
            </p>
            {isDesktopCaptionLong && (
              <button
                onClick={() => setShowFullCaption(!showFullCaption)}
                className="text-gray-400 font-bold mt-1"
              >
                {showFullCaption ? "Read less" : "Read more"}
              </button>
            )}
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t border-zinc-800">
            <button
              onClick={handleToggleLike}
              className={`flex items-center gap-2 transition ${isLiked ? "text-red-500" : "hover:text-gray-300"}`}
            >
              {isLiked ? "❤️" : "🤍"} {likesCount}
            </button>
            <button className="flex items-center gap-2 hover:text-gray-300 transition">
              💬 {commentsList.length}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col">
          {renderCommentsList(
            commentsList,
            post.user_id,
            currentUser,
            onRequireAuth,
            handleCommentProfileClick,
            setReplyTo,
          )}
        </div>
        {replyTo && (
          <div className="flex justify-between items-center text-xs text-gray-400 px-4 pt-3 pb-1">
            <span>
              Membalas{" "}
              <span className="font-bold text-gray-300">
                @{replyTo.author.username}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="hover:text-white font-bold"
            >
              ✕ Batal
            </button>
          </div>
        )}
        <form
          onSubmit={handleSubmitComment}
          className="p-4 border-t border-zinc-800 bg-zinc-900 flex gap-2"
        >
          <input
            type="text"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onClick={handleInputClick}
            placeholder={replyTo ? "Ketik balasan..." : "Tambahkan komentar..."}
            className="flex-1 bg-zinc-800 rounded-full px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-white disabled={!currentUser || isSubmitting}"
          />
          <button
            type="submit"
            disabled={!commentInput.trim() || isSubmitting || !currentUser}
            className="bg-white text-black font-bold px-4 rounded-full text-sm disabled:opacity-50"
          >
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// FUNGSI RENDER KOMENTAR HELPER
// ============================================================================
function renderCommentsList(
  comments: CommentWithAuthor[],
  postUserId: string,
  currentUser: User | null,
  requireAuth: (action: () => void) => void,
  onProfileClick: (username: string, userId: string) => void,
  onReplyClick: (comment: CommentWithAuthor) => void,
) {
  if (comments.length === 0)
    return (
      <p className="text-center text-gray-500 text-sm mt-10">
        Belum ada komentar. Jadilah yang pertama!
      </p>
    );

  // Pisahkan root (komentar utama)
  const rootComments = comments.filter((c) => !c.parent_id);

  // Fungsi template UI agar tidak mengulang kode
  const renderCommentUI = (c: CommentWithAuthor, isReply = false) => (
    <div key={c.id} className={`flex gap-3 ${isReply ? "mt-4" : ""}`}>
      <div
        onClick={() => onProfileClick(c.author.username, c.user_id)}
        className="w-8 h-8 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs font-bold cursor-pointer select-none overflow-hidden"
      >
        {c.author?.avatar_url ? (
          <img
            src={c.author.avatar_url}
            className="w-full h-full object-cover"
          />
        ) : (
          c.author?.username?.charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex flex-col text-sm w-full">
        <div className="flex flex-wrap items-center gap-2">
          <span
            onClick={() => onProfileClick(c.author.username, c.user_id)}
            className="font-bold text-gray-300 cursor-pointer hover:underline w-max inline-block select-none"
          >
            @{c.author.username}
          </span>
          {c.user_id === postUserId && (
            <span className="bg-red-500/20 text-red-400 border border-red-500/50 text-[10px] px-1.5 py-0.5 rounded font-bold">
              Pembuat
            </span>
          )}
          <span className="text-xs text-gray-500">
            {new Date(c.created_at).toLocaleDateString("id-ID")}
          </span>
        </div>
        <p className="text-gray-100 mt-1 whitespace-pre-wrap">{c.content}</p>
        <div className="flex items-center gap-4 mt-2 text-xs font-semibold text-gray-400">
          <button
            onClick={() => requireAuth(() => onReplyClick(c))}
            className="hover:text-white transition-colors"
          >
            Balas
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {rootComments.map((root) => {
        // Cari semua balasan yang menginduk ke komentar ini
        const replies = comments.filter((r) => r.parent_id === root.id);
        return (
          <div key={root.id} className="flex flex-col">
            {/* Render Komentar Utama */}
            {renderCommentUI(root)}

            {/* Render Balasan (Jika ada) dengan indentation */}
            {replies.length > 0 && (
              <div className="ml-[1.125rem] border-l-2 border-zinc-800 pl-4 flex flex-col mt-1">
                {replies.map((reply) => renderCommentUI(reply, true))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
