import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Wallet, Download, Plus, Loader2, AlertCircle, Smartphone, Share, MoreVertical } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { useWallet } from "@/lib/wallet-context";
import logoImage from "@assets/generated_images/blue_shield_a_crypto_icon.png";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setAuthenticatedUser, user, isLoading } = useWallet();
  
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);

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

  // Redirect to wallet if user is already authenticated (from localStorage)
  useEffect(() => {
    // Check if there's a stored userId in localStorage
    const storedUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    
    if (storedUserId) {
      // User ID exists in localStorage - wait for user to load
      if (!isLoading && user) {
        // User is loaded and authenticated - redirect to wallet
        setLocation("/wallet");
      }
      // If still loading, wait for the next render when user loads
    }
    // If no stored userId, user needs to import/create wallet - show landing page
  }, [user, isLoading, setLocation]);

  // Redirect to wallet once user is loaded after import
  useEffect(() => {
    if (pendingRedirect && !isLoading && user) {
      setPendingRedirect(false);
      if (isMobile) {
        setShowMobileModal(true);
      } else {
        setLocation("/wallet");
      }
    }
  }, [user, isLoading, pendingRedirect, isMobile, setLocation]);

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

  const handleImportSubmit = async () => {
    if (!seedPhrase.trim()) {
      toast({ title: "Error", description: "Please enter your seed phrase", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/import-wallet", { 
        seedPhrase: seedPhrase.trim() 
      });
      const data = await response.json();
      
      if (data.success) {
        setAuthenticatedUser(data.userId);
        toast({ title: "Wallet Imported", description: "Successfully imported your wallet" });
        setIsImportOpen(false);
        setPendingRedirect(true);
        // Navigation will happen via useEffect when user is loaded
      } else {
        toast({ title: "Import Failed", description: data.error || "Invalid seed phrase", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Import Failed", description: error.message || "Invalid seed phrase", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
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
          </div>
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
                setLocation("/wallet");
              }} 
              className="flex-1 rounded-xl"
            >
              Skip for now
            </Button>
            <Button 
              onClick={() => {
                setShowMobileModal(false);
                setLocation("/wallet");
              }}
              className="flex-1 rounded-xl"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
