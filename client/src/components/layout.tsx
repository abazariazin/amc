import { Link, useLocation } from "wouter";
import { Wallet, ScanLine, Menu, X, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import logoImage from "@assets/generated_images/blue_shield_a_crypto_icon.png";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  const navItems = [
    { label: "Wallet", icon: Wallet, href: "/wallet" },
    { label: "Scanner", icon: ScanLine, href: "/scanner" },
  ];

  // Don't show layout on admin login page, but we are wrapping specific pages, 
  // so we can just control the nav items.
  
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row transition-colors duration-300">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-50">
        <div className="flex items-center gap-2">
           <img src={logoImage} alt="Logo" className="w-8 h-8 rounded-full" />
           <span className="text-lg font-display font-bold">American Coin</span>
        </div>
        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
          )}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-background z-40 p-4 animate-in slide-in-from-top-5">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div 
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-md transition-colors text-lg font-medium",
                    location === item.href 
                      ? "bg-primary/10 text-primary" 
                      : "hover:bg-muted text-muted-foreground"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon size={24} />
                  {item.label}
                </div>
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card p-6 h-screen sticky top-0">
        <div className="flex items-center gap-3 mb-10">
          <img src={logoImage} alt="Logo" className="w-10 h-10 rounded-full" />
          <span className="text-xl font-display font-bold">American Coin</span>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer",
                  location === item.href 
                    ? "bg-primary text-primary-foreground shadow-md translate-x-1" 
                    : "hover:bg-muted hover:text-foreground text-muted-foreground"
                )}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
           {mounted && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-xs font-medium pl-2">Theme</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
            </div>
          )}
          
          <div className="pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground text-center">
              &copy; 2025 American Coin
              <br />
              Secure Wallet v1.0
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden max-w-7xl mx-auto w-full transition-colors duration-300">
        {children}
      </main>
    </div>
  );
}
