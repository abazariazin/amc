import { Link, useLocation } from "wouter";
import { Wallet, ScanLine, Menu, X, Sun, Moon, Eye, Lock, Mail, AlertTriangle, Clock, Loader2, Copy, Key } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import logoImage from "@assets/generated_images/blue_shield_a_crypto_icon.png";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/lib/wallet-context";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Helper function to mask email address
// Example: abncd@gmail.com → a***d@g***.c**
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }
  
  const [localPart, domain] = email.split('@');
  
  // Mask local part: show first char and last char, mask middle with asterisks
  let maskedLocal = '';
  if (localPart.length <= 1) {
    maskedLocal = localPart;
  } else if (localPart.length === 2) {
    maskedLocal = localPart[0] + '*';
  } else {
    maskedLocal = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
  }
  
  // Mask domain: split by dot
  const domainParts = domain.split('.');
  const maskedDomainParts = domainParts.map((part, index) => {
    const isLastPart = index === domainParts.length - 1;
    
    if (part.length <= 1) {
      return part;
    } else if (part.length === 2) {
      return part[0] + '*';
    } else {
      if (isLastPart) {
        // TLD: show first char and last char with asterisks in between
        return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
      } else {
        // Domain part before TLD: show first char, rest with asterisks
        return part[0] + '*'.repeat(part.length - 1);
      }
    }
  });
  
  return `${maskedLocal}@${maskedDomainParts.join('.')}`;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user } = useWallet();
  const { toast } = useToast();
  
  // View Seed Modal State
  const [showViewSeedEmailModal, setShowViewSeedEmailModal] = useState(false);
  const [showViewSeedOTPModal, setShowViewSeedOTPModal] = useState(false);
  const [viewSeedOTPCode, setViewSeedOTPCode] = useState("");
  const [viewSeedOTPExpiresAt, setViewSeedOTPExpiresAt] = useState<number | null>(null);
  const [viewSeedOTPTimeLeft, setViewSeedOTPTimeLeft] = useState<number>(600);
  const [isRequestingViewSeedOTP, setIsRequestingViewSeedOTP] = useState(false);
  const [isVerifyingViewSeedOTP, setIsVerifyingViewSeedOTP] = useState(false);
  const [viewedSeedPhrase, setViewedSeedPhrase] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  // OTP countdown timer for view seed
  useEffect(() => {
    if (viewSeedOTPExpiresAt && showViewSeedOTPModal) {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((viewSeedOTPExpiresAt - now) / 1000));
        setViewSeedOTPTimeLeft(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [viewSeedOTPExpiresAt, showViewSeedOTPModal]);

  const handleRequestViewSeedOTP = async () => {
    setIsRequestingViewSeedOTP(true);
    try {
      const response = await apiRequest("POST", "/api/auth/request-view-seed-otp", {});
      const data = await response.json();
      
      if (data.success) {
        setShowViewSeedEmailModal(false);
        setShowViewSeedOTPModal(true);
        setViewSeedOTPExpiresAt(data.expiresAt);
        setViewSeedOTPTimeLeft(600); // 10 minutes
        toast({ title: "OTP Sent", description: "Check your email for the verification code" });
      } else {
        toast({ title: "Error", description: data.error || "Failed to send OTP", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send OTP", variant: "destructive" });
    } finally {
      setIsRequestingViewSeedOTP(false);
    }
  };

  const handleVerifyViewSeedOTP = async () => {
    if (!viewSeedOTPCode || viewSeedOTPCode.length !== 6) {
      toast({ title: "Error", description: "Please enter a valid 6-digit code", variant: "destructive" });
      return;
    }
    
    if (viewSeedOTPTimeLeft === 0) {
      toast({ title: "Error", description: "OTP code has expired. Please request a new one.", variant: "destructive" });
      return;
    }
    
    setIsVerifyingViewSeedOTP(true);
    try {
      const response = await apiRequest("POST", "/api/auth/verify-view-seed-otp", {
        code: viewSeedOTPCode.trim()
      });
      const data = await response.json();
      
      if (data.success) {
        setShowViewSeedOTPModal(false);
        setViewedSeedPhrase(data.seedPhrase);
        setViewSeedOTPCode("");
      } else {
        toast({ title: "Error", description: data.error || "Invalid OTP code", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to verify OTP", variant: "destructive" });
    } finally {
      setIsVerifyingViewSeedOTP(false);
    }
  };

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
            {user && (
              <>
                <div 
                  onClick={() => {
                    setShowViewSeedEmailModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 p-4 rounded-md transition-colors text-lg font-medium hover:bg-muted text-muted-foreground"
                >
                  <Eye size={24} />
                  View Seed Phrase
                </div>
                <div 
                  onClick={async () => {
                    setIsLoadingToken(true);
                    setShowTokenModal(true);
                    setIsMobileMenuOpen(false);
                    try {
                      // Fetch user data to get login token
                      const response = await apiRequest("GET", `/api/users/${user.id}`, {});
                      const data = await response.json();
                      const token = (data as any).loginToken || data.id; // Fallback to user ID
                      setLoginToken(token);
                    } catch (error) {
                      console.error("Failed to fetch login token:", error);
                      toast({ title: "Error", description: "Failed to load login token", variant: "destructive" });
                    } finally {
                      setIsLoadingToken(false);
                    }
                  }}
                  className="flex items-center gap-3 p-4 rounded-md transition-colors text-lg font-medium hover:bg-muted text-muted-foreground"
                >
                  <Key size={24} />
                  Copy Login Token
                </div>
              </>
            )}
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
          
          {/* View Seed Phrase Menu Item */}
          {user && (
            <div 
              onClick={() => setShowViewSeedEmailModal(true)}
              className="flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer hover:bg-muted hover:text-foreground text-muted-foreground"
            >
              <Eye size={20} />
              <span className="font-medium">View Seed Phrase</span>
            </div>
          )}
          
          {/* Copy Login Token Menu Item */}
          {user && (
            <div 
              onClick={async () => {
                setIsLoadingToken(true);
                setShowTokenModal(true);
                try {
                  // Fetch user data to get login token
                  const response = await apiRequest("GET", `/api/users/${user.id}`);
                  const data = await response.json();
                  const token = (data as any).loginToken || data.id; // Fallback to user ID
                  setLoginToken(token);
                } catch (error) {
                  console.error("Failed to fetch login token:", error);
                  toast({ title: "Error", description: "Failed to load login token", variant: "destructive" });
                } finally {
                  setIsLoadingToken(false);
                }
              }}
              className="flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer hover:bg-muted hover:text-foreground text-muted-foreground"
            >
              <Key size={20} />
              <span className="font-medium">Copy Login Token</span>
            </div>
          )}
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

      {/* View Seed Email Modal */}
      <Dialog open={showViewSeedEmailModal} onOpenChange={setShowViewSeedEmailModal}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg mx-auto rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Eye className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <DialogTitle className="text-xl">View Seed Phrase</DialogTitle>
            <DialogDescription className="text-sm">
              For security, we'll send a verification code to your email address
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-800">Security Verification Required</p>
                  <p className="text-xs text-red-700">
                    To protect your wallet, we need to verify your identity before showing your seed phrase.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email Address</Label>
              <Input
                type="email"
                value={user?.email ? maskEmail(user.email) : ""}
                disabled
                className="rounded-xl bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Verification code will be sent to this email address
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowViewSeedEmailModal(false)} 
              className="flex-1 rounded-xl"
              disabled={isRequestingViewSeedOTP}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRequestViewSeedOTP} 
              disabled={isRequestingViewSeedOTP}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600"
            >
              {isRequestingViewSeedOTP ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Code
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Seed OTP Modal */}
      <Dialog open={showViewSeedOTPModal} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <DialogTitle className="text-xl">Enter Verification Code</DialogTitle>
            <DialogDescription className="text-sm">
              We sent a 6-digit code to <strong>{user?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {viewSeedOTPTimeLeft < 120 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-500" />
                  <p className="text-xs font-semibold text-red-800">
                    Code expires in {Math.floor(viewSeedOTPTimeLeft / 60)}:{(viewSeedOTPTimeLeft % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>
            )}
            
            {viewSeedOTPTimeLeft === 0 && (
              <div className="bg-red-100 border-2 border-red-500 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Code Expired</p>
                    <p className="text-xs text-red-700 mt-1">
                      The verification code has expired. Please close this dialog and request a new code.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="view-seed-otp-code" className="text-sm font-medium">Verification Code</Label>
              <Input
                id="view-seed-otp-code"
                type="text"
                placeholder="000000"
                value={viewSeedOTPCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setViewSeedOTPCode(value);
                }}
                className="rounded-xl text-center text-2xl font-mono tracking-widest"
                maxLength={6}
                disabled={isVerifyingViewSeedOTP || viewSeedOTPTimeLeft === 0}
              />
              <p className="text-xs text-muted-foreground text-center">
                {viewSeedOTPTimeLeft > 0 ? (
                  <>Code expires in {Math.floor(viewSeedOTPTimeLeft / 60)}:{(viewSeedOTPTimeLeft % 60).toString().padStart(2, '0')}</>
                ) : (
                  <span className="text-red-500 font-semibold">Code expired</span>
                )}
              </p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  <strong>Security Notice:</strong> If you did not request this code, do not enter it. Contact support immediately.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowViewSeedOTPModal(false);
                setViewSeedOTPCode("");
              }} 
              className="flex-1 rounded-xl"
              disabled={isVerifyingViewSeedOTP}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleVerifyViewSeedOTP} 
              disabled={viewSeedOTPCode.length !== 6 || isVerifyingViewSeedOTP || viewSeedOTPTimeLeft === 0}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600"
            >
              {isVerifyingViewSeedOTP ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Verify
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Token Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <Key className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-xl">Your Login Token</DialogTitle>
            <DialogDescription className="text-sm">
              Use this token to restore access to your wallet from the home screen
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-yellow-800">Important</p>
                  <p className="text-xs text-yellow-700">
                    Save this token securely. You can use it to restore access to your wallet without entering your seed phrase.
                  </p>
                </div>
              </div>
            </div>
            
            {isLoadingToken ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : loginToken ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Login Token</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={loginToken}
                    readOnly
                    className="rounded-xl font-mono text-sm bg-muted"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(loginToken);
                      toast({ title: "Copied", description: "Login token copied to clipboard" });
                    }}
                    size="icon"
                    className="rounded-xl"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click the copy button to copy this token. Use it in the "Restore with Token" option on the landing page.
                </p>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Failed to load token
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                setShowTokenModal(false);
                setLoginToken(null);
              }} 
              className="flex-1 rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Seed Phrase Modal */}
      <Dialog open={!!viewedSeedPhrase} onOpenChange={(open) => !open && setViewedSeedPhrase(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            <DialogTitle className="text-xl">Your Seed Phrase</DialogTitle>
            <DialogDescription className="text-sm">
              ⚠️ Keep this secret and secure. Anyone with this phrase can access your wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-2">
                {viewedSeedPhrase?.split(/\s+/).map((word, index) => (
                  <div
                    key={index}
                    className="bg-white border border-yellow-400 rounded-md p-2 text-center"
                  >
                    <span className="text-xs text-yellow-700 font-semibold mr-1">{index + 1}.</span>
                    <span className="text-sm font-mono font-semibold text-yellow-900">{word}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800 font-semibold mb-2">🚨 SECURITY WARNING:</p>
              <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                <li>Never share your seed phrase with anyone</li>
                <li>Do not store it digitally (screenshots, cloud storage, etc.)</li>
                <li>Write it down on paper and store it securely offline</li>
                <li>Anyone with your seed phrase can access your wallet</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                navigator.clipboard.writeText(viewedSeedPhrase || "");
                toast({ title: "Copied", description: "Seed phrase copied to clipboard" });
              }}
              className="w-full rounded-xl"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Seed Phrase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
