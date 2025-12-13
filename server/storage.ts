import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { 
  type User, 
  type InsertUser,
  type Transaction,
  type InsertTransaction,
  type UserAsset,
  type InsertUserAsset,
  type TokenConfig,
  type UpdateTokenConfig,
  type PushSubscription,
  type InsertPushSubscription,
  type PriceAlert,
  type InsertPriceAlert,
  users,
  transactions,
  userAssets,
  tokenConfigs,
  pushSubscriptions,
  priceAlerts,
  appSettings
} from "@shared/schema";
import path from "path";
import fs from "fs";
import { getCachedOrFetchPrices } from "./price-service";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "wallet.db");
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

export interface IStorage {
  initializeDatabase(): Promise<void>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserBySeedPhrase(seedPhrase: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<{ name: string; walletAddress: string; btcAddress: string | null }>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByHash(hash: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction & { userId?: string }): Promise<Transaction>;
  
  getUserAssets(userId: string): Promise<UserAsset[]>;
  getUserAsset(userId: string, symbol: string): Promise<UserAsset | undefined>;
  createUserAsset(asset: InsertUserAsset): Promise<UserAsset>;
  updateUserAssetBalance(userId: string, symbol: string, newBalance: string): Promise<UserAsset>;
  initializeUserAssets(userId: string): Promise<UserAsset[]>;
  
  getAllTokenConfigs(): Promise<TokenConfig[]>;
  getTokenConfig(symbol: string): Promise<TokenConfig | undefined>;
  updateTokenConfig(symbol: string, updates: UpdateTokenConfig): Promise<TokenConfig>;
  getTokenPrices(): Promise<{ [symbol: string]: { price: number; name: string; change24h: number } }>;
  applyDynamicPricing(): Promise<void>;
  initializeTokenConfigs(): Promise<void>;
  
  getPushSubscription(endpoint: string): Promise<PushSubscription | undefined>;
  getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(endpoint: string): Promise<void>;
  
  getPriceAlert(id: string): Promise<PriceAlert | undefined>;
  getPriceAlertsByUser(userId: string): Promise<PriceAlert[]>;
  getActivePriceAlerts(): Promise<PriceAlert[]>;
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updatePriceAlert(id: string, updates: Partial<{ isActive: string; triggeredAt: Date }>): Promise<PriceAlert>;
  deletePriceAlert(id: string): Promise<void>;
  
  // Email configuration
  getEmailConfig(): Promise<{ id: string; host: string; port: number; secure: number; authUser: string; authPass: string; fromEmail: string; fromName: string; updatedAt: Date } | undefined>;
  updateEmailConfig(config: { host: string; port: number; secure: boolean; authUser: string; authPass?: string; fromEmail: string; fromName: string }): Promise<void>;
  
  // Email templates
  getAllEmailTemplates(): Promise<{ id: string; name: string; subject: string; htmlBody: string; textBody: string | null; variables: string | null; updatedAt: Date }[]>;
  getEmailTemplate(name: string): Promise<{ id: string; name: string; subject: string; htmlBody: string; textBody: string | null; variables: string | null; updatedAt: Date } | undefined>;
  updateEmailTemplate(name: string, template: { subject: string; htmlBody: string; textBody?: string; variables?: string }): Promise<void>;
  
  // App settings
  getAppSettings(): Promise<{ autoSwapEnabled: number }>;
  updateAppSettings(settings: { autoSwapEnabled?: boolean }): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async initializeDatabase(): Promise<void> {
    // Create tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        wallet_address TEXT NOT NULL UNIQUE,
        seed_phrase TEXT NOT NULL UNIQUE,
        btc_address TEXT
      );
      
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount TEXT NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        date INTEGER NOT NULL,
        "from" TEXT,
        "to" TEXT,
        hash TEXT NOT NULL UNIQUE
      );
      
