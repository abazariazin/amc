import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useWallet } from "@/lib/wallet-context";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Search, UserPlus, Users, ArrowRightLeft, LogOut, DollarSign, RefreshCw, Wallet, Sparkles, Banknote, Bitcoin, Eye, Edit, X, Save, Copy, Mail, Settings, Send, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Buffer } from "buffer";
import * as bip39 from "bip39";
import type { User, Transaction } from "@/lib/api";

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}

const txSchema = z.object({
  type: z.enum(["send", "receive", "buy", "swap"]),
  amount: z.string().min(1, "Amount is required"),
  currency: z.string().min(1, "Currency is required"),
  from: z.string().optional(),
  to: z.string().optional(),
});

const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  walletAddress: z.string().min(10, "Invalid wallet address"),
  btcAddress: z.string().optional(),
  seedPhrase: z.string().min(20, "Seed phrase is required"),
  initialBalances: z.object({
    AMC: z.string().optional(),
    BTC: z.string().optional(),
    ETH: z.string().optional(),
  }).optional(),
});

const fundingSchema = z.object({
  userId: z.string().min(1, "User is required"),
  currency: z.string().min(1, "Token is required"),
  amount: z.string().min(1, "Amount is required"),
});

function generateSeedPhrase(): string {
  return bip39.generateMnemonic(128);
}

