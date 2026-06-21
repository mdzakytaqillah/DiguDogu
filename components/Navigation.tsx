"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { name: "Beranda", path: "/", icon: "🏠" },
    { name: "Shop", path: "/shop", icon: "🛍️" },
    { name: "Akun", path: "/account", icon: "👤" },
  ];

  return (
    <>
      {/* 1. MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full h-14 bg-black/90 backdrop-blur-md border-t border-zinc-800 flex justify-around items-center z-[100] pb-safe">
        {navItems.map((item) => {
          const isActive =
            pathname === item.path ||
            (item.path !== "/" && pathname.startsWith(item.path));
          return (
            <Link
              key={item.name}
              href={item.path}
              className="flex items-center justify-center w-16 h-full"
            >
              <span
                className={`text-2xl transition-transform duration-200 ${isActive ? "scale-125 opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "opacity-50 hover:opacity-80"}`}
              >
                {item.icon}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* 2. DESKTOP LEFT SIDEBAR */}
      <nav className="hidden md:flex fixed left-0 top-0 h-[100dvh] w-16 lg:w-60 bg-black border-r border-zinc-800 flex-col py-6 px-2 lg:px-4 z-[100]">
        <div className="mb-10 px-2 hidden lg:block">
          <h1 className="text-xl font-bold text-white tracking-widest">
            DiguDogu
          </h1>
        </div>

        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.path ||
              (item.path !== "/" && pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-zinc-800 text-white font-bold"
                    : "text-gray-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="hidden lg:block text-base">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
