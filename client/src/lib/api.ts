// API client for the American Coin wallet application

export async function apiRequest(method: string, url: string, body?: any): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Include cookies for session management
  };
  // Only add body for methods that support it (not GET or HEAD)
  if (body && method !== "GET" && method !== "HEAD") {
    options.body = JSON.stringify(body);
  }
  return fetch(url, options);
}

export interface User {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  btcAddress: string | null;
  seedPhrase: string;
  totalBalanceUSD: number;
  assets: Asset[];
}

export interface Asset {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  change24h: number;
  icon?: string;
}

export interface Transaction {
  id: string;
  type: "send" | "receive" | "buy" | "swap";
  amount: string;
  currency: string;
  status: "completed" | "pending" | "failed";
  date: string;
  from?: string;
  to?: string;
  hash: string;
}

// Authentication API
export const authApi = {
  async login(password: string): Promise<{ success: boolean }> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include", // Include cookies for session management
    });
    if (!res.ok) throw new Error("Login failed");
    return res.json();
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include", // Include cookies for session management
    });
    if (!res.ok) throw new Error("Logout failed");
    return res.json();
  },

  async checkAuth(): Promise<{ isAdmin: boolean }> {
    const res = await fetch("/api/auth/check", {
      credentials: "include", // Include cookies for session management
    });
    if (!res.ok) throw new Error("Auth check failed");
    return res.json();
  },
};

// User API
export const userApi = {
  async getAll(): Promise<User[]> {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },

  async getById(id: string): Promise<User> {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },

  async create(userData: { 
    name: string;
    email: string;
    walletAddress: string; 
    btcAddress?: string;
    seedPhrase: string;
    initialBalances?: { AMC?: string; BTC?: string; ETH?: string }; 
  }): Promise<User> {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create user");
    }
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete user");
    }
  },
};

// Transaction API
export const transactionApi = {
  async getAll(): Promise<Transaction[]> {
    const res = await fetch("/api/transactions");
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return res.json();
  },

  async getByUserId(userId: string): Promise<Transaction[]> {
    const res = await fetch(`/api/users/${userId}/transactions`);
    if (!res.ok) throw new Error("Failed to fetch user transactions");
    return res.json();
  },

  async getById(id: string): Promise<Transaction> {
    const res = await fetch(`/api/transactions/${id}`);
    if (!res.ok) throw new Error("Failed to fetch transaction");
    return res.json();
  },

  async create(txData: {
    type: "send" | "receive" | "buy" | "swap";
    amount: string;
    currency: string;
    from?: string;
    to?: string;
  }): Promise<Transaction> {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(txData),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create transaction");
    }
    return res.json();
  },
};

// Swap API
export const swapApi = {
  async swap(params: {
    userId: string;
    fromCurrency: string;
    toCurrency: string;
    amount: string;
  }): Promise<{ success: boolean; transaction: Transaction; received: number }> {
    const res = await fetch("/api/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Swap failed");
    }
    
    return res.json();
  },
};
