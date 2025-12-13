import { ArrowUpRight, ArrowDownLeft, CreditCard, RefreshCw, Copy, Check, Info, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet-context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from "qrcode.react";

export function WalletOverview() {
  const { user, swapAssets, isLoading } = useWallet();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  // Swap Modal State - all hooks must be at the top
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const [isContactSupportOpen, setIsContactSupportOpen] = useState(false);
  const [isSwapProcessing, setIsSwapProcessing] = useState(false);
  const [swapFrom, setSwapFrom] = useState("BTC");
  const [swapTo, setSwapTo] = useState("AMC");
  const [swapAmount, setSwapAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapProgress, setSwapProgress] = useState(0);
  
  // Send Modal State
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isSendingOpen, setIsSendingOpen] = useState(false);
  const [isSuspiciousOpen, setIsSuspiciousOpen] = useState(false);
  const [sendToken, setSendToken] = useState("BTC");
  const [sendAmount, setSendAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [sendAttempts, setSendAttempts] = useState(0);
  
  // Receive Modal State
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receiveToken, setReceiveToken] = useState("");
  
  // Asset Detail Modal State
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isAssetDetailOpen, setIsAssetDetailOpen] = useState(false);

  // Show loading state
  if (isLoading || !user) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-primary to-blue-600 text-white border-none shadow-xl">
          <CardContent className="p-6 md:p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-white/20 rounded w-32 mb-4"></div>
              <div className="h-12 bg-white/20 rounded w-48"></div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <div className="h-20 bg-muted/50 rounded animate-pulse"></div>
          <div className="h-20 bg-muted/50 rounded animate-pulse"></div>
          <div className="h-20 bg-muted/50 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(user.walletAddress);
    setCopied(true);
    toast({ title: "Address copied", description: "Wallet address copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSwapClick = () => {
    setIsSwapOpen(true);
  };

  const handleSendClick = () => {
    if (sendAttempts >= 3) {
      setIsSuspiciousOpen(true);
      return;
    }
    setIsSendOpen(true);
  };

  const handleSendSubmit = () => {
    if (!sendAmount || !recipientAddress) return;
    
    setIsSendOpen(false);
    setIsSendingOpen(true);
    
    const randomDelay = Math.floor(Math.random() * 15000) + 5000;
    
    setTimeout(() => {
      setIsSendingOpen(false);
      const newAttempts = sendAttempts + 1;
      setSendAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setIsSuspiciousOpen(true);
      } else {
        toast({ 
          title: "Transaction Failed", 
          description: "Network error. Please try again.", 
          variant: "destructive" 
        });
      }
      
      setSendAmount("");
      setRecipientAddress("");
    }, randomDelay);
  };

  const handleReceiveClick = () => {
    setIsReceiveOpen(true);
  };

  const handleSwapSubmit = async () => {
    // Check constraints
    if (swapFrom === "AMC" && swapTo === "BTC") {
      setIsSwapOpen(false);
      setIsContactSupportOpen(true);
      return;
    }
    
    // BTC -> AMC: OK
    // AMC -> BTC: Contact Support
    if (swapFrom === "AMC" && swapTo !== "AMC") {
       setIsSwapOpen(false);
       setIsContactSupportOpen(true);
       return;
    }

    // Close swap dialog and show processing
    setIsSwapOpen(false);
    setIsSwapProcessing(true);
    setSwapProgress(0);
    
    // Random delay between 3-8 seconds for realistic feel
    const totalDelay = Math.floor(Math.random() * 5000) + 3000;
    const progressInterval = setInterval(() => {
      setSwapProgress(prev => Math.min(prev + Math.random() * 15, 95));
    }, 300);

    setTimeout(async () => {
      clearInterval(progressInterval);
      setSwapProgress(100);
      
      try {
        await swapAssets(swapFrom, swapTo, parseFloat(swapAmount));
        setTimeout(() => {
          setIsSwapProcessing(false);
          toast({ title: "Swap Successful", description: `Swapped ${swapAmount} ${swapFrom} to ${swapTo}` });
          setSwapAmount("");
          setSwapProgress(0);
        }, 500);
      } catch (error) {
        setIsSwapProcessing(false);
        toast({ title: "Swap Failed", description: (error as Error).message, variant: "destructive" });
        setSwapProgress(0);
      }
    }, totalDelay);
  };

  // Helper to visually truncate address
  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <Card className="bg-gradient-to-br from-primary to-blue-600 text-white border-none shadow-xl overflow-hidden relative w-full">
        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <CardContent className="p-4 md:p-8 relative z-10">
          <div className="flex justify-between items-start mb-6 gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-blue-100 text-sm font-medium mb-1">Total Balance</p>
              <h2 className="text-2xl sm:text-4xl font-display font-bold truncate">
                ${user.totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            <div 
              className="flex items-center gap-1 bg-white/10 px-2 py-1.5 rounded-full cursor-pointer hover:bg-white/20 transition-colors flex-shrink-0"
              onClick={copyAddress}
            >
              <span className="text-xs font-mono text-blue-50">{formatAddress(user.walletAddress)}</span>
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} className="text-blue-200" />}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 sm:gap-4 mt-6">
            <ActionButton icon={ArrowUpRight} label="Send" onClick={handleSendClick} data-testid="button-send" />
            <ActionButton icon={ArrowDownLeft} label="Receive" onClick={handleReceiveClick} data-testid="button-receive" />
            <ActionButton icon={CreditCard} label="Buy" data-testid="button-buy" />
            <ActionButton icon={RefreshCw} label="Swap" onClick={handleSwapClick} data-testid="button-swap" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 w-full">
        <h3 className="text-lg font-semibold px-1">Assets</h3>
        {user.assets.map((asset) => (
          <Card 
            key={asset.symbol} 
            className="hover:shadow-md transition-shadow cursor-pointer border-none bg-card/50 backdrop-blur-sm w-full overflow-hidden"
            onClick={() => {
              setSelectedAsset(asset);
              setIsAssetDetailOpen(true);
            }}
            data-testid={`card-asset-${asset.symbol.toLowerCase()}`}
          >
            <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm text-lg font-bold text-primary border border-border flex-shrink-0">
                  {asset.symbol[0]}
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold truncate">{asset.name}</h4>
                  <p className="text-sm text-muted-foreground">{asset.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm sm:text-base">{asset.balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 })} {asset.symbol}</p>
                <p className={`text-sm ${asset.change24h >= 0 ? 'text-accent' : 'text-red-500'}`}>
                  {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Swap Dialog */}
      <Dialog open={isSwapOpen} onOpenChange={setIsSwapOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg">Swap Assets</DialogTitle>
            <DialogDescription className="text-sm">Exchange tokens instantly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-2">
                 <Label className="text-sm">From</Label>
                 <Select value={swapFrom} onValueChange={setSwapFrom}>
                   <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="BTC">Bitcoin</SelectItem>
                     <SelectItem value="ETH">Ethereum</SelectItem>
                     <SelectItem value="AMC">American Coin</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label className="text-sm">To</Label>
                 <Select value={swapTo} onValueChange={setSwapTo}>
                   <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="BTC">Bitcoin</SelectItem>
                     <SelectItem value="ETH">Ethereum</SelectItem>
                     <SelectItem value="AMC">American Coin</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
            </div>
            <div className="space-y-2">
               <Label className="text-sm">Amount</Label>
               <Input 
                 type="number" 
                 placeholder="0.00" 
                 value={swapAmount} 
                 onChange={(e) => setSwapAmount(e.target.value)}
                 className="rounded-xl"
               />
               <p className="text-xs text-muted-foreground text-right">
                 Balance: {user.assets.find(a => a.symbol === swapFrom)?.balance} {swapFrom}
               </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsSwapOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button onClick={handleSwapSubmit} disabled={isSwapping || !swapAmount} className="flex-1 rounded-xl">
              {isSwapping ? "Swapping..." : "Swap Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Processing Dialog */}
      <Dialog open={isSwapProcessing} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="relative">
              <RefreshCw className="h-10 w-10 animate-spin text-primary" />
            </div>
            <DialogTitle className="text-lg text-center">Processing Swap...</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Exchanging {swapAmount} {swapFrom} to {swapTo}
            </DialogDescription>
            <div className="w-full space-y-2">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300 ease-out" 
                  style={{ width: `${swapProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {swapProgress < 30 ? "Verifying balances..." : 
                 swapProgress < 60 ? "Calculating exchange rate..." : 
                 swapProgress < 90 ? "Executing swap..." : "Finalizing..."}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Support Dialog */}
      <Dialog open={isContactSupportOpen} onOpenChange={setIsContactSupportOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
           <DialogHeader className="text-center">
             <div className="flex items-center justify-center gap-2 text-warning mb-2">
               <Info className="h-5 w-5" />
               <DialogTitle className="text-lg">Action Restricted</DialogTitle>
             </div>
             <DialogDescription className="text-sm">
               To swap {swapFrom} back to {swapTo}, please contact our customer support team for verification.
             </DialogDescription>
           </DialogHeader>
           <div className="py-3">
             <Button className="w-full rounded-xl" onClick={() => {
               toast({ title: "Support Ticket Created", description: "Our team will contact you shortly." });
               setIsContactSupportOpen(false);
             }}>
               Contact Support
             </Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg">Send Crypto</DialogTitle>
            <DialogDescription className="text-sm">Enter recipient address and select token.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-2">
              <Label className="text-sm">Token</Label>
              <Select value={sendToken} onValueChange={setSendToken}>
                <SelectTrigger data-testid="select-send-token" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {user.assets.map(asset => (
                    <SelectItem key={asset.symbol} value={asset.symbol}>{asset.name} ({asset.symbol})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Amount</Label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={sendAmount} 
                onChange={(e) => setSendAmount(e.target.value)}
                data-testid="input-send-amount"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground text-right">
                Balance: {user.assets.find(a => a.symbol === sendToken)?.balance || 0} {sendToken}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Recipient Address</Label>
              <Input 
                placeholder="0x..."
                className="rounded-xl" 
                value={recipientAddress} 
                onChange={(e) => setRecipientAddress(e.target.value)}
                data-testid="input-recipient-address"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsSendOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button onClick={handleSendSubmit} disabled={!sendAmount || !recipientAddress} data-testid="button-confirm-send" className="flex-1 rounded-xl">
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sending Progress Dialog */}
      <Dialog open={isSendingOpen} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <DialogTitle className="text-lg text-center">Sending {sendToken}...</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Please wait while your transaction is being processed.
            </DialogDescription>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspicious Activity Dialog */}
      <Dialog open={isSuspiciousOpen} onOpenChange={setIsSuspiciousOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <div className="flex items-center justify-center gap-2 text-red-500 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-lg text-red-500">Suspicious Activity</DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              Multiple failed transaction attempts detected. Sending has been temporarily disabled for your security.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Contact support to verify your identity and restore access.
            </p>
            <Button className="w-full rounded-xl" variant="destructive" onClick={() => {
              toast({ title: "Support Notified", description: "A security specialist will contact you within 24 hours." });
              setIsSuspiciousOpen(false);
            }}>
              Contact Security Team
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={isReceiveOpen} onOpenChange={(open) => {
        setIsReceiveOpen(open);
        if (!open) setReceiveToken("");
      }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg">Receive Crypto</DialogTitle>
            <DialogDescription className="text-sm">
              {receiveToken ? `Share your ${receiveToken} address.` : "Select which crypto to receive."}
            </DialogDescription>
          </DialogHeader>
          
          {!receiveToken ? (
            <div className="py-3 space-y-2">
              {user.assets.map((asset) => (
                <Button
                  key={asset.symbol}
                  variant="outline"
                  className="w-full h-14 flex items-center justify-start gap-3 px-4 rounded-xl"
                  onClick={() => setReceiveToken(asset.symbol)}
                  data-testid={`button-receive-${asset.symbol.toLowerCase()}`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary text-sm">{asset.symbol.charAt(0)}</span>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{asset.name}</div>
                    <div className="text-xs text-muted-foreground">{asset.symbol}</div>
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 space-y-4">
              <div className="bg-white p-3 rounded-xl shadow-sm">
                <QRCodeSVG 
                  value={receiveToken === "BTC" 
                    ? `bc1q${user.walletAddress.slice(2, 34).toLowerCase()}` 
                    : user.walletAddress
                  } 
                  size={160}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="w-full">
                <Label className="text-xs text-muted-foreground">Your {receiveToken} Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input 
                    readOnly
                    className="rounded-xl font-mono text-xs" 
                    value={receiveToken === "BTC" 
                      ? `bc1q${user.walletAddress.slice(2, 34).toLowerCase()}` 
                      : user.walletAddress
                    } 
                    data-testid="text-wallet-address"
                  />
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="rounded-xl flex-shrink-0"
                    onClick={() => {
                      const address = receiveToken === "BTC" 
                        ? `bc1q${user.walletAddress.slice(2, 34).toLowerCase()}` 
                        : user.walletAddress;
                      navigator.clipboard.writeText(address);
                      toast({ title: "Copied!", description: `${receiveToken} address copied to clipboard` });
                    }}
                    data-testid="button-copy-address"
                  >
                    <Copy size={16} />
                  </Button>
                </div>
              </div>
              <Button variant="ghost" onClick={() => setReceiveToken("")} className="text-xs">
                ← Select Different Token
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Asset Detail Dialog */}
      <Dialog open={isAssetDetailOpen} onOpenChange={setIsAssetDetailOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto rounded-2xl">
          {selectedAsset && (
            <>
              <DialogHeader className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary border-2 border-primary/20">
                    {selectedAsset.symbol[0]}
                  </div>
                </div>
                <DialogTitle className="text-xl">{selectedAsset.name}</DialogTitle>
                <DialogDescription className="text-sm">{selectedAsset.symbol}</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <span className="font-bold">
                      {selectedAsset.balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })} {selectedAsset.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Value</span>
                    <span className="font-semibold">
                      ${(selectedAsset.balance * selectedAsset.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Price</span>
                    <span className="text-sm">
                      {selectedAsset.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">24h Change</span>
                    <span className={`text-sm font-medium ${selectedAsset.change24h >= 0 ? 'text-accent' : 'text-red-500'}`}>
                      {selectedAsset.change24h > 0 ? '+' : ''}{selectedAsset.change24h}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="rounded-xl"
                    onClick={() => {
                      setIsAssetDetailOpen(false);
                      setSendToken(selectedAsset.symbol);
                      handleSendClick();
                    }}
                    data-testid="button-send-from-detail"
                  >
                    <ArrowUpRight size={16} className="mr-2" />
                    Send
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-xl"
                    onClick={() => {
                      setIsAssetDetailOpen(false);
                      setReceiveToken(selectedAsset.symbol);
                      setIsReceiveOpen(true);
                    }}
                    data-testid="button-receive-from-detail"
                  >
                    <ArrowDownLeft size={16} className="mr-2" />
                    Receive
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, "data-testid": testId }: { icon: any, label: string, onClick?: () => void, "data-testid"?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={onClick} data-testid={testId}>
      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md group-hover:bg-white/30 transition-all group-hover:scale-110">
        <Icon className="text-white" size={24} />
      </div>
      <span className="text-xs md:text-sm font-medium text-blue-50">{label}</span>
    </div>
  );
}
