export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  seller?: Profile; // Relasi di-join saat fetch
}

export interface Post {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "video" | "image";
  caption: string;
  created_at: string;
  author?: Profile;
  likes_count?: number;
  comments_count?: number;
  products?: Product[];
}