function generateWalletAddress(): string {
  return "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}

function generateBtcAddress(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  return "bc1q" + Array(38).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join("");
}

interface TokenConfig {
  symbol: string;
  displayName: string;
  currentPrice: string;
  basePrice: string;
  lastUpdatedAt: string;
  autoMode: string;
  changeRate: string;
  changeIntervalMinutes: number;
  cycleDirection: string;
  cycleIncreaseCount?: number; // How many increases before one decrease
  cycleCurrentCount?: number; // Current counter for cycle
}

export default function AdminPage() {
  const { transactions, addTransaction, users, addUser, isAdminLoggedIn, logoutAdmin, isLoading } = useWallet();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  
  // User detail modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editWalletAddress, setEditWalletAddress] = useState("");
  const [editBtcAddress, setEditBtcAddress] = useState("");
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        const data = await res.json();
        setAuthChecked(true);
        if (!data.isAdmin) {
          setLocation("/admin-login");
        }
      } catch {
        setAuthChecked(true);
        setLocation("/admin-login");
      }
    };
    checkAuth();
  }, [setLocation]);

  // Token configs state
  const { data: tokenConfigs, isLoading: loadingConfigs } = useQuery<TokenConfig[]>({
    queryKey: ["tokenConfigs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/token-configs");
      if (!res.ok) throw new Error("Failed to fetch token configs");
      return res.json();
    },
    enabled: isAdminLoggedIn && authChecked,
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ symbol, updates }: { symbol: string; updates: Partial<TokenConfig> }) => {
      const res = await fetch(`/api/admin/token-configs/${symbol}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokenConfigs"] });
      toast({ title: "Success", description: "Token configuration updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Redirect if not logged in (after auth check completes)
  useEffect(() => {
    if (authChecked && !isAdminLoggedIn) {
      setLocation("/admin-login");
    }
  }, [isAdminLoggedIn, authChecked, setLocation]);

  const txForm = useForm<z.infer<typeof txSchema>>({
    resolver: zodResolver(txSchema),
    defaultValues: { type: "receive", amount: "", currency: "AMC", from: "", to: "" },
  });

  const userForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { 
      name: "", 
      walletAddress: "", 
      btcAddress: "",
      seedPhrase: "",
      initialBalances: { AMC: "0", BTC: "0", ETH: "0" }
    },
  });

  const fundingForm = useForm<z.infer<typeof fundingSchema>>({
    resolver: zodResolver(fundingSchema),
    defaultValues: { userId: "", currency: "AMC", amount: "" },
  });

  const fundUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof fundingSchema>) => {
      const res = await fetch("/api/admin/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fund user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Success", description: "User funded successfully" });
      fundingForm.reset({ userId: "", currency: "AMC", amount: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; walletAddress?: string; btcAddress?: string | null } }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(updatedUser);
      setIsEditing(false);
      toast({ title: "Success", description: "User updated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (selectedUser) {
        closeUserDetail();
      }
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openUserDetail = async (user: User) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditWalletAddress(user.walletAddress);
    setEditBtcAddress(user.btcAddress || "");
    setIsEditing(false);
    
    // Fetch user's transactions
    try {
      const res = await fetch(`/api/users/${user.id}/transactions`);
      if (res.ok) {
        const txs = await res.json();
        setUserTransactions(txs);
      }
    } catch (error) {
      console.error("Failed to fetch user transactions:", error);
    }
  };

  const closeUserDetail = () => {
    setSelectedUser(null);
    setIsEditing(false);
    setUserTransactions([]);
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    updateUserMutation.mutate({
      id: selectedUser.id,
      updates: {
        name: editName,
        walletAddress: editWalletAddress,
        btcAddress: editBtcAddress || null,
      },
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  function onTxSubmit(values: z.infer<typeof txSchema>) {
    addTransaction({
      type: values.type,
      amount: values.amount,
      currency: values.currency,
      from: values.from || "Admin",
      to: values.to || "User",
    });
    toast({ title: "Transaction Created", description: `Successfully created ${values.type} transaction` });
    txForm.reset();
  }

  function onUserSubmit(values: z.infer<typeof userSchema>) {
    addUser(values);
    toast({ title: "User Created", description: `Successfully added ${values.name}. Confirmation email sent to ${values.email}` });
    userForm.reset();
  }

  const handleLogout = () => {
    logoutAdmin();
    setLocation("/admin-login");
  };

  const filteredTransactions = transactions.filter(tx => 
    tx.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tx.currency.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.hash.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show loading or redirect if not authenticated
  if (!authChecked || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdminLoggedIn) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage system users and transactions</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex gap-2">
            <LogOut size={16} />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="funding" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-5 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="funding" className="flex items-center justify-center gap-1 md:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Banknote size={18} className="md:w-4 md:h-4"/>
              <span className="hidden md:inline">Funding</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center justify-center gap-1 md:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users size={18} className="md:w-4 md:h-4"/>
              <span className="hidden md:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center justify-center gap-1 md:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ArrowRightLeft size={18} className="md:w-4 md:h-4"/>
              <span className="hidden md:inline">Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center justify-center gap-1 md:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <DollarSign size={18} className="md:w-4 md:h-4"/>
              <span className="hidden md:inline">Pricing</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center justify-center gap-1 md:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Mail size={18} className="md:w-4 md:h-4"/>
              <span className="hidden md:inline">Email</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Create Transaction Form */}
              <Card className="lg:col-span-1 h-fit border-border/50 shadow-md">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PlusCircle className="text-primary" size={20} />
                    Create Transaction
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <Form {...txForm}>
                    <form onSubmit={txForm.handleSubmit(onTxSubmit)} className="space-y-4">
                      <FormField
                        control={txForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="receive">Receive (Credit)</SelectItem>
                                <SelectItem value="send">Send (Debit)</SelectItem>
                                <SelectItem value="buy">Buy</SelectItem>
                                <SelectItem value="swap">Swap</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={txForm.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount</FormLabel>
                              <FormControl><Input type="number" step="any" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={txForm.control}
                          name="currency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Currency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="AMC">AMC</SelectItem>
                                  <SelectItem value="BTC">BTC</SelectItem>
                                  <SelectItem value="ETH">ETH</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField control={txForm.control} name="from" render={({ field }) => (
                        <FormItem><FormLabel>From</FormLabel><FormControl><Input placeholder="0x..." {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={txForm.control} name="to" render={({ field }) => (
                        <FormItem><FormLabel>To</FormLabel><FormControl><Input placeholder="0x..." {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" className="w-full">Create Transaction</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Transaction List */}
              <Card className="lg:col-span-2 border-border/50 shadow-md flex flex-col overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/10">
                  <div className="space-y-1">
                     <CardTitle>Transaction History</CardTitle>
                     <CardDescription>Global ledger of all movements</CardDescription>
                  </div>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search hash or ID..."
                      className="pl-8 bg-background"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-auto max-h-[600px]">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((tx) => (
                          <TableRow key={tx.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{tx.id}</TableCell>
                            <TableCell className="capitalize">{tx.type}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{tx.amount} {tx.currency}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                tx.status === 'completed' ? 'bg-accent/10 text-accent' : 
                                tx.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                              }`}>
                                {tx.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="funding" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Fund User Form */}
              <Card className="h-fit border-border/50 shadow-md">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Banknote className="text-primary" size={20} />
                    Fund User Account
                  </CardTitle>
                  <CardDescription>Add tokens to a user's wallet balance</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <Form {...fundingForm}>
                    <form onSubmit={fundingForm.handleSubmit((data) => fundUserMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={fundingForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select User</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Choose a user..." /></SelectTrigger></FormControl>
                              <SelectContent>
                                {users.map(user => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name} - {user.walletAddress.slice(0, 10)}...
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={fundingForm.control}
                          name="currency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Token</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="AMC">American Coin (AMC)</SelectItem>
                                  <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                                  <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={fundingForm.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount</FormLabel>
                              <FormControl><Input type="number" step="any" placeholder="0.00" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={fundUserMutation.isPending}>
                        {fundUserMutation.isPending ? "Processing..." : "Fund User"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Recent Funding Activity */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle>Recent Funding Activity</CardTitle>
                  <CardDescription>Latest receive transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Amount</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.filter(tx => tx.type === "receive").slice(0, 10).map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-medium">{tx.amount} {tx.currency}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{tx.to?.slice(0, 12)}...</TableCell>
                            <TableCell className="text-right text-xs">{new Date(tx.date).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Create User Form */}
              <Card className="lg:col-span-1 h-fit border-border/50 shadow-md">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserPlus className="text-primary" size={20} />
                    Add New User
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <Form {...userForm}>
                    <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
                      <FormField
                        control={userForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={userForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={userForm.control}
                        name="walletAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ETH Wallet Address</FormLabel>
                            <div className="flex gap-2">
                              <FormControl><Input placeholder="0x..." {...field} className="font-mono text-xs" /></FormControl>
                              <Button type="button" variant="outline" size="icon" onClick={() => userForm.setValue("walletAddress", generateWalletAddress())}>
                                <Sparkles size={16} />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={userForm.control}
                        name="btcAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>BTC Wallet Address</FormLabel>
                            <div className="flex gap-2">
                              <FormControl><Input placeholder="bc1q..." {...field} className="font-mono text-xs" /></FormControl>
                              <Button type="button" variant="outline" size="icon" onClick={() => userForm.setValue("btcAddress", generateBtcAddress())}>
                                <Bitcoin size={16} />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={userForm.control}
                        name="seedPhrase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seed Phrase (12 words)</FormLabel>
                            <div className="flex gap-2">
                              <FormControl><Input placeholder="word1 word2 word3..." {...field} className="font-mono text-xs" /></FormControl>
                              <Button type="button" variant="outline" size="icon" onClick={() => userForm.setValue("seedPhrase", generateSeedPhrase())}>
                                <Sparkles size={16} />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="border-t pt-4 mt-4">
                        <Label className="text-sm font-medium mb-3 block">Initial Token Balances</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <FormField
                            control={userForm.control}
                            name="initialBalances.AMC"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">AMC</FormLabel>
                                <FormControl><Input type="number" step="any" placeholder="0" {...field} className="text-xs" /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={userForm.control}
                            name="initialBalances.BTC"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">BTC</FormLabel>
                                <FormControl><Input type="number" step="any" placeholder="0" {...field} className="text-xs" /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={userForm.control}
                            name="initialBalances.ETH"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">ETH</FormLabel>
                                <FormControl><Input type="number" step="any" placeholder="0" {...field} className="text-xs" /></FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full">Create User</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Users List */}
              <Card className="lg:col-span-2 border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle>Registered Users</CardTitle>
                  <CardDescription>Manage user accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Wallet</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium whitespace-nowrap">{user.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{user.walletAddress.slice(0, 12)}...</TableCell>
                            <TableCell>${user.totalBalanceUSD.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openUserDetail(user)} data-testid={`button-view-user-${user.id}`}>
                                  <Eye size={16} className="mr-1" /> View
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                      <Trash2 size={16} />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone. All user data, transactions, and assets will be permanently deleted.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteUserMutation.mutate(user.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={deleteUserMutation.isPending}
                                      >
                                        {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-6">
            <Card className="border-border/50 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="text-primary" size={20} />
                  American Coin (AMC) Pricing Configuration
                </CardTitle>
                <CardDescription>
                  Configure AMC price and automatic price increase frequency. BTC and ETH prices are fetched from real-time market data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingConfigs ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="animate-spin mr-2" size={20} />
                    Loading configurations...
                  </div>
                ) : (
                  <div className="space-y-6">
                    {tokenConfigs?.filter(config => config.symbol === "AMC").map((config) => (
                      <TokenConfigCard 
                        key={config.symbol} 
                        config={config} 
                        onUpdate={(updates) => updateConfigMutation.mutate({ symbol: config.symbol, updates })}
                        isUpdating={updateConfigMutation.isPending}
                      />
                    ))}
                    {tokenConfigs?.filter(config => config.symbol !== "AMC").length > 0 && (
                      <Card className="bg-muted/30 border-dashed">
                        <CardContent className="pt-6">
                          <div className="text-center space-y-2">
                            <p className="text-sm font-medium">BTC & ETH Prices</p>
                            <p className="text-xs text-muted-foreground">
                              Bitcoin and Ethereum prices are automatically fetched from CoinGecko API in real-time.
                            </p>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                              {tokenConfigs?.filter(config => config.symbol !== "AMC").map((config) => (
                                <div key={config.symbol} className="text-center p-3 bg-background rounded-lg">
                                  <p className="text-xs text-muted-foreground">{config.displayName}</p>
                                  <p className="text-lg font-bold">${(parseFloat(config.currentPrice) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <EmailSettingsTab />
          </TabsContent>
        </Tabs>

        {/* User Detail Modal */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && closeUserDetail()}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{isEditing ? "Edit User" : "User Details"}</span>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 size={16} className="mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This action cannot be undone. All user data, transactions, and assets will be permanently deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={deleteUserMutation.isPending}
                            >
                              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-user">
                        <Edit size={16} className="mr-1" /> Edit
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                        <X size={16} className="mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveUser} disabled={updateUserMutation.isPending} data-testid="button-save-user">
                        <Save size={16} className="mr-1" /> Save
                      </Button>
                    </>
                  )}
                </div>
              </DialogTitle>
              <DialogDescription>
                {isEditing ? "Update user information" : "View user details and transaction history"}
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-6 py-4">
                {/* User Info Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Account Information</h3>
                  
                  <div className="grid gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Name</Label>
                      {isEditing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" data-testid="input-edit-name" />
                      ) : (
                        <p className="font-medium">{selectedUser.name}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground">ETH Wallet Address</Label>
                      {isEditing ? (
                        <div className="flex gap-2 mt-1">
                          <Input value={editWalletAddress} onChange={(e) => setEditWalletAddress(e.target.value)} className="font-mono text-xs" data-testid="input-edit-wallet" />
                          <Button type="button" variant="outline" size="icon" onClick={() => setEditWalletAddress(generateWalletAddress())}>
                            <Sparkles size={16} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm break-all">{selectedUser.walletAddress}</p>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedUser.walletAddress, "ETH Address")}>
                            <Copy size={14} />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground">BTC Wallet Address</Label>
                      {isEditing ? (
                        <div className="flex gap-2 mt-1">
                          <Input value={editBtcAddress} onChange={(e) => setEditBtcAddress(e.target.value)} className="font-mono text-xs" data-testid="input-edit-btc" />
                          <Button type="button" variant="outline" size="icon" onClick={() => setEditBtcAddress(generateBtcAddress())}>
                            <Bitcoin size={16} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm break-all">{selectedUser.btcAddress || "Not set"}</p>
                          {selectedUser.btcAddress && (
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedUser.btcAddress!, "BTC Address")}>
                              <Copy size={14} />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground">XD Seed Phrase</Label>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs bg-muted p-2 rounded break-all">{selectedUser.seedPhrase}</p>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedUser.seedPhrase, "XD Seed Phrase")}>
                          <Copy size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balances Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Token Balances</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selectedUser.assets?.map((asset) => (
                      <Card key={asset.symbol} className="p-3">
                        <p className="text-sm text-muted-foreground">{asset.symbol}</p>
                        <p className="text-lg font-bold">{parseFloat(asset.balance).toLocaleString()}</p>
                      </Card>
                    ))}
                  </div>
                  <p className="text-right text-sm text-muted-foreground">
                    Total: <span className="font-semibold text-foreground">${selectedUser.totalBalanceUSD.toLocaleString()}</span>
                  </p>
                </div>

                {/* Transactions Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Transaction History ({userTransactions.length})</h3>
                  {userTransactions.length > 0 ? (
                    <div className="max-h-[200px] overflow-y-auto overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userTransactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="capitalize">{tx.type}</TableCell>
                              <TableCell>{tx.amount} {tx.currency}</TableCell>
                              <TableCell>{new Date(tx.date).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No transactions yet</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function TokenConfigCard({ 
  config, 
  onUpdate, 
  isUpdating 
}: { 
  config: TokenConfig; 
  onUpdate: (updates: Partial<TokenConfig>) => void;
  isUpdating: boolean;
}) {
  const [currentPrice, setCurrentPrice] = useState(config.currentPrice);
  const [basePrice, setBasePrice] = useState(config.basePrice);
  const [autoMode, setAutoMode] = useState(config.autoMode);
  const [changeRate, setChangeRate] = useState(config.changeRate);
  const [changeInterval, setChangeInterval] = useState(config.changeIntervalMinutes.toString());
  const [cycleIncreaseCount, setCycleIncreaseCount] = useState((config.cycleIncreaseCount || 3).toString());

  const handleSave = () => {
    onUpdate({
      currentPrice,
      basePrice,
      autoMode: autoMode as any,
      changeRate,
      changeIntervalMinutes: parseInt(changeInterval) || 60,
      cycleIncreaseCount: parseInt(cycleIncreaseCount) || 3,
    });
  };

  return (
    <Card className="bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{config.displayName} ({config.symbol})</span>
          <span className="text-primary font-mono">${(parseFloat(config.currentPrice) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Current Price ($)</Label>
            <Input 
              type="number" 
              step="any"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Base Price ($)</Label>
            <Input 
              type="number" 
              step="any"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Price Change Mode</Label>
            <Select value={autoMode} onValueChange={setAutoMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Manual (No Auto)</SelectItem>
                <SelectItem value="increase">Auto Increase</SelectItem>
                <SelectItem value="decrease">Auto Decrease</SelectItem>
                <SelectItem value="cycle">Cycle (Up & Down)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Increase Rate (%)</Label>
            <Input 
              type="number" 
              step="0.01"
              value={changeRate}
              onChange={(e) => setChangeRate(e.target.value)}
              className="font-mono"
              disabled={autoMode === "none"}
              placeholder="0.5"
            />
            <p className="text-xs text-muted-foreground">Per interval</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Update Frequency (minutes)</Label>
            <Input 
              type="number"
              value={changeInterval}
              onChange={(e) => setChangeInterval(e.target.value)}
              className="font-mono"
              disabled={autoMode === "none"}
              placeholder="60"
            />
            <p className="text-xs text-muted-foreground">
              How often price updates
            </p>
          </div>
          {autoMode === "cycle" && (
            <div className="space-y-2">
              <Label className="text-sm">Cycle Ratio (Increases:Decrease)</Label>
              <Input 
                type="number"
                value={cycleIncreaseCount}
                onChange={(e) => setCycleIncreaseCount(e.target.value)}
                className="font-mono"
                min="1"
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">
                Increase {cycleIncreaseCount || 3}x, then decrease 1x
              </p>
            </div>
          )}
          <div className="space-y-2 flex items-end">
            <Button 
              onClick={handleSave} 
              disabled={isUpdating}
              className="w-full"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
        
        {autoMode !== "none" && (
          <div className="bg-primary/10 rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Auto Price Update Active</p>
            <p className="text-muted-foreground text-xs">
              {autoMode === "increase" && `Price will increase by ${changeRate}% every ${changeInterval} minutes`}
              {autoMode === "decrease" && `Price will decrease by ${changeRate}% every ${changeInterval} minutes`}
              {autoMode === "cycle" && `Price will increase ${cycleIncreaseCount || 3} times by ${changeRate}% each, then decrease once by ${changeRate}%, every ${changeInterval} minutes`}
            </p>
            {autoMode === "cycle" && config.cycleCurrentCount !== undefined && (
              <p className="text-muted-foreground text-xs mt-1">
                Current cycle: {config.cycleCurrentCount}/{cycleIncreaseCount || 3} increases completed
              </p>
            )}
          </div>
        )}
        
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Last updated: {new Date(config.lastUpdatedAt).toLocaleString()}
          {autoMode === "cycle" && (
            <span className="ml-4">
              Current direction: <span className="font-medium capitalize">{config.cycleDirection}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmailSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdminLoggedIn } = useWallet();
  
  // Email config state
  const { data: emailConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ["emailConfig"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email-config");
      if (!res.ok) throw new Error("Failed to fetch email config");
      return res.json();
    },
  });

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("American Coin");
  const [appUrl, setAppUrl] = useState("https://americancoin.app");
  const [testingConnection, setTestingConnection] = useState(false);

  // Email template state
  const { data: templates, isLoading: loadingTemplates, refetch: refetchTemplates } = useQuery({
    queryKey: ["emailTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email-templates");
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to fetch email templates" }));
        throw new Error(error.error || "Failed to fetch email templates");
      }
      const data = await res.json();
      console.log("Fetched email templates:", data);
      return Array.isArray(data) ? data : [];
    },
    enabled: isAdminLoggedIn,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (emailConfig && emailConfig.host) {
      setSmtpHost(emailConfig.host || "");
      setSmtpPort(emailConfig.port?.toString() || "587");
      setSmtpSecure(emailConfig.secure || false);
      setSmtpUser(emailConfig.authUser || "");
      setSmtpPass(""); // Don't populate password - user needs to re-enter if changing
      setFromEmail(emailConfig.fromEmail || "");
      setFromName(emailConfig.fromName || "American Coin");
      setAppUrl(emailConfig.appUrl || "https://americancoin.app");
    } else {
      // Reset to defaults if no config
      setSmtpHost("");
      setSmtpPort("587");
      setSmtpSecure(false);
      setSmtpUser("");
      setSmtpPass("");
      setFromEmail("");
      setFromName("American Coin");
      setAppUrl("https://americancoin.app");
    }
  }, [emailConfig]);

  // Auto-select first template when templates load
  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0].name);
    }
  }, [templates]);

  // Load template content when selected
  useEffect(() => {
    if (selectedTemplate && templates && templates.length > 0) {
      const template = templates.find((t: any) => t.name === selectedTemplate);
      if (template) {
        setTemplateSubject(template.subject);
        setTemplateBody(template.htmlBody);
      }
    }
  }, [selectedTemplate, templates]);

  const saveEmailConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const res = await fetch("/api/admin/email-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save email config");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailConfig"] });
      toast({ title: "Success", description: "Email configuration saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async ({ name, template }: { name: string; template: any }) => {
      const res = await fetch(`/api/admin/email-templates/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
      toast({ title: "Success", description: "Email template saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveConfig = () => {
    if (!smtpHost || !smtpPort || !smtpUser || !fromEmail) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    // Password is only required when creating new config
    if (!emailConfig && !smtpPass) {
      toast({ title: "Error", description: "Password is required when creating new email configuration", variant: "destructive" });
      return;
    }
    
    // IMPORTANT: Always send password if provided, even if updating existing config
    // If password field is empty, send empty string (backend will use existing password)
    // If password field has value, send it (will update password)
    const configToSave: any = {
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure,
      authUser: smtpUser,
      fromEmail,
      fromName,
      appUrl: appUrl || "https://americancoin.app",
    };
    
    // Only include password if it was provided (not empty)
    // If updating and password is empty, backend will use existing password
    if (smtpPass && smtpPass.trim() !== "") {
      configToSave.authPass = smtpPass;
    } else if (!emailConfig) {
      // Creating new config - password is required
      toast({ title: "Error", description: "Password is required when creating new email configuration", variant: "destructive" });
      return;
    }
    // If updating and password is empty, don't send authPass - backend will use existing
    
    console.log("[FRONTEND] Saving SMTP config:", {
      ...configToSave,
      authPass: configToSave.authPass ? "***PROVIDED***" : "NOT_PROVIDED (will use existing)",
    });
    
    saveEmailConfigMutation.mutate(configToSave);
  };

  const handleSaveTemplate = () => {
    if (!selectedTemplate || !templateSubject || !templateBody) {
      toast({ title: "Error", description: "Please fill in all template fields", variant: "destructive" });
      return;
    }
    saveTemplateMutation.mutate({
      name: selectedTemplate,
      template: {
        subject: templateSubject,
        htmlBody: templateBody,
      },
    });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* SMTP Configuration */}
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="text-primary" size={20} />
            SMTP Configuration
          </CardTitle>
          <CardDescription>
            Configure your email server settings
            {emailConfig && emailConfig.host && (
              <span className="ml-2 text-green-600 dark:text-green-400">• Configured</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailConfig && emailConfig.host && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                ✓ SMTP Configuration Active
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Host: {emailConfig.host} | Port: {emailConfig.port} | From: {emailConfig.fromEmail}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>SMTP Username</Label>
            <Input
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="your-email@gmail.com"
            />
          </div>
          <div className="space-y-2">
            <Label>SMTP Password {!emailConfig && <span className="text-red-500">*</span>}</Label>
            <Input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={emailConfig && emailConfig.host ? "Leave blank to keep current password" : "Enter password (required)"}
            />
            {emailConfig && emailConfig.host && (
              <p className="text-xs text-muted-foreground">
                Leave blank to keep current password, or enter new password to update.
              </p>
            )}
            {!emailConfig && (
              <p className="text-xs text-muted-foreground">
                Password is required when creating new email configuration.
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="secure"
              checked={smtpSecure}
              onChange={(e) => setSmtpSecure(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="secure">Use SSL/TLS (secure)</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@americancoin.app"
              />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="American Coin"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>App URL</Label>
            <Input
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://americancoin.app"
            />
            <p className="text-xs text-muted-foreground">
              This URL will be used in email templates for links (e.g., "Access Your Wallet" button).
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveConfig}
              disabled={saveEmailConfigMutation.isPending}
              className="flex-1"
            >
              {saveEmailConfigMutation.isPending ? "Saving..." : "Save SMTP Configuration"}
            </Button>
            {emailConfig && emailConfig.host && (
              <Button
                onClick={async () => {
                  setTestingConnection(true);
                  try {
                    const res = await fetch("/api/admin/email-config/test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                    });
                    
                    if (!res.ok) {
                      const error = await res.json();
                      throw new Error(error.error || "Connection test failed");
                    }
                    
                    const data = await res.json();
                    toast({ title: "Success", description: data.message || "SMTP connection test successful!" });
                  } catch (error: any) {
                    toast({ title: "Connection Test Failed", description: error.message, variant: "destructive" });
                  } finally {
                    setTestingConnection(false);
                  }
                }}
                variant="outline"
                disabled={testingConnection || saveEmailConfigMutation.isPending}
                className="flex items-center gap-2"
              >
                {testingConnection ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    Testing...
                  </>
                ) : (
                  <>
                    <Settings size={16} />
                    Test Connection
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="text-primary" size={20} />
            Email Templates
          </CardTitle>
          <CardDescription>Edit email templates for account notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin mr-2" size={20} />
              Loading templates...
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select value={selectedTemplate || ""} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates && templates.length > 0 ? (
                    templates.map((template: any) => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>No templates available</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchTemplates()}
                  className="flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  Refresh
                </Button>
                {(!templates || templates.length < 2) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/admin/email-templates/initialize", {
                          method: "POST",
                        });
                        if (!res.ok) {
                          const error = await res.json();
                          throw new Error(error.error || "Failed to initialize templates");
                        }
                        toast({ title: "Success", description: "Templates initialized successfully" });
                        refetchTemplates();
                      } catch (error: any) {
                        toast({ title: "Error", description: error.message, variant: "destructive" });
                      }
                    }}
                  >
                    Initialize Templates
                  </Button>
                )}
              </div>
              {templates && templates.length === 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    No templates found. Create the default template to get started.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        // Use the default template HTML from email-service
                        const defaultTemplateHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px 12px 0 0;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px; color: #ffffff;">🛡️</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">American Coin</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Welcome, {{name}}!</h2>
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your American Coin wallet account has been successfully created. You can now securely manage your cryptocurrency portfolio.
              </p>
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: 600;">Account Details</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Name:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">{{name}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">{{email}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Wallet:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 12px; font-family: monospace; word-break: break-all;">{{walletAddress}}</td>
                  </tr>
                </table>
              </div>
              <div style="background-color: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px; color: #92400e; font-size: 16px; font-weight: 600;">⚠️ Your Seed Phrase</h3>
                <p style="margin: 0 0 15px; color: #78350f; font-size: 14px; line-height: 1.6;">
                  <strong>IMPORTANT:</strong> Save this seed phrase in a secure location. This is the only time it will be shown. If you lose it, you will not be able to recover your wallet.
                </p>
                <div style="background-color: #ffffff; border-radius: 6px; padding: 15px; border: 1px solid #fbbf24;">
                  <p style="margin: 0; color: #1f2937; font-size: 13px; font-family: monospace; line-height: 1.8; word-break: break-word;">{{seedPhrase}}</p>
                </div>
                <p style="margin: 15px 0 0; color: #78350f; font-size: 12px; line-height: 1.5;">
                  ⚠️ Never share your seed phrase with anyone. American Coin staff will never ask for your seed phrase.
                </p>
              </div>
              <p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your seed phrase is securely stored and encrypted. Please keep it safe and never share it with anyone.
              </p>
              <div style="text-align: center; margin: 40px 0 20px;">
                <a href="{{appUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Access Your Wallet</a>
              </div>
              <p style="margin: 30px 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center;">
                If you did not create this account, please contact support immediately.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                &copy; 2025 American Coin. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Secure Wallet v1.0 | Bank-Grade Security
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
                        const res = await fetch("/api/admin/email-templates/account_confirmation", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            subject: "Welcome to American Coin - Your Account Has Been Created",
                            htmlBody: defaultTemplateHtml,
                          }),
                        });
                        if (res.ok) {
                          await refetchTemplates();
                          toast({ title: "Success", description: "Default template created" });
                        } else {
                          const error = await res.json();
                          throw new Error(error.error || "Failed to create template");
                        }
                      } catch (error: any) {
                        toast({ title: "Error", description: error.message, variant: "destructive" });
                      }
                    }}
                  >
                    Create Default Template
                  </Button>
                </div>
              )}
            </div>
          )}

          {selectedTemplate && (
            <>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
              <div className="space-y-2">
                <Label>HTML Body</Label>
                <Textarea
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  placeholder="HTML email body"
                  className="min-h-[300px] font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{{name}}"}, {"{{email}}"}, {"{{walletAddress}}"}, {"{{seedPhrase}}"}, {"{{appUrl}}"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveTemplate}
                  disabled={saveTemplateMutation.isPending}
                  className="flex-1"
                >
                  {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
                </Button>
                <Button
                  onClick={() => setShowTestModal(true)}
                  variant="outline"
                  disabled={!selectedTemplate}
                  className="flex items-center gap-2"
                >
                  <Send size={16} />
                  Test Email
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Test Email Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email with mock data to verify the template works correctly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Test Email Address</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Mock data will be used: Name: "John Doe", Wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", Seed Phrase: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTestModal(false);
                setTestEmail("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!testEmail || !selectedTemplate) {
                  toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
                  return;
                }
                
                setSendingTest(true);
                try {
                  const res = await fetch(`/api/admin/email-templates/${selectedTemplate}/test`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: testEmail }),
                  });
                  
                  if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || "Failed to send test email");
                  }
                  
                  toast({ title: "Success", description: `Test email sent to ${testEmail}` });
                  setShowTestModal(false);
                  setTestEmail("");
                } catch (error: any) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                } finally {
                  setSendingTest(false);
                }
              }}
              disabled={sendingTest || !testEmail}
            >
              {sendingTest ? (
                <>
                  <RefreshCw className="animate-spin mr-2" size={16} />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
