-- ============================================================================
-- 1. PERSIAPAN STORAGE (BUCKETS)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true), ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. PEMBUATAN TABEL & STRUKTUR UTAMA
-- ============================================================================

-- A. Tabel Profil
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT
);

-- B. Tabel Produk
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- C. Tabel Konten (Posts)
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL, -- 'video' atau 'image'
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- D. Tabel Relasi Konten & Rekomendasi Produk
CREATE TABLE public.post_products (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, product_id)
);

-- E. Tabel Interaksi (Likes & Comments)
CREATE TABLE public.likes (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE, -- Untuk Reply
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- F. Tabel Transaksi & Chat
CREATE TABLE public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed', 'cancelled')),
  quantity_sold INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================================================

-- A. Fungsi: Mengambil Konten secara Acak
CREATE OR REPLACE FUNCTION get_random_posts(limit_count INTEGER DEFAULT 5)
RETURNS SETOF public.posts LANGUAGE sql AS $$
  SELECT * FROM public.posts ORDER BY random() LIMIT limit_count;
$$;

-- B. Fungsi: Menyelesaikan transaksi dan Auto-Update Stok
CREATE OR REPLACE FUNCTION complete_transaction(tx_id UUID, qty INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  prod_id UUID;
BEGIN
  UPDATE public.transactions
  SET status = 'completed', quantity_sold = qty
  WHERE id = tx_id RETURNING product_id INTO prod_id;
  
  UPDATE public.products
  SET stock = stock - qty
  WHERE id = prod_id;
END;
$$;

-- C. Fungsi & Trigger: Auto-insert profil saat user mendaftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    ''
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- D. Sinkronisasi Data Lama (Insert user yang sudah ada ke profiles)
INSERT INTO public.profiles (id, username, full_name, avatar_url)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', 'user_' || substr(id::text, 1, 5)), 
  COALESCE(raw_user_meta_data->>'full_name', 'Pengguna Baru'), 
  ''
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. KEAMANAN (ROW LEVEL SECURITY & POLICIES)
-- ============================================================================

-- A. AKTIFKAN RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- B. POLICIES STORAGE
CREATE POLICY "Gambar dan Video bisa dilihat publik" ON storage.objects FOR SELECT USING ( bucket_id IN ('media', 'products') );
CREATE POLICY "Pengguna login bisa upload file" ON storage.objects FOR INSERT WITH CHECK ( auth.role() = 'authenticated' AND bucket_id IN ('media', 'products') );
CREATE POLICY "Pengguna bisa hapus file sendiri" ON storage.objects FOR DELETE USING ( auth.uid() = owner );

-- C. POLICIES PROFIL
CREATE POLICY "Profil bisa dilihat siapa saja" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Pengguna bisa mengubah profil sendiri" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- D. POLICIES KONTEN (POSTS)
CREATE POLICY "Konten bisa dilihat semua orang" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Pengguna bisa membuat konten" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pengguna bisa mengubah konten sendiri" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Pengguna bisa menghapus konten sendiri" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- E. POLICIES PRODUK (PRODUCTS)
CREATE POLICY "Produk bisa dilihat semua orang" ON public.products FOR SELECT USING (true);
CREATE POLICY "Penjual bisa menambah produk" ON public.products FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Penjual bisa mengubah produk sendiri" ON public.products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Penjual bisa menghapus produk sendiri" ON public.products FOR DELETE USING (auth.uid() = seller_id);

-- F. POLICIES INTERAKSI (LIKES & COMMENTS)
CREATE POLICY "Semua orang bisa melihat likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Pengguna bisa like" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pengguna bisa hapus like sendiri" ON public.likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Semua orang bisa membaca komentar" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Pengguna bisa berkomentar" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pengguna bisa hapus komentar sendiri" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- G. POLICIES TRANSAKSI (PRIVAT)
CREATE POLICY "Bisa lihat transaksi sendiri" ON public.transactions FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Pembeli bisa buat transaksi" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Penjual bisa update status" ON public.transactions FOR UPDATE USING (auth.uid() = seller_id);

-- H. POLICIES PESAN CHAT (PRIVAT)
CREATE POLICY "Bisa lihat pesan di transaksi sendiri" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);
CREATE POLICY "Bisa kirim pesan ke transaksi sendiri" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);

-- ============================================================================
-- 5. KONFIGURASI REALTIME PUBLICATIONS (OTOMATIS)
-- ============================================================================
-- Mengaktifkan pengiriman event real-time (WebSockets) untuk tabel chat, transaksi, dan stok produk
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE Public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;