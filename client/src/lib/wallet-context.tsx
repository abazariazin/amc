import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi, transactionApi, authApi, swapApi, type User, type Transaction } from "./api";

interface WalletContextType {
  currentUser: User | null;
  users: User[];
  transactions: Transaction[];
  isAdminLoggedIn: boolean;
  isLoading: boolean;
  addTransaction: (tx: Omit<Transaction, "id" | "date" | "hash" | "status">) => Promise<void>;
  getTransaction: (id: string) => Transaction | undefined;
  addUser: (user: { name: string; walletAddress: string; btcAddress?: string; seedPhrase: string; initialBalances?: { AMC?: string; BTC?: string; ETH?: string } }) => Promise<void>;
  swapAssets: (fromCurrency: string, toCurrency: string, amount: number) => Promise<void>;
  loginAdmin: (password: string) => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
  setAuthenticatedUser: (userId: string) => void;
  logoutUser: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Load user ID from localStorage safely on mount and verify session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = localStorage.getItem("userId");
      if (storedId) {
        // Verify session is still valid
        fetch("/api/auth/current-user", { credentials: "include" })
          .then(res => res.json())
          .then(data => {
            if (data.userId === storedId) {
              setCurrentUserId(storedId);
            } else {
              // Session expired or doesn't match, clear localStorage
              localStorage.removeItem("userId");
              setCurrentUserId(null);
            }
          })
          .catch(() => {
            // If check fails, still set the userId (session might be valid)
            setCurrentUserId(storedId);
          });
      }
    }
    setSessionChecked(true);
  }, []);

  // Check admin auth status on mount
  useEffect(() => {
    authApi.checkAuth().then(({ isAdmin }) => {
      setIsAdminLoggedIn(isAdmin);
    }).catch(() => {
      setIsAdminLoggedIn(false);
    });
  }, []);

  // Listen for localStorage changes (for when user logs in from landing page)
  useEffect(() => {
    const handleStorageChange = () => {
      const storedId = localStorage.getItem("userId");
      setCurrentUserId(storedId);
    };
    window.addEventListener("storage", handleStorageChange);
    // Also check on focus in case same-tab navigation
    const checkOnFocus = () => {
      const storedId = localStorage.getItem("userId");
      if (storedId !== currentUserId) {
        setCurrentUserId(storedId);
      }
    };
    window.addEventListener("focus", checkOnFocus);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", checkOnFocus);
    };
  }, [currentUserId]);

  // Fetch current user only if we have a userId
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["user", currentUserId],
    queryFn: () => currentUserId ? userApi.getById(currentUserId) : Promise.resolve(null),
    retry: 1,
    staleTime: 10000,
    enabled: !!currentUserId,
  });

  // Fetch all users (for admin)
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: userApi.getAll,
    enabled: isAdminLoggedIn,
    staleTime: 10000,
  });

  // Fetch user transactions (or all for admin)
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions", currentUserId, isAdminLoggedIn],
    queryFn: () => {
      if (isAdminLoggedIn) {
        return transactionApi.getAll();
      }
      if (currentUserId) {
        return transactionApi.getByUserId(currentUserId);
      }
      return Promise.resolve([]);
    },
    enabled: isAdminLoggedIn || !!currentUserId,
    staleTime: 5000,
  });

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: (txData: { type: "send" | "receive" | "buy" | "swap"; amount: string; currency: string; from?: string; to?: string }) =>
      transactionApi.create(txData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (userData: { name: string; walletAddress: string; btcAddress?: string; seedPhrase: string; initialBalances?: { AMC?: string; BTC?: string; ETH?: string } }) =>
      userApi.create(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  // Swap mutation
  const swapMutation = useMutation({
    mutationFn: ({ fromCurrency, toCurrency, amount }: { fromCurrency: string; toCurrency: string; amount: number }) => {
      if (!currentUserId) throw new Error("No user logged in");
      return swapApi.swap({
        userId: currentUserId,
        fromCurrency,
        toCurrency,
        amount: amount.toString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const addTransaction = async (tx: Omit<Transaction, "id" | "date" | "hash" | "status">) => {
    await createTransactionMutation.mutateAsync({
      type: tx.type as "send" | "receive" | "buy" | "swap",
      amount: tx.amount.toString(),
      currency: tx.currency,
      from: tx.from,
      to: tx.to,
    });
  };

  const getTransaction = (id: string) => {
    return transactions.find(t => t.id === id || t.hash === id);
  };

  const addUser = async (userData: { name: string; walletAddress: string; btcAddress?: string; seedPhrase: string; initialBalances?: { AMC?: string; BTC?: string; ETH?: string } }) => {
    await createUserMutation.mutateAsync(userData);
  };

  const swapAssets = async (fromCurrency: string, toCurrency: string, amount: number) => {
    await swapMutation.mutateAsync({ fromCurrency, toCurrency, amount });
  };

  const loginAdmin = async (password: string): Promise<boolean> => {
    try {
      await authApi.login(password);
      // Re-check auth status to ensure session is properly set
      const { isAdmin } = await authApi.checkAuth();
      setIsAdminLoggedIn(isAdmin);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      return isAdmin;
    } catch {
      setIsAdminLoggedIn(false);
      return false;
    }
  };

  const logoutAdmin = async () => {
    try {
      await authApi.logout();
      setIsAdminLoggedIn(false);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const setAuthenticatedUser = (userId: string) => {
    localStorage.setItem("userId", userId);
    setCurrentUserId(userId);
    queryClient.invalidateQueries({ queryKey: ["user", userId] });
  };

  const logoutUser = () => {
    localStorage.removeItem("userId");
    setCurrentUserId(null);
    queryClient.clear();
  };

  return (
    <WalletContext.Provider value={{
      currentUser: currentUser || null,
      users,
      transactions,
      isAdminLoggedIn,
      isLoading: !sessionChecked || userLoading || txLoading,
      addTransaction,
      getTransaction,
      addUser,
      swapAssets,
      loginAdmin,
      logoutAdmin,
      setAuthenticatedUser,
      logoutUser,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  // Backwards compatibility alias
  return { ...context, user: context.currentUser };
}
