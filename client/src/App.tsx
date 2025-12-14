import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/wallet-context";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Wallet from "@/pages/wallet";
import Scanner from "@/pages/scanner";
import Admin from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import { useEffect } from "react";

// Helper function to detect if app is installed to home screen (PWA)
function isPWAInstalled(): boolean {
  if (typeof window === "undefined") return false;
  
  // Check for standalone mode (iOS Safari, Android Chrome)
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  
  // Check for iOS standalone mode (legacy)
  const isIOSStandalone = (window.navigator as any).standalone === true;
  
  // Check if running in fullscreen mode
  const isFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
  
  return isStandalone || isIOSStandalone || isFullscreen;
}

// Expose PWA detection to window for testing (dev mode only)
if (typeof window !== "undefined") {
  (window as any).__checkPWAStatus = () => {
    const isInstalled = isPWAInstalled();
    const hasWallet = localStorage.getItem("userId") !== null;
    const status = {
      isPWAInstalled: isInstalled,
      hasImportedWallet: hasWallet,
      shouldRedirect: isInstalled && hasWallet,
      displayMode: window.matchMedia("(display-mode: standalone)").matches ? "standalone" : 
                   window.matchMedia("(display-mode: fullscreen)").matches ? "fullscreen" : "browser",
      navigatorStandalone: (window.navigator as any).standalone,
      userId: localStorage.getItem("userId")
    };
    console.log("🔍 PWA Status Check:", status);
    return status;
  };
  
  // Helper to simulate PWA mode for testing
  (window as any).__simulatePWA = () => {
    console.log("⚠️ PWA simulation: This only works for testing redirect logic. Actual PWA mode requires installation.");
    // Note: We can't actually change matchMedia results, but we can test the logic
    const hasWallet = localStorage.getItem("userId") !== null;
    console.log("Current state:", {
      hasImportedWallet: hasWallet,
      userId: localStorage.getItem("userId"),
      "To test PWA redirect": "Install the app as PWA or use Chrome DevTools Device Mode"
    });
  };
}

function Router() {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check if app is installed to home screen (PWA)
    const isInstalled = isPWAInstalled();
    
    // Check for token in URL (from email link when adding to home screen)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    
    // If we have a token, try to auto-login
    if (tokenParam && !localStorage.getItem("userId")) {
      fetch("/api/auth/login-with-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: tokenParam }),
      })
        .then(res => res.json())
        .then((data) => {
          if (data.success && data.userId) {
            localStorage.setItem("userId", data.userId);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            // Redirect to wallet if in PWA mode
            if (isInstalled && location === "/") {
              setLocation("/wallet");
            }
          }
        })
        .catch((error) => {
          console.error("Token auto-login failed:", error);
        });
    }
    
    // Check if wallet is already imported (userId exists in localStorage)
    const hasImportedWallet = localStorage.getItem("userId") !== null;
    
    // If app is installed AND wallet is imported, redirect to wallet instead of landing page
    if (isInstalled && hasImportedWallet && location === "/") {
      setLocation("/wallet");
    }
  }, [location, setLocation]);
  
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/scanner" component={Scanner} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <WalletProvider>
            <Toaster />
            <Router />
          </WalletProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
