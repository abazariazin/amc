import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type TransactionType = "send" | "receive" | "buy" | "swap";
export type TransactionStatus = "completed" | "pending" | "failed";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  date: string;
  from?: string;
  to?: string;
  hash: string;
}

export interface Asset {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  change24h: number;
  icon: string; // url or lucide icon name
}

export interface User {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  totalBalanceUSD: number;
  assets: Asset[];
}

interface WalletContextType {
  currentUser: User;
  users: User[];
  transactions: Transaction[];
  isAdminLoggedIn: boolean;
  addTransaction: (tx: Omit<Transaction, "id" | "date" | "hash" | "status">) => void;
  getTransaction: (id: string) => Transaction | undefined;
  addUser: (user: Omit<User, "id" | "totalBalanceUSD" | "assets">) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  setCurrentUser: (id: string) => void;
  swapAssets: (fromCurrency: string, toCurrency: string, amount: number) => Promise<void>;
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
}

const MOCK_ASSETS_TEMPLATE: Asset[] = [
  { symbol: "AMC", name: "American Coin", balance: 0, price: 1.85, change24h: 12.5, icon: "shield" },
  { symbol: "BTC", name: "Bitcoin", balance: 0, price: 98450.00, change24h: 2.1, icon: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", balance: 0, price: 3850.00, change24h: -0.5, icon: "triangle" },
];

const INITIAL_USERS: User[] = [
  {
    id: "u1",
    name: "Alex Morgan",
    email: "alex@example.com",
    walletAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d89A23",
    totalBalanceUSD: 0, // Will be calculated by effect
    assets: [
      { symbol: "AMC", name: "American Coin", balance: 5000, price: 1.85, change24h: 12.5, icon: "shield" },
      { symbol: "BTC", name: "Bitcoin", balance: 0.15, price: 98450.00, change24h: 2.1, icon: "bitcoin" },
      { symbol: "ETH", name: "Ethereum", balance: 2.5, price: 3850.00, change24h: -0.5, icon: "triangle" },
    ]
  }
];

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "8f2a1b9c",
    type: "receive",
    amount: 1000,
    currency: "AMC",
    status: "completed",
    date: "2024-05-10T10:30:00Z",
    from: "0x882A3099C0e10e40D9084964177Ff3C385d01234",
    to: "0x71C7656EC7ab88b098defB751B7401B5f6d89A23",
    hash: "0xabc1237890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  },
  {
    id: "3d4e5f6a",
    type: "send",
    amount: 0.05,
    currency: "BTC",
    status: "completed",
    date: "2024-05-09T14:15:00Z",
    from: "0x71C7656EC7ab88b098defB751B7401B5f6d89A23",
    to: "0x99C0e10e40D9084964177Ff3C385d01234567890",
    hash: "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  },
  {
    id: "7b8c9d0e",
    type: "buy",
    amount: 500,
    currency: "AMC",
    status: "pending",
    date: "2024-05-11T09:00:00Z",
    hash: "0xghi7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12"
  }
];

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUserId, setCurrentUserId] = useState<string>("u1");
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const currentUser = users.find(u => u.id === currentUserId) || users[0];

  // Recalculate total balance when assets change (mocking logic for ALL users)
  useEffect(() => {
    setUsers(prevUsers => prevUsers.map(user => {
      const total = user.assets.reduce((acc, asset) => acc + (asset.balance * asset.price), 0);
      return { ...user, totalBalanceUSD: total };
    }));
  }, [JSON.stringify(users.map(u => u.assets))]); // Deep dependency check simplified

  const generateHash = () => {
     return "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
  };

  const generateId = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const addTransaction = (tx: Omit<Transaction, "id" | "date" | "hash" | "status">) => {
    const newTx: Transaction = {
      ...tx,
      id: generateId(),
      date: new Date().toISOString(),
      hash: generateHash(),
      status: "completed" // Auto complete for mock
    };
    setTransactions(prev => [newTx, ...prev]);
    
    setUsers(prevUsers => prevUsers.map(u => {
      // In a real app we would check tx.to or tx.from, here we simplify for the mock current user
      // If the admin adds a transaction for the "User", we assume it's the current user for this demo
      if (u.id === currentUserId) {
         if (tx.type === "receive" || tx.type === "buy") {
           return {
             ...u,
             assets: u.assets.map(a => a.symbol === tx.currency ? { ...a, balance: a.balance + tx.amount } : a)
           };
         } else if (tx.type === "send") {
           return {
             ...u,
             assets: u.assets.map(a => a.symbol === tx.currency ? { ...a, balance: a.balance - tx.amount } : a)
           };
         }
      }
      return u;
    }));
  };

  const swapAssets = async (fromCurrency: string, toCurrency: string, amount: number) => {
    // Basic Mock Swap Logic
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        // Find prices
        const fromAsset = currentUser.assets.find(a => a.symbol === fromCurrency);
        const toAsset = currentUser.assets.find(a => a.symbol === toCurrency);
        
        if (!fromAsset || !toAsset) {
            reject(new Error("Asset not found"));
            return;
        }

        if (fromAsset.balance < amount) {
            reject(new Error("Insufficient balance"));
            return;
        }

        // Calculate exchange rate
        const rate = fromAsset.price / toAsset.price;
        const receiveAmount = amount * rate;

        // Create transaction record
        const newTx: Transaction = {
            id: generateId(),
            type: "swap",
            amount: amount,
            currency: fromCurrency, // record the FROM currency
            status: "completed",
            date: new Date().toISOString(),
            hash: generateHash(),
            from: fromCurrency,
            to: toCurrency
        };
        setTransactions(prev => [newTx, ...prev]);

        // Update balances
        setUsers(prevUsers => prevUsers.map(u => {
          if (u.id === currentUserId) {
             return {
                 ...u,
                 assets: u.assets.map(a => {
                     if (a.symbol === fromCurrency) return { ...a, balance: a.balance - amount };
                     if (a.symbol === toCurrency) return { ...a, balance: a.balance + receiveAmount };
                     return a;
                 })
             };
          }
          return u;
        }));
        
        resolve();
      }, 1000);
    });
  };

  const getTransaction = (id: string) => {
    return transactions.find(t => t.id === id);
  };

  const addUser = (userData: Omit<User, "id" | "totalBalanceUSD" | "assets">) => {
    const newUser: User = {
      ...userData,
      id: `u-${Date.now()}`,
      totalBalanceUSD: 0,
      assets: MOCK_ASSETS_TEMPLATE
    };
    setUsers(prev => [...prev, newUser]);
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
  };

  const loginAdmin = (password: string) => {
    if (password === "admin123") {
      setIsAdminLoggedIn(true);
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAdminLoggedIn(false);
  };

  return (
    <WalletContext.Provider value={{ 
      currentUser, 
      users, 
      transactions, 
      isAdminLoggedIn,
      addTransaction, 
      getTransaction, 
      addUser, 
      updateUser,
      setCurrentUser: setCurrentUserId,
      swapAssets,
      loginAdmin,
      logoutAdmin
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
