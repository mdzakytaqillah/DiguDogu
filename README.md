# DiguDogu - Real-Time Social Media & C2C Commerce Platform

DiguDogu adalah platform social commerce berbasis web yang menggabungkan pengalaman scrolling video vertikal interaktif (seperti TikTok/Reels) dengan kapabilitas transaksi jual-beli antar pengguna (C2C) secara real-time. Proyek ini dibangun menggunakan arsitektur full-stack Next.js, Tailwind CSS, dan Supabase.

## 🎯 Motivasi Proyek

Pengembangan proyek ini didorong oleh rasa ingin tahu dan keinginan untuk mengeksplorasi hal-hal baru dalam bidang pengembangan web. Fokus utama dari eksplorasi ini adalah penguasaan interaksi dan sinkronisasi data secara real-time (menggunakan WebSockets/Supabase Realtime)—sebuah konsep krusial dalam aplikasi sosial modern yang belum pernah saya sentuh sebelumnya. Proyek ini menjadi wadah eksperimen untuk menggabungkan dua ekosistem yang kompleks: media sosial dan e-commerce.

## ✨ Fitur Utama

### 📱 Sosial & Interaksi

- _Vertical Video Feed_: Menampilkan konten foto dan video dari seluruh pengguna dengan proteksi klik-kanan (anti-leeching). dan fitur hide UI khusus perangkat mobile dengan cara hold layar.

- _Sistem Autentikasi_: Registrasi dan login untuk autentikasi pengguna yang diperlukan untuk melakukan interaksi dan transaksi.

- _Likes & Nested Comments_: Pengguna dapat memberikan like, berkomentar dan membalas komentar dalam bentuk utas (thread) bersarang 1-level.

- _Profil Kreator_: Halaman khusus untuk menelusuri seluruh galeri konten dan etalase produk milik kreator tertentu.

### 🛍️ E-Commerce & Transaksi (Real-time)

- _Katalog Produk_: Grid etalase dinamis dengan proteksi klik-kanan (anti-leeching) dan manajemen visual otomatis ketika status produk Sold Out.

- _Manajemen Stok Otomatis_: Saat transaksi selesai, stok barang akan terpotong secara instan di database dan seketika mengubah tampilan di layar pembeli lain tanpa perlu refresh.

- _C2C Live Chat & Transaksi_: Ruang obrolan real-time eksklusif antara pembeli dan penjual untuk melakukan transaksi.

- _Transaction State Control_: Penjual dapat mengubah status pesanan (Berjalan, Dibatalkan, Selesai), yang secara otomatis akan mengunci ruang obrolan (disabled input) jika pesanan telah ditutup.

### 🛠️ Tech Stack & AI Tools

- _Frontend_: Next.js (App Router), Tailwind CSS.

- _Backend_: Supabase (PostgreSQL, Auth, Realtime Subscriptions, Storage).

- _AI Tools_: Proyek ini dikembangkan dengan asistensi Google Gemini 3.1 Pro Deep. Gemini membantu merancang skema database relasional, memecahkan bug, dan mempercepat penulisan kode.

### 🚧 Tantangan & Bagian Tersulit

Selama proses pengembangan, tantangan terbesar adalah manajemen state dan sinkronisasi real-time lintas perangkat.

- _Konflik Sinkronisasi_: Memastikan layar A (Penjual) dan layar B (Pembeli) melihat data yang sama di milidetik yang sama ketika terjadi perubahan status transaksi atau stok habis.

- _UX pada Layar Sentuh Mobile_: Menangani event bentrokan antara onClick, onTouchStart, dan batas scroll bawaan browser ponsel. Membangun lapisan pendeteksi gestur yang menoleransi pergeseran jari (untuk membedakan antara aksi tap, hold, dan swipe vertikal) memerlukan ketelitian yang tajam.

### ⚖️ Technical Trade-offs

- _Optimistic UI vs Data Consistency_: Untuk mencapai kecepatan interaksi seketika (seperti fitur Like dan mengirim pesan), aplikasi terlebih dahulu memanipulasi state lokal React sebelum menunggu konfirmasi dari database. Risikonya, jika koneksi internet terputus di tengah proses, UI harus melakukan rollback secara diam-diam.

- _BaaS vs Custom Backend_: Pemilihan Supabase mempercepat waktu pengembangan dan mempermudah implementasi WebSockets. Trade-off yang diambil adalah adanya ketergantungan penuh dengan pihak ketiga (Supabase), dibandingkan membangun Backend mandiri (seperti ExpressJS).

### 🔮 Rencana Kedepan & Refleksi

Jika saya memiliki waktu lebih banyak untuk mengembangkan proyek ini, hal pertama yang akan saya lakukan adalah melakukan pengujian fitur (Testing) yang lebih mendalam.
Saat ini aplikasi berjalan baik di skenario normal, namun sangat butuh pengujian yang lebih komprehensif, seperti saat pengguna kehilangan sinyal di tengah pengiriman obrolan transaksi.

### Fitur tambahan yang berpotensi diimplementasikan:

- Fitur Push Notification menggunakan Service Workers.

- Algoritma rekomendasi feed sederhana berbasis tag produk.

- Fitur share yang memungkinkan pengguna berbagi konten dengan orang lain.

- Bookmark Produk.

- Sistem Follow.

### 📈 Strategi Scaling (Skala Produksi)

Jika platform ini digunakan oleh banyak pengguna secara nyata, arsitektur saat ini harus diskalakan. Berikut adalah strategi peningkatannya:

- _Media & Storage_: Video vertikal memakan bandwidth masif. Implementasi CDN (Content Delivery Network) global dan memprosesan video ke format adaptif (seperti HLS/m3u8) agar resolusi video menyesuaikan kecepatan internet pengguna secara otomatis sangat diperlukan.

- _Pemisahan Beban_: Memisahkan microservice khusus untuk lalu lintas obrolan agar tidak membebani PostgreSQL secara langsung.

### 🚀 Panduan Instalasi & Menjalankan Proyek

1. Persiapan Supabase

Buat proyek baru di Supabase.

Jalankan eksekusi [skrip SQL](database-setup.sql) untuk membuat tabel profiles, posts, products, transactions, messages, likes, dan comments, beserta aturan RLS (Row Level Security)-nya.

Buat dua Storage Buckets berstatus Public dengan nama media dan products.

2. Kloning dan Instalasi

```bash
git clone https://github.com/mdzakytaqillah/DiguDogu.git
cd digudogu
npm install
```

3. Konfigurasi Environment
   Buat file .env.local di root direktori dan masukkan kunci API Supabase Anda:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Menjalankan Development Server
   Untuk menjalankan di komputer lokal:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser Anda untuk melihat hasil akhirnya.
