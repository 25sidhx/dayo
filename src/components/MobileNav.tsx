"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, PieChart, Settings } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", icon: LayoutDashboard, href: "/dashboard" },
    { label: "Schedule", icon: Calendar, href: "/schedule" },
    { label: "Stats", icon: PieChart, href: "/attendance" },
    { label: "Settings", icon: Settings, href: "/settings" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#F3F4F6] px-6 py-3 flex items-center justify-between z-40 pb-safe">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`flex flex-col items-center gap-1 transition-colors ${
              isActive ? "text-[#6366F1]" : "text-[#9CA3AF]"
            }`}
          >
            <Icon className={`w-6 h-6 ${isActive ? "fill-[#6366F1]/10" : ""}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