      CREATE INDEX IF NOT EXISTS transactions_currency_idx ON transactions(currency);
      CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);
      CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions(user_id);
      
      CREATE TABLE IF NOT EXISTS user_assets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        balance TEXT NOT NULL DEFAULT '0'
      );
      
      CREATE INDEX IF NOT EXISTS user_assets_user_symbol_idx ON user_assets(user_id, symbol);
      
      CREATE TABLE IF NOT EXISTS token_configs (
        symbol TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        current_price TEXT NOT NULL,
        base_price TEXT NOT NULL,
        last_updated_at INTEGER NOT NULL,
        auto_mode TEXT NOT NULL DEFAULT 'none',
        change_rate TEXT NOT NULL DEFAULT '0',
        change_interval_minutes INTEGER NOT NULL DEFAULT 60,
        cycle_direction TEXT DEFAULT 'increase',
        cycle_increase_count INTEGER DEFAULT 3,
        cycle_current_count INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);
      
      CREATE TABLE IF NOT EXISTS price_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        target_price TEXT NOT NULL,
        condition TEXT NOT NULL,
        is_active TEXT NOT NULL DEFAULT 'true',
        created_at INTEGER NOT NULL,
        triggered_at INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS price_alerts_user_idx ON price_alerts(user_id);
      CREATE INDEX IF NOT EXISTS price_alerts_symbol_idx ON price_alerts(symbol);
      
      CREATE TABLE IF NOT EXISTS email_config (
        id TEXT PRIMARY KEY DEFAULT '1',
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        secure INTEGER NOT NULL DEFAULT 0,
        auth_user TEXT NOT NULL,
        auth_pass TEXT NOT NULL,
        from_email TEXT NOT NULL,
        from_name TEXT NOT NULL DEFAULT 'American Coin',
        app_url TEXT DEFAULT 'https://americancoin.app',
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        subject TEXT NOT NULL,
        html_body TEXT NOT NULL,
        text_body TEXT,
        variables TEXT,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT '1',
        auto_swap_enabled INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);
    
    // Initialize app_settings if it doesn't exist
    try {
      const existingSettings = sqlite.prepare('SELECT id FROM app_settings WHERE id = ?').get('1');
      if (!existingSettings) {
        sqlite.exec(`
          INSERT INTO app_settings (id, auto_swap_enabled, updated_at) 
          VALUES ('1', 0, ${Date.now()})
        `);
      }
    } catch (error: any) {
      console.warn('Error initializing app_settings:', error.message);
    }
    
    // Migrate existing token_configs table to add new columns if they don't exist
    try {
      // Check if columns exist by trying to query them
      sqlite.exec(`SELECT cycle_increase_count FROM token_configs LIMIT 1`);
    } catch (error: any) {
      // Column doesn't exist, add it
      try {
        sqlite.exec(`ALTER TABLE token_configs ADD COLUMN cycle_increase_count INTEGER`);
        // Set default value for existing rows
        sqlite.exec(`UPDATE token_configs SET cycle_increase_count = 3 WHERE cycle_increase_count IS NULL`);
      } catch (migrationError: any) {
        console.warn('Migration error for cycle_increase_count:', migrationError.message);
      }
    }
    
    try {
      sqlite.exec(`SELECT cycle_current_count FROM token_configs LIMIT 1`);
    } catch (error: any) {
      // Column doesn't exist, add it
      try {
        sqlite.exec(`ALTER TABLE token_configs ADD COLUMN cycle_current_count INTEGER`);
        // Set default value for existing rows
        sqlite.exec(`UPDATE token_configs SET cycle_current_count = 0 WHERE cycle_current_count IS NULL`);
      } catch (migrationError: any) {
        console.warn('Migration error for cycle_current_count:', migrationError.message);
      }
    }
    
    // Migration for email_config table to add app_url column
    try {
      sqlite.exec(`SELECT app_url FROM email_config LIMIT 1`);
    } catch (error: any) {
      // Column doesn't exist, add it
      try {
        sqlite.exec(`ALTER TABLE email_config ADD COLUMN app_url TEXT DEFAULT 'https://americancoin.app'`);
        sqlite.exec(`UPDATE email_config SET app_url = 'https://americancoin.app' WHERE app_url IS NULL`);
        console.log('✓ Added app_url column to email_config table');
      } catch (migrationError: any) {
        console.warn('Migration error for app_url:', migrationError.message);
      }
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = db.select().from(users).where(eq(users.id, id)).limit(1).all();
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = db.select().from(users).where(eq(users.email, email)).limit(1).all();
    return result[0];
  }

  async getUserBySeedPhrase(seedPhrase: string): Promise<User | undefined> {
    const result = db.select().from(users).where(eq(users.seedPhrase, seedPhrase)).limit(1).all();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).all();
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = db.insert(users).values(insertUser).returning().all();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<{ name: string; walletAddress: string; btcAddress: string | null }>): Promise<User> {
    const result = db.update(users).set(updates).where(eq(users.id, id)).returning().all();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    // SQLite will cascade delete related records (user_assets, transactions, etc.) due to ON DELETE CASCADE
    db.delete(users).where(eq(users.id, id)).run();
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.date)).all();
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date)).all();
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const result = db.select().from(transactions).where(eq(transactions.id, id)).limit(1).all();
    return result[0];
  }

  async getTransactionByHash(hash: string): Promise<Transaction | undefined> {
    const result = db.select().from(transactions).where(eq(transactions.hash, hash)).limit(1).all();
    return result[0];
  }

  async createTransaction(insertTransaction: InsertTransaction & { userId?: string }): Promise<Transaction> {
    const hash = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
    const id = Math.random().toString(36).substring(2, 10);
    
    const result = db.insert(transactions).values({
      ...insertTransaction,
      id,
      hash,
      status: "completed",
    }).returning().all();
    return result[0];
  }

  async getUserAssets(userId: string): Promise<UserAsset[]> {
    return db.select().from(userAssets).where(eq(userAssets.userId, userId)).all();
  }

  async getUserAsset(userId: string, symbol: string): Promise<UserAsset | undefined> {
    const result = db.select().from(userAssets).where(
      and(eq(userAssets.userId, userId), eq(userAssets.symbol, symbol))
    ).limit(1).all();
    return result[0];
  }

  async createUserAsset(asset: InsertUserAsset): Promise<UserAsset> {
    const result = db.insert(userAssets).values(asset).returning().all();
    return result[0];
  }

  async updateUserAssetBalance(userId: string, symbol: string, newBalance: string): Promise<UserAsset> {
    const result = db.update(userAssets)
      .set({ balance: newBalance })
      .where(and(eq(userAssets.userId, userId), eq(userAssets.symbol, symbol)))
      .returning().all();
    return result[0];
  }

  async initializeUserAssets(userId: string): Promise<UserAsset[]> {
    const defaultAssets = [
      { userId, symbol: "AMC", balance: "0" },
      { userId, symbol: "BTC", balance: "0" },
      { userId, symbol: "ETH", balance: "0" },
    ];
    
    const result = db.insert(userAssets).values(defaultAssets).returning().all();
    return result;
  }

  async getAllTokenConfigs(): Promise<TokenConfig[]> {
    return db.select().from(tokenConfigs).all();
  }

  async getTokenConfig(symbol: string): Promise<TokenConfig | undefined> {
    const result = db.select().from(tokenConfigs).where(eq(tokenConfigs.symbol, symbol)).limit(1).all();
    return result[0];
  }

  async updateTokenConfig(symbol: string, updates: UpdateTokenConfig): Promise<TokenConfig> {
    const result = db.update(tokenConfigs)
      .set({ ...updates, lastUpdatedAt: new Date() })
      .where(eq(tokenConfigs.symbol, symbol))
      .returning().all();
    return result[0];
  }

  async getTokenPrices(): Promise<{ [symbol: string]: { price: number; name: string; change24h: number } }> {
    // Apply dynamic pricing only for AMC (admin-controlled)
    await this.applyDynamicPricing();
    const configs = await this.getAllTokenConfigs();
    
    // Fetch real-time prices for BTC and ETH
    const realTimePrices = await getCachedOrFetchPrices();
    
    const prices: { [symbol: string]: { price: number; name: string; change24h: number } } = {};
    
    for (const config of configs) {
      // Use real-time prices for BTC and ETH
      if (config.symbol === "BTC" && realTimePrices.BTC) {
        prices[config.symbol] = {
          price: realTimePrices.BTC.price,
          name: config.displayName,
          change24h: Math.round(realTimePrices.BTC.change24h * 100) / 100
        };
        // Update stored price for reference
        if (parseFloat(config.currentPrice) !== realTimePrices.BTC.price) {
          db.update(tokenConfigs)
            .set({ 
              currentPrice: realTimePrices.BTC.price.toFixed(8),
              basePrice: realTimePrices.BTC.price.toFixed(8),
              lastUpdatedAt: new Date()
            })
            .where(eq(tokenConfigs.symbol, "BTC"))
            .run();
        }
      } else if (config.symbol === "ETH" && realTimePrices.ETH) {
        prices[config.symbol] = {
          price: realTimePrices.ETH.price,
          name: config.displayName,
          change24h: Math.round(realTimePrices.ETH.change24h * 100) / 100
        };
        // Update stored price for reference
        if (parseFloat(config.currentPrice) !== realTimePrices.ETH.price) {
          db.update(tokenConfigs)
            .set({ 
              currentPrice: realTimePrices.ETH.price.toFixed(8),
              basePrice: realTimePrices.ETH.price.toFixed(8),
              lastUpdatedAt: new Date()
            })
            .where(eq(tokenConfigs.symbol, "ETH"))
            .run();
        }
      } else {
        // For AMC, use stored price with dynamic pricing applied
        const basePrice = parseFloat(config.basePrice || "0");
        const currentPrice = parseFloat(config.currentPrice || config.basePrice || "0");
        
        // Validate prices - if invalid, use basePrice
        const validCurrentPrice = isNaN(currentPrice) || currentPrice <= 0 ? basePrice : currentPrice;
        const validBasePrice = isNaN(basePrice) || basePrice <= 0 ? 1.85 : basePrice; // Default fallback
        
        const finalCurrentPrice = isNaN(validCurrentPrice) ? validBasePrice : validCurrentPrice;
        const finalBasePrice = isNaN(validBasePrice) ? 1.85 : validBasePrice;
        
        const change24h = finalBasePrice > 0 ? ((finalCurrentPrice - finalBasePrice) / finalBasePrice) * 100 : 0;
        
        prices[config.symbol] = {
          price: finalCurrentPrice,
          name: config.displayName,
          change24h: Math.round(change24h * 100) / 100
        };
        
        // If currentPrice was invalid, update it in the database
        if (isNaN(currentPrice) || currentPrice <= 0) {
          console.warn(`Invalid currentPrice for ${config.symbol}, updating to ${finalCurrentPrice}`);
          db.update(tokenConfigs)
            .set({ 
              currentPrice: finalCurrentPrice.toFixed(8),
              lastUpdatedAt: new Date()
            })
            .where(eq(tokenConfigs.symbol, config.symbol))
            .run();
        }
      }
    }
    
    return prices;
  }

  async applyDynamicPricing(): Promise<void> {
    const configs = db.select().from(tokenConfigs).all();
    const now = new Date();
    
    for (const config of configs) {
      // Only apply dynamic pricing to AMC (admin-controlled)
      // BTC and ETH use real-time prices from external API
      if (config.symbol !== "AMC" || config.autoMode === "none") continue;
      
      const lastUpdated = new Date(config.lastUpdatedAt);
      const minutesPassed = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
      const intervalsPassed = Math.floor(minutesPassed / config.changeIntervalMinutes);
      
      if (intervalsPassed < 1) continue;
      
      let currentPrice = parseFloat(config.currentPrice || config.basePrice || "0");
      const changeRate = parseFloat(config.changeRate || "0") / 100;
      
      // Validate currentPrice - if invalid, use basePrice
      if (isNaN(currentPrice) || currentPrice <= 0) {
        currentPrice = parseFloat(config.basePrice || "1.85");
        console.warn(`Invalid currentPrice for ${config.symbol}, using basePrice: ${currentPrice}`);
      }
      
      // Validate changeRate
      if (isNaN(changeRate) || changeRate <= 0) {
        console.warn(`Invalid changeRate for ${config.symbol}, skipping price update`);
        continue;
      }
      
      let cycleCurrentCount = (config as any).cycleCurrentCount || 0;
      const cycleIncreaseCount = (config as any).cycleIncreaseCount || 3;
      let direction = config.cycleDirection || "increase";
      
      for (let i = 0; i < intervalsPassed; i++) {
        if (config.autoMode === "increase") {
          currentPrice = currentPrice * (1 + changeRate);
        } else if (config.autoMode === "decrease") {
          currentPrice = currentPrice * (1 - changeRate);
        } else if (config.autoMode === "cycle") {
          // Use cycle ratio: increase X times, then decrease once
          if (cycleCurrentCount < cycleIncreaseCount) {
            // Still in increase phase
            currentPrice = currentPrice * (1 + changeRate);
            cycleCurrentCount++;
            direction = "increase";
          } else {
            // Time for one decrease, then reset counter
            currentPrice = currentPrice * (1 - changeRate);
            cycleCurrentCount = 0;
            direction = "increase"; // Reset to increase phase
          }
        }
      }
      
      // Validate final price before saving
      if (isNaN(currentPrice) || currentPrice <= 0) {
        console.error(`Invalid calculated price for ${config.symbol}: ${currentPrice}, skipping update`);
        continue;
      }
      
      db.update(tokenConfigs)
        .set({ 
          currentPrice: currentPrice.toFixed(8),
          lastUpdatedAt: now,
          cycleDirection: direction,
          cycleCurrentCount: cycleCurrentCount
        })
        .where(eq(tokenConfigs.symbol, config.symbol))
        .run();
        
      console.log(`Updated ${config.symbol} price: ${currentPrice.toFixed(8)} (mode: ${config.autoMode}, intervals: ${intervalsPassed})`);
    }
  }

  async initializeTokenConfigs(): Promise<void> {
    const existing = db.select().from(tokenConfigs).all();
    if (existing.length > 0) {
      // Migrate existing configs to add new cycle fields if they don't exist
      for (const config of existing) {
        const needsUpdate = (config as any).cycleIncreaseCount === undefined || (config as any).cycleCurrentCount === undefined;
        if (needsUpdate) {
          db.update(tokenConfigs)
            .set({
              cycleIncreaseCount: 3,
              cycleCurrentCount: 0,
            })
            .where(eq(tokenConfigs.symbol, config.symbol))
            .run();
        }
      }
      return;
    }
    
    const defaultConfigs = [
      { symbol: "BTC", displayName: "Bitcoin", currentPrice: "98450", basePrice: "98450", autoMode: "none", changeRate: "0", changeIntervalMinutes: 60, cycleIncreaseCount: 3, cycleCurrentCount: 0 },
      { symbol: "ETH", displayName: "Ethereum", currentPrice: "3850", basePrice: "3850", autoMode: "none", changeRate: "0", changeIntervalMinutes: 60, cycleIncreaseCount: 3, cycleCurrentCount: 0 },
      { symbol: "AMC", displayName: "American Coin", currentPrice: "1.85", basePrice: "1.85", autoMode: "none", changeRate: "0.5", changeIntervalMinutes: 60, cycleDirection: "increase", cycleIncreaseCount: 3, cycleCurrentCount: 0 },
    ];
    
    db.insert(tokenConfigs).values(defaultConfigs).run();
  }

  async getPushSubscription(endpoint: string): Promise<PushSubscription | undefined> {
    const result = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).limit(1).all();
    return result[0];
  }

  async getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).all();
  }

  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const result = db.insert(pushSubscriptions).values(subscription).returning().all();
    return result[0];
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
  }

  async getPriceAlert(id: string): Promise<PriceAlert | undefined> {
    const result = db.select().from(priceAlerts).where(eq(priceAlerts.id, id)).limit(1).all();
    return result[0];
  }

  async getPriceAlertsByUser(userId: string): Promise<PriceAlert[]> {
    return db.select().from(priceAlerts).where(eq(priceAlerts.userId, userId)).orderBy(desc(priceAlerts.createdAt)).all();
  }

  async getActivePriceAlerts(): Promise<PriceAlert[]> {
    return db.select().from(priceAlerts).where(eq(priceAlerts.isActive, "true")).all();
  }

  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    const result = db.insert(priceAlerts).values(alert).returning().all();
    return result[0];
  }

  async updatePriceAlert(id: string, updates: Partial<{ isActive: string; triggeredAt: Date }>): Promise<PriceAlert> {
    const result = db.update(priceAlerts).set(updates).where(eq(priceAlerts.id, id)).returning().all();
    return result[0];
  }

  async deletePriceAlert(id: string): Promise<void> {
    db.delete(priceAlerts).where(eq(priceAlerts.id, id)).run();
  }

  // Email configuration methods
  async getEmailConfig(): Promise<{ id: string; host: string; port: number; secure: number; authUser: string; authPass: string; fromEmail: string; fromName: string; appUrl: string; updatedAt: Date } | undefined> {
    const result = sqlite.prepare("SELECT * FROM email_config WHERE id = '1'").get() as any;
    if (!result) return undefined;
    return {
      id: result.id,
      host: result.host,
      port: result.port,
      secure: result.secure,
      authUser: result.auth_user,
      authPass: result.auth_pass,
      fromEmail: result.from_email,
      fromName: result.from_name,
      appUrl: result.app_url || "https://americancoin.app",
      updatedAt: new Date(result.updated_at),
    };
  }

  async updateEmailConfig(config: { host: string; port: number; secure: boolean; authUser: string; authPass?: string; fromEmail: string; fromName: string; appUrl?: string }): Promise<void> {
    const existing = sqlite.prepare("SELECT id, auth_pass, app_url FROM email_config WHERE id = '1'").get() as { id: string; auth_pass: string; app_url: string } | undefined;
    const now = Date.now();
    
    // If updating and password not provided (undefined), use existing password
    // If password is explicitly provided (even if empty string), use it
    // IMPORTANT: undefined means "keep existing", empty string means "clear password"
    let passwordToUse: string;
    if (config.authPass !== undefined && config.authPass !== null) {
      // Password was explicitly provided - use it as-is (don't trim, preserve exactly as provided)
      passwordToUse = config.authPass;
      console.log("[STORAGE] Using provided password, length:", passwordToUse.length);
    } else {
      // Password not provided - use existing if available
      passwordToUse = existing?.auth_pass || "";
      console.log("[STORAGE] Using existing password, length:", passwordToUse.length);
      if (!passwordToUse && existing) {
        console.error("[STORAGE] WARNING: Existing config found but password is empty!");
      }
    }
    
    // If creating new config, password is required
    if (!existing && !passwordToUse) {
      throw new Error("Password is required when creating new email configuration");
    }
    
    // Handle appUrl - if provided, use it; otherwise keep existing or use default
    let appUrlToUse: string;
    if (config.appUrl !== undefined && config.appUrl !== null && config.appUrl.trim() !== "") {
      appUrlToUse = config.appUrl.trim();
      console.log("[STORAGE] Using provided appUrl:", appUrlToUse);
    } else if (existing) {
      // Keep existing appUrl if updating and not provided
      appUrlToUse = (existing as any).app_url || "https://americancoin.app";
      console.log("[STORAGE] Using existing appUrl:", appUrlToUse);
    } else {
      // Use default for new config
      appUrlToUse = "https://americancoin.app";
      console.log("[STORAGE] Using default appUrl:", appUrlToUse);
    }
    
    // Log what's being saved (WITH password for debugging)
    console.log("Saving email config:", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      authUser: config.authUser,
      passwordProvided: !!config.authPass,
      passwordToSave: passwordToUse || "USING_EXISTING",
      passwordLength: passwordToUse.length,
      passwordPreview: passwordToUse ? `${passwordToUse.substring(0, 3)}...${passwordToUse.substring(passwordToUse.length - 2)}` : "NONE",
      fromEmail: config.fromEmail,
      appUrl: appUrlToUse,
      isUpdate: !!existing,
    });
    
    if (existing) {
      sqlite.prepare(`
        UPDATE email_config 
        SET host = ?, port = ?, secure = ?, auth_user = ?, auth_pass = ?, from_email = ?, from_name = ?, app_url = ?, updated_at = ?
        WHERE id = '1'
      `).run(
        config.host,
        config.port,
        config.secure ? 1 : 0,
        config.authUser,
        passwordToUse,
        config.fromEmail,
        config.fromName,
        appUrlToUse, // Use the computed appUrl
        now
      );
    } else {
      sqlite.prepare(`
        INSERT INTO email_config (id, host, port, secure, auth_user, auth_pass, from_email, from_name, app_url, updated_at)
        VALUES ('1', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        config.host,
        config.port,
        config.secure ? 1 : 0,
        config.authUser,
        passwordToUse,
        config.fromEmail,
        config.fromName,
        appUrlToUse, // Use the computed appUrl
        now
      );
    }
  }

  // Email template methods
  async getAllEmailTemplates(): Promise<{ id: string; name: string; subject: string; htmlBody: string; textBody: string | null; variables: string | null; updatedAt: Date }[]> {
    const results = sqlite.prepare("SELECT * FROM email_templates ORDER BY name").all() as any[];
    return results.map(r => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      htmlBody: r.html_body,
      textBody: r.text_body,
      variables: r.variables,
      updatedAt: new Date(r.updated_at),
    }));
  }

  async getEmailTemplate(name: string): Promise<{ id: string; name: string; subject: string; htmlBody: string; textBody: string | null; variables: string | null; updatedAt: Date } | undefined> {
    const result = sqlite.prepare("SELECT * FROM email_templates WHERE name = ?").get(name) as any;
    if (!result) return undefined;
    return {
      id: result.id,
      name: result.name,
      subject: result.subject,
      htmlBody: result.html_body,
      textBody: result.text_body,
      variables: result.variables,
      updatedAt: new Date(result.updated_at),
    };
  }

  async updateEmailTemplate(name: string, template: { subject: string; htmlBody: string; textBody?: string; variables?: string }): Promise<void> {
    const existing = sqlite.prepare("SELECT id FROM email_templates WHERE name = ?").get(name);
    const now = Date.now();
    
    if (existing) {
      sqlite.prepare(`
        UPDATE email_templates 
        SET subject = ?, html_body = ?, text_body = ?, variables = ?, updated_at = ?
        WHERE name = ?
      `).run(
        template.subject,
        template.htmlBody,
        template.textBody || null,
        template.variables ? JSON.stringify(template.variables) : null,
        now,
        name
      );
    } else {
      const id = randomUUID();
      sqlite.prepare(`
        INSERT INTO email_templates (id, name, subject, html_body, text_body, variables, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        template.subject,
        template.htmlBody,
        template.textBody || null,
        template.variables ? JSON.stringify(template.variables) : null,
        now
      );
    }
  }

  async getAppSettings(): Promise<{ autoSwapEnabled: number }> {
    const result = sqlite.prepare("SELECT auto_swap_enabled as autoSwapEnabled FROM app_settings WHERE id = '1'").get() as { autoSwapEnabled: number } | undefined;
    if (!result) {
      // Initialize if not exists
      sqlite.prepare(`
        INSERT INTO app_settings (id, auto_swap_enabled, updated_at) 
        VALUES ('1', 0, ?)
      `).run(Date.now());
      return { autoSwapEnabled: 0 };
    }
    return result;
  }

  async updateAppSettings(settings: { autoSwapEnabled?: boolean }): Promise<void> {
    const now = Date.now();
    if (settings.autoSwapEnabled !== undefined) {
      sqlite.prepare(`
        INSERT INTO app_settings (id, auto_swap_enabled, updated_at)
        VALUES ('1', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          auto_swap_enabled = excluded.auto_swap_enabled,
          updated_at = excluded.updated_at
      `).run(settings.autoSwapEnabled ? 1 : 0, now);
    }
  }
}

export const storage = new DatabaseStorage();
