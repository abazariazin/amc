import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertTransactionSchema, updateTokenConfigSchema, insertPriceAlertSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { 
  getVapidPublicKey, 
  isNotificationsConfigured, 
  sendPushNotificationToUser, 
  sendTransactionNotification,
  checkPriceAlerts 
} from "./push-service";
import { 
  initializeEmailService, 
  sendEmail, 
  replaceTemplateVariables,
  getDefaultAccountConfirmationTemplate 
} from "./email-service";

// Helper to get dynamic prices
async function getTokenPrices() {
  return storage.getTokenPrices();
}

// Extend Express session to include isAdmin and userId
declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    userId: string;
  }
}

// Middleware to check admin authentication
function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ========== Authentication Routes ==========
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { password } = req.body;
      
      // Get admin password from environment variable, fallback to default for backward compatibility
      const adminPassword = process.env.ADMIN_PASSWORD || "Loadedev1";
      
      // Debug logging to help troubleshoot password issues
      console.log(`[AUTH] Login attempt received`);
      console.log(`[AUTH] Env ADMIN_PASSWORD set: ${!!process.env.ADMIN_PASSWORD}`);
      console.log(`[AUTH] Env ADMIN_PASSWORD value: ${process.env.ADMIN_PASSWORD ? '***' + process.env.ADMIN_PASSWORD.slice(-2) : 'NOT SET'}`);
      console.log(`[AUTH] Expected password length: ${adminPassword.length}`);
      console.log(`[AUTH] Expected password (first 2 chars): ${adminPassword.substring(0, 2)}...`);
      console.log(`[AUTH] Received password length: ${password ? password.length : 0}`);
      console.log(`[AUTH] Received password (first 2 chars): ${password ? password.substring(0, 2) + '...' : 'EMPTY'}`);
      console.log(`[AUTH] Password match: ${password === adminPassword}`);
      
      // Also try trimming whitespace in case there are extra spaces
      const trimmedPassword = password ? password.trim() : '';
      const trimmedAdminPassword = adminPassword.trim();
      
      if (password === adminPassword || trimmedPassword === trimmedAdminPassword) {
        req.session.isAdmin = true;
        // Save session explicitly to ensure it's persisted
        req.session.save((err: any) => {
          if (err) {
            console.log(`[AUTH] Session save error: ${err.message}`);
            return res.status(500).json({ error: "Failed to save session" });
          }
          console.log(`[AUTH] Login successful - session saved`);
          console.log(`[AUTH] Session ID: ${req.sessionID}`);
          console.log(`[AUTH] Session isAdmin: ${req.session.isAdmin}`);
          console.log(`[AUTH] Cookie will be sent: ${req.session.cookie ? 'yes' : 'no'}`);
          if (req.session.cookie) {
            console.log(`[AUTH] Cookie settings - secure: ${req.session.cookie.secure}, sameSite: ${req.session.cookie.sameSite}, httpOnly: ${req.session.cookie.httpOnly}`);
          }
          // Log response headers to see if cookie is being set
          const setCookieHeader = res.getHeader('Set-Cookie');
          console.log(`[AUTH] Response headers - Set-Cookie: ${setCookieHeader ? 'present' : 'missing'}`);
          if (setCookieHeader) {
            console.log(`[AUTH] Set-Cookie value: ${Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader}`);
          }
          res.json({ success: true });
        });
        return; // Return early after save callback
      }
      
      console.log(`[AUTH] Login failed - password mismatch`);
      console.log(`[AUTH] Expected: "${adminPassword}" (length: ${adminPassword.length})`);
      console.log(`[AUTH] Received: "${password}" (length: ${password ? password.length : 0})`);
      return res.status(401).json({ error: "Invalid credentials" });
    } catch (error: any) {
      console.log(`[AUTH] Error: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/check", (req, res) => {
    console.log(`[AUTH] Check request - Session ID: ${req.sessionID}`);
    console.log(`[AUTH] Check request - Session isAdmin: ${req.session?.isAdmin}`);
    console.log(`[AUTH] Check request - Session exists: ${!!req.session}`);
    console.log(`[AUTH] Check request - Cookies received: ${req.headers.cookie ? 'yes' : 'no'}`);
    if (req.headers.cookie) {
      const cookiePreview = req.headers.cookie.length > 100 ? req.headers.cookie.substring(0, 100) + '...' : req.headers.cookie;
      console.log(`[AUTH] Check request - Cookie header: ${cookiePreview}`);
    }
    res.json({ isAdmin: !!req.session?.isAdmin });
  });

  // Import wallet by seed phrase
  app.post("/api/auth/import-wallet", async (req, res) => {
    try {
      const { seedPhrase } = req.body;
      
      if (!seedPhrase) {
        return res.status(400).json({ error: "Seed phrase is required" });
      }
      
      const normalizedPhrase = seedPhrase.toLowerCase().trim().replace(/\s+/g, ' ');
      const user = await storage.getUserBySeedPhrase(normalizedPhrase);
      
      if (!user) {
        return res.status(404).json({ error: "No wallet found with this seed phrase" });
      }
      
      // Store user ID in session for persistent login
      req.session.userId = user.id;
      
      res.json({ success: true, userId: user.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/current-user", (req, res) => {
    if (req.session?.userId) {
      res.json({ userId: req.session.userId });
    } else {
      res.json({ userId: null });
    }
  });

  // ========== Token Price Routes ==========
  app.get("/api/prices", async (req, res) => {
    try {
      const prices = await getTokenPrices();
      res.json(prices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/token-configs", requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllTokenConfigs();
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/app-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/app-settings", requireAdmin, async (req, res) => {
    try {
      const { autoSwapEnabled } = req.body;
      await storage.updateAppSettings({ autoSwapEnabled });
      const settings = await storage.getAppSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/token-configs/:symbol", requireAdmin, async (req, res) => {
    try {
      // Only allow updating AMC config (BTC and ETH use real-time prices)
      if (req.params.symbol !== "AMC") {
        return res.status(403).json({ error: "BTC and ETH prices are managed automatically from real-time market data. Only AMC can be configured." });
      }
      
      const validatedData = updateTokenConfigSchema.parse(req.body);
      const updated = await storage.updateTokenConfig(req.params.symbol, validatedData);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========== User Routes ==========
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const tokenPrices = await getTokenPrices();
      
      const usersWithAssets = await Promise.all(
        allUsers.map(async (user) => {
          const assets = await storage.getUserAssets(user.id);
          
          const assetsWithPrices = assets.map(asset => ({
            symbol: asset.symbol,
            name: tokenPrices[asset.symbol]?.name || asset.symbol,
            balance: parseFloat(asset.balance),
            price: tokenPrices[asset.symbol]?.price || 0,
            change24h: tokenPrices[asset.symbol]?.change24h || 0,
          }));
          
          const totalBalanceUSD = assetsWithPrices.reduce(
            (sum, asset) => sum + (asset.balance * asset.price), 
            0
          );
          
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            walletAddress: user.walletAddress,
            btcAddress: user.btcAddress,
            seedPhrase: user.seedPhrase,
            totalBalanceUSD,
            assets: assetsWithPrices,
          };
        })
      );
      
      res.json(usersWithAssets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const assets = await storage.getUserAssets(user.id);
      const tokenPrices = await getTokenPrices();
      
      const assetsWithPrices = assets.map(asset => ({
        symbol: asset.symbol,
        name: tokenPrices[asset.symbol]?.name || asset.symbol,
        balance: parseFloat(asset.balance),
        price: tokenPrices[asset.symbol]?.price || 0,
        change24h: tokenPrices[asset.symbol]?.change24h || 0,
        icon: asset.symbol === "AMC" ? "shield" : 
              asset.symbol === "BTC" ? "bitcoin" : "triangle",
      }));
      
      const totalBalanceUSD = assetsWithPrices.reduce(
        (sum, asset) => sum + (asset.balance * asset.price), 
        0
      );
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        walletAddress: user.walletAddress,
        btcAddress: user.btcAddress,
        seedPhrase: user.seedPhrase,
        totalBalanceUSD,
        assets: assetsWithPrices,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { name, email, walletAddress, btcAddress, seedPhrase, initialBalances } = req.body;
      
      if (!name || !walletAddress || !seedPhrase || !email) {
        return res.status(400).json({ error: "Name, email, wallet address, and seed phrase are required" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      
      // Normalize seed phrase
      const normalizedSeedPhrase = seedPhrase.toLowerCase().trim().replace(/\s+/g, ' ');
      
      const user = await storage.createUser({
        name,
        email: email.toLowerCase().trim(),
        walletAddress,
        btcAddress: btcAddress || null,
        seedPhrase: normalizedSeedPhrase,
      });
      await storage.initializeUserAssets(user.id);
      
      // Set initial balances if provided
      if (initialBalances) {
        const tokens = ['AMC', 'BTC', 'ETH'];
        for (const token of tokens) {
          const balance = initialBalances[token];
          if (balance && parseFloat(balance) > 0) {
            await storage.updateUserAssetBalance(user.id, token, balance);
          }
        }
      }
      
      // Send confirmation email
      try {
        const emailConfig = await storage.getEmailConfig();
        if (emailConfig && emailConfig.host) {
          // Ensure email service is initialized
          const initialized = await initializeEmailService({
            host: emailConfig.host,
            port: emailConfig.port,
            secure: emailConfig.secure === 1,
            authUser: emailConfig.authUser,
            authPass: emailConfig.authPass,
            fromEmail: emailConfig.fromEmail,
            fromName: emailConfig.fromName,
          });
          
          if (initialized) {
            let template = await storage.getEmailTemplate("account_confirmation");
            let htmlTemplate = template?.htmlBody || getDefaultAccountConfirmationTemplate();
            const subject = template?.subject || "Welcome to American Coin - Your Account Has Been Created";
            
            // Ensure seed phrase is always included in the template
            if (!htmlTemplate.includes("{{seedPhrase}}")) {
              console.log("⚠️ Template missing {{seedPhrase}}, adding seed phrase section from default template");
              const defaultHtml = getDefaultAccountConfirmationTemplate();
              // Extract seed phrase section from default template (from comment to closing div)
              const seedPhraseMatch = defaultHtml.match(/<!-- Seed Phrase Section - CRITICAL -->[\s\S]*?<\/div>\s*\n\s*<\/div>/);
              if (seedPhraseMatch) {
                const seedPhraseSection = seedPhraseMatch[0];
                // Insert seed phrase section before the "Access Your Wallet" button
                if (htmlTemplate.includes('Access Your Wallet')) {
                  htmlTemplate = htmlTemplate.replace(
                    /(<div style="text-align: center; margin: 40px 0 20px;">)/,
                    seedPhraseSection + '\n              \n              $1'
                  );
                } else if (htmlTemplate.includes('<!-- Footer -->')) {
                  // Append before footer if button not found
                  htmlTemplate = htmlTemplate.replace(
                    /(<!-- Footer -->)/,
                    seedPhraseSection + '\n          \n          $1'
                  );
                } else {
                  // Fallback: append before closing table cell
                  htmlTemplate = htmlTemplate.replace(
                    /(<\/td>\s*<\/tr>\s*<!-- Footer -->)/,
                    seedPhraseSection + '\n            $1'
                  );
                }
                // Update the stored template to include seed phrase
                if (template) {
                  const variables = template.variables ? JSON.parse(template.variables) : [];
                  if (!variables.includes("seedPhrase")) {
                    variables.push("seedPhrase");
                  }
                  await storage.updateEmailTemplate("account_confirmation", {
                    subject: template.subject,
                    htmlBody: htmlTemplate,
                    textBody: template.textBody || "",
                    variables: JSON.stringify(variables),
                  });
                  console.log("✓ Updated stored template to include seed phrase section");
                }
              } else {
                console.error("✗ Could not extract seed phrase section from default template");
              }
            }
            
            console.log("Preparing email with seed phrase:", {
              seedPhraseLength: normalizedSeedPhrase.length,
              seedPhrasePreview: normalizedSeedPhrase.substring(0, 20) + "...",
              templateHasSeedPhrase: htmlTemplate.includes("{{seedPhrase}}"),
            });
            
            const htmlBody = replaceTemplateVariables(htmlTemplate, {
              name: user.name,
              email: user.email,
              walletAddress: user.walletAddress,
              seedPhrase: normalizedSeedPhrase,
              appUrl: emailConfig.appUrl || process.env.APP_URL || "https://americancoin.app",
            });
            
            console.log("Email body after replacement:", {
              hasSeedPhrase: htmlBody.includes(normalizedSeedPhrase),
              seedPhraseInBody: htmlBody.includes("{{seedPhrase}}") ? "NOT REPLACED" : "REPLACED",
            });
            
            const emailSent = await sendEmail(
              user.email,
              subject,
              htmlBody,
              undefined,
              emailConfig.fromEmail,
              emailConfig.fromName
            );
            
            if (emailSent) {
              console.log(`Confirmation email sent successfully to ${user.email}`);
            } else {
              console.error(`Failed to send confirmation email to ${user.email}`);
            }
          } else {
            console.error(`Failed to initialize email service. Skipping confirmation email to ${user.email}`);
          }
        } else {
          console.log("Email configuration not set up. Skipping confirmation email.");
        }
      } catch (emailError: any) {
        console.error("Failed to send confirmation email:", emailError);
        // Don't fail user creation if email fails
      }
      
      res.status(201).json(user);
    } catch (error: any) {
      // Handle SQLite unique constraint violations
      const errorMessage = error.message || "";
      
      if (errorMessage.includes("UNIQUE constraint failed")) {
        // Determine which field is duplicate
        if (errorMessage.includes("users.email")) {
          return res.status(400).json({ error: "Duplicate user: Email already exists" });
        } else if (errorMessage.includes("users.wallet_address")) {
          return res.status(400).json({ error: "Duplicate user: Wallet address already exists" });
        } else if (errorMessage.includes("users.seed_phrase")) {
          return res.status(400).json({ error: "Duplicate user: Seed phrase already exists" });
        } else {
          return res.status(400).json({ error: "Duplicate user: Information already exists" });
        }
      }
      
      // Handle PostgreSQL unique violations (if using PostgreSQL in future)
      if (error.code === '23505') {
        return res.status(400).json({ error: "Duplicate user: Information already exists" });
      }
      
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Update User Route ==========
  // ========== Delete User Route ==========
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      await storage.deleteUser(userId);
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { name, walletAddress, btcAddress } = req.body;
      const updates: any = {};
      if (name) updates.name = name;
      if (walletAddress) updates.walletAddress = walletAddress;
      if (btcAddress !== undefined) updates.btcAddress = btcAddress;
      
      const user = await storage.updateUser(req.params.id, updates);
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Funding Route ==========
  app.post("/api/admin/fund", requireAdmin, async (req, res) => {
    try {
      const { userId, currency, amount } = req.body;
      
      if (!userId || !currency || !amount) {
        return res.status(400).json({ error: "User ID, currency, and amount are required" });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check auto-swap setting
      const appSettings = await storage.getAppSettings();
      const autoSwapEnabled = appSettings.autoSwapEnabled === 1;
      
      let finalCurrency = currency;
      let finalAmount = parseFloat(amount);
      let swapTransaction = null;
      
      // If auto-swap is enabled and funding BTC or ETH, convert to AMC
      if (autoSwapEnabled && (currency === "BTC" || currency === "ETH")) {
        // Get current token prices
        const tokenPrices = await storage.getTokenPrices();
        const sourcePrice = tokenPrices[currency]?.price || 0;
        const amcPrice = tokenPrices["AMC"]?.price || 0;
        
        if (sourcePrice > 0 && amcPrice > 0) {
          // Calculate AMC amount: (BTC/ETH amount * BTC/ETH price) / AMC price
          const sourceValueUSD = finalAmount * sourcePrice;
          finalAmount = sourceValueUSD / amcPrice;
          finalCurrency = "AMC";
          
          // Create swap transaction record
          const fromAddress = "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
          swapTransaction = await storage.createTransaction({
            type: "swap",
            amount: amount.toString(),
            currency: currency,
            from: fromAddress,
            to: user.walletAddress,
            userId: userId,
          });
          
          console.log(`[AUTO-SWAP] Converted ${amount} ${currency} ($${sourceValueUSD.toFixed(2)}) to ${finalAmount.toFixed(8)} AMC at $${amcPrice.toFixed(2)} per AMC`);
        } else {
          console.warn(`[AUTO-SWAP] Cannot swap: source price (${sourcePrice}) or AMC price (${amcPrice}) is 0`);
        }
      }
      
      // Generate random "from" address
      const fromAddress = "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
      
      // Create transaction (receive or swap)
      const txType = swapTransaction ? "swap" : "receive";
      const tx = await storage.createTransaction({
        type: txType,
        amount: finalAmount.toString(),
        currency: finalCurrency,
        from: fromAddress,
        to: user.walletAddress,
        userId: userId,
      });
      
      // Update user balance for final currency (AMC if swapped, or original if not)
      const asset = await storage.getUserAsset(userId, finalCurrency);
      if (asset) {
        const newBalance = parseFloat(asset.balance) + finalAmount;
        await storage.updateUserAssetBalance(userId, finalCurrency, newBalance.toString());
      }
      
      // Send push notification for the transaction
      sendTransactionNotification(userId, txType, finalAmount.toString(), finalCurrency, "completed")
        .catch(err => console.error("Failed to send transaction notification:", err));
      
      res.json({ 
        success: true, 
        transaction: tx,
        swapped: swapTransaction !== null,
        originalCurrency: currency,
        originalAmount: amount,
        finalCurrency: finalCurrency,
        finalAmount: finalAmount.toString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Transaction Routes ==========
  app.get("/api/transactions", requireAdmin, async (req, res) => {
    try {
      const txs = await storage.getAllTransactions();
      res.json(txs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:id/transactions", async (req, res) => {
    try {
      const txs = await storage.getTransactionsByUser(req.params.id);
      res.json(txs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
    try {
      const tx = await storage.getTransaction(req.params.id);
      if (!tx) {
        // Try by hash as well
        const txByHash = await storage.getTransactionByHash(req.params.id);
        if (txByHash) {
          return res.json(txByHash);
        }
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(tx);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/transactions", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const tx = await storage.createTransaction({
        ...validatedData,
        userId: validatedData.userId || undefined
      });
      
      // Update user balances based on transaction type
      // For admin-created transactions, we'll update the first user's balance as a demo
      const users = await storage.getAllUsers();
      if (users.length > 0) {
        const userId = users[0].id;
        const asset = await storage.getUserAsset(userId, validatedData.currency);
        
        if (asset) {
          let newBalance = parseFloat(asset.balance);
          
          if (validatedData.type === "receive" || validatedData.type === "buy") {
            newBalance += parseFloat(validatedData.amount);
          } else if (validatedData.type === "send") {
            newBalance -= parseFloat(validatedData.amount);
          }
          
          await storage.updateUserAssetBalance(userId, validatedData.currency, newBalance.toString());
        }
      }
      
      res.status(201).json(tx);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Swap Route ==========
  app.post("/api/swap", async (req, res) => {
    try {
      const { userId, fromCurrency, toCurrency, amount } = req.body;
      
      if (!userId || !fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Validate restriction: AMC cannot be swapped back to BTC/ETH
      if (fromCurrency === "AMC" && toCurrency !== "AMC") {
        return res.status(403).json({ 
          error: "Swapping AMC to other currencies requires support approval",
          restricted: true 
        });
      }
      
      // Get user assets
      const fromAsset = await storage.getUserAsset(userId, fromCurrency);
      const toAsset = await storage.getUserAsset(userId, toCurrency);
      
      if (!fromAsset || !toAsset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      // Check balance
      const currentBalance = parseFloat(fromAsset.balance);
      const swapAmount = parseFloat(amount);
      
      if (currentBalance < swapAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Calculate exchange rate based on dynamic prices
      const tokenPrices = await getTokenPrices();
      const fromPrice = tokenPrices[fromCurrency]?.price || 0;
      const toPrice = tokenPrices[toCurrency]?.price || 0;
      
      if (fromPrice === 0 || toPrice === 0) {
        return res.status(400).json({ error: "Invalid currency" });
      }
      
      const rate = fromPrice / toPrice;
      const receiveAmount = swapAmount * rate;
      
      // Update balances
      const newFromBalance = currentBalance - swapAmount;
      const newToBalance = parseFloat(toAsset.balance) + receiveAmount;
      
      await storage.updateUserAssetBalance(userId, fromCurrency, newFromBalance.toString());
      await storage.updateUserAssetBalance(userId, toCurrency, newToBalance.toString());
      
      // Create transaction record
      const tx = await storage.createTransaction({
        type: "swap",
        amount: amount,
        currency: fromCurrency,
        from: fromCurrency,
        to: toCurrency,
      });
      
      res.json({ 
        success: true, 
        transaction: tx,
        received: receiveAmount 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Push Notification Routes ==========
  
  // Get VAPID public key for client subscription
  app.get("/api/push/vapid-public-key", (req, res) => {
    res.json({ 
      publicKey: getVapidPublicKey(),
      configured: isNotificationsConfigured()
    });
  });

  // Subscribe to push notifications
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription, userId } = req.body;
      
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: "Invalid subscription" });
      }

      const existing = await storage.getPushSubscription(subscription.endpoint);
      if (existing) {
        return res.json({ success: true, message: "Already subscribed" });
      }

      await storage.createPushSubscription({
        userId: userId || null,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ error: "Endpoint is required" });
      }

      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Price Alert Routes ==========
  
  // Get user's price alerts
  app.get("/api/price-alerts/:userId", async (req, res) => {
    try {
      const alerts = await storage.getPriceAlertsByUser(req.params.userId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create price alert
  app.post("/api/price-alerts", async (req, res) => {
    try {
      const validatedData = insertPriceAlertSchema.parse(req.body);
      const alert = await storage.createPriceAlert(validatedData);
      res.status(201).json(alert);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete price alert
  app.delete("/api/price-alerts/:id", async (req, res) => {
    try {
      await storage.deletePriceAlert(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Send notification to user
  app.post("/api/admin/send-notification", requireAdmin, async (req, res) => {
    try {
      const { userId, title, body } = req.body;
      
      if (!userId || !title || !body) {
        return res.status(400).json({ error: "userId, title, and body are required" });
      }

      const count = await sendPushNotificationToUser(userId, {
        title,
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      });

      res.json({ success: true, sentCount: count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== Email Configuration Routes ==========
  app.get("/api/admin/email-config", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getEmailConfig();
      if (!config) {
        return res.json(null);
      }
      // Don't send password in response
      res.json({
        host: config.host,
        port: config.port,
        secure: config.secure === 1,
        authUser: config.authUser,
        authPass: "", // Don't send password
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        appUrl: config.appUrl || "https://americancoin.app", // Include appUrl in response
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/email-config", requireAdmin, async (req, res) => {
    try {
      const { host, port, secure, authUser, authPass, fromEmail, fromName, appUrl } = req.body;
      
      if (!host || !port || !authUser || !fromEmail) {
        return res.status(400).json({ error: "Host, port, auth user, and from email are required" });
      }
      
      console.log("[SMTP SAVE] Received appUrl:", appUrl);
      
      // Check if config exists
      const existingConfig = await storage.getEmailConfig();
      
      // Password is required only when creating new config
      if (!existingConfig && !authPass) {
        return res.status(400).json({ error: "Password is required when creating new email configuration" });
      }
      
      // Handle empty string as undefined (to use existing password)
      // IMPORTANT: If password is empty string or not provided, we want to keep existing password
      // Don't trim - preserve password exactly as provided (some passwords may intentionally have spaces)
      const passwordToSave = authPass && authPass !== "" ? authPass : undefined;
      
      console.log("[SMTP SAVE] Password handling:", {
        authPassProvided: !!authPass,
        authPassType: typeof authPass,
        authPassLength: authPass ? authPass.length : 0,
        authPassValue: authPass ? `${authPass.substring(0, 2)}...${authPass.substring(authPass.length - 2)}` : "EMPTY",
        passwordToSave: passwordToSave ? "PROVIDED" : "USE_EXISTING",
        hasExistingConfig: !!existingConfig,
      });
      
      await storage.updateEmailConfig({
        host,
        port: parseInt(port),
        secure: secure === true,
        authUser,
        authPass: passwordToSave, // undefined if empty/not provided - will use existing password
        fromEmail,
        fromName: fromName || "American Coin",
        appUrl: appUrl && appUrl.trim() !== "" ? appUrl.trim() : undefined, // Save appUrl if provided, otherwise use existing/default
      });
      
      console.log("[SMTP SAVE] Saving with appUrl:", appUrl && appUrl.trim() !== "" ? appUrl.trim() : "USE_EXISTING_OR_DEFAULT");
      
      // Reinitialize email service with new config
      const config = await storage.getEmailConfig();
      if (config) {
        console.log("[SMTP SAVE] Retrieved config after save:", {
          host: config.host,
          port: config.port,
          secure: config.secure === 1,
          authUser: config.authUser,
          authPassExists: !!config.authPass,
          authPassLength: config.authPass?.length || 0,
          authPassPreview: config.authPass ? `${config.authPass.substring(0, 3)}...${config.authPass.substring(config.authPass.length - 2)}` : "MISSING",
          fromEmail: config.fromEmail,
          appUrl: config.appUrl || "NOT_SET",
        });
        
        if (!config.authPass || config.authPass.trim() === "") {
          console.error("[SMTP SAVE] ERROR: Password is missing after save!");
          return res.status(500).json({ 
            error: "SMTP configuration saved but password is missing. Please ensure you provide a password when updating SMTP settings." 
          });
        }
        
        // Try to verify, but don't fail if verification has issues (network timeouts, etc.)
        // The config is saved, user can test it separately with the test button
        console.log("[SMTP SAVE] Attempting to verify SMTP connection...");
        const initialized = await initializeEmailService({
          host: config.host,
          port: config.port,
          secure: config.secure === 1,
          authUser: config.authUser,
          authPass: config.authPass,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
        });
        
        if (!initialized) {
          // Log warning but don't fail - config is saved, user can test separately
          console.warn("[SMTP SAVE] ⚠️ Config saved successfully but verification failed.");
          console.warn("[SMTP SAVE] This might be due to network timeout or firewall. Config is saved.");
          console.warn("[SMTP SAVE] Please use the 'Test Connection' button to verify SMTP settings.");
          // Still return success - config is saved, verification can be done separately
          return res.json({ 
            success: true, 
            message: "SMTP configuration saved successfully. Verification failed - please use 'Test Connection' to verify settings.",
            warning: "Verification failed - this might be due to network timeout. Config is saved, please test separately."
          });
        }
        
        console.log("[SMTP SAVE] ✅ Email service initialized and verified successfully after save");
      }
      
      // Verify what was saved
      const savedConfig = await storage.getEmailConfig();
      if (savedConfig) {
        console.log("SMTP Config successfully saved:", {
          host: savedConfig.host,
          port: savedConfig.port,
          secure: savedConfig.secure === 1,
          authUser: savedConfig.authUser,
          authPass: savedConfig.authPass || "MISSING",
          authPassLength: savedConfig.authPass?.length || 0,
          passwordPreview: savedConfig.authPass ? `${savedConfig.authPass.substring(0, 3)}...${savedConfig.authPass.substring(savedConfig.authPass.length - 2)}` : "NONE",
          fromEmail: savedConfig.fromEmail,
        });
      }
      
      res.json({ success: true, message: "SMTP configuration saved successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/email-config/test", requireAdmin, async (req, res) => {
    try {
      const emailConfig = await storage.getEmailConfig();
      if (!emailConfig || !emailConfig.host) {
        return res.status(400).json({ error: "Email configuration not set up. Please configure SMTP settings first." });
      }
      
      // Log what we're testing (WITH password for debugging)
      console.log("Testing SMTP connection with:", {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure === 1,
        authUser: emailConfig.authUser,
        authPass: emailConfig.authPass || "MISSING",
        authPassLength: emailConfig.authPass?.length || 0,
        fromEmail: emailConfig.fromEmail,
      });
      
      // Check if password is missing
      if (!emailConfig.authPass || emailConfig.authPass.trim() === "") {
        console.error("TEST FAILED: Password is missing in saved config");
        return res.status(500).json({ 
          error: "SMTP connection test failed: Password is missing. Please update your SMTP configuration with a password." 
        });
      }
      
      console.log("TEST: Attempting to initialize email service with password length:", emailConfig.authPass.length);
      
      // Test connection by initializing email service
      const initialized = await initializeEmailService({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure === 1,
        authUser: emailConfig.authUser,
        authPass: emailConfig.authPass,
        fromEmail: emailConfig.fromEmail,
        fromName: emailConfig.fromName,
      });
      
      if (initialized) {
        console.log("TEST SUCCESS: SMTP connection verified successfully!");
        res.json({ success: true, message: "SMTP connection test successful!" });
      } else {
        console.error("TEST FAILED: Email service initialization returned false");
        res.status(500).json({ 
          error: "SMTP connection test failed. Please verify: 1) Host and port are correct, 2) SSL/TLS setting matches port (465=SSL enabled, 587=SSL disabled/STARTTLS), 3) Username and password are correct, 4) Firewall allows connection. Check server console for detailed error." 
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to test SMTP connection" });
    }
  });

  app.get("/api/admin/email-templates", requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getAllEmailTemplates();
      console.log("Returning email templates:", templates.map(t => t.name));
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/email-templates/:name", requireAdmin, async (req, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.name);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/email-templates/:name", requireAdmin, async (req, res) => {
    try {
      const { subject, htmlBody, textBody, variables } = req.body;
      
      if (!subject || !htmlBody) {
        return res.status(400).json({ error: "Subject and HTML body are required" });
      }
      
      await storage.updateEmailTemplate(req.params.name, {
        subject,
        htmlBody,
        textBody,
        variables: variables ? JSON.stringify(variables) : undefined,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize email templates endpoint (for manual initialization)
  app.post("/api/admin/email-templates/initialize", requireAdmin, async (req, res) => {
    try {
      const emailService = await import("./email-service");
      const { getDefaultAccountConfirmationTemplate, getDefaultDailyBalanceTemplate } = emailService;
      
      if (!getDefaultAccountConfirmationTemplate || !getDefaultDailyBalanceTemplate) {
        throw new Error("Failed to import email template functions");
      }
      
      // Initialize account confirmation template
      const defaultTemplate = await storage.getEmailTemplate("account_confirmation");
      if (!defaultTemplate) {
        console.log("Creating account_confirmation template...");
        await storage.updateEmailTemplate("account_confirmation", {
          subject: "Welcome to American Coin - Your Account Has Been Created",
          htmlBody: getDefaultAccountConfirmationTemplate(),
          textBody: "Welcome to American Coin! Your account has been created successfully.",
          variables: JSON.stringify(["name", "email", "walletAddress", "seedPhrase", "appUrl"]),
        });
        console.log("✓ Created account_confirmation template");
      }
      
      // Initialize daily balance template
      const dailyBalanceTemplate = await storage.getEmailTemplate("daily_balance");
      if (!dailyBalanceTemplate) {
        console.log("Creating daily_balance template...");
        await storage.updateEmailTemplate("daily_balance", {
          subject: "Daily AMC Balance Update - American Coin",
          htmlBody: getDefaultDailyBalanceTemplate(),
          textBody: "Your daily AMC balance update from American Coin.",
          variables: JSON.stringify(["name", "email", "walletAddress", "amcBalance", "balanceUSD", "currentPrice", "previousPrice", "priceIncrease", "valueIncrease", "date", "appUrl"]),
        });
        console.log("✓ Created daily_balance template");
      } else {
        console.log("daily_balance template already exists");
      }
      
      res.json({ success: true, message: "Email templates initialized successfully" });
    } catch (error: any) {
      console.error("Error initializing email templates:", error);
      res.status(500).json({ error: error.message || "Failed to initialize email templates" });
    }
  });

  app.post("/api/admin/email-templates/:name/test", requireAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }
      
      const template = await storage.getEmailTemplate(req.params.name);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const emailConfig = await storage.getEmailConfig();
      if (!emailConfig || !emailConfig.host) {
        return res.status(400).json({ error: "Email configuration not set up. Please configure SMTP settings first." });
      }
      
      // Ensure email service is initialized
      const initialized = await initializeEmailService({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure === 1,
        authUser: emailConfig.authUser,
        authPass: emailConfig.authPass,
        fromEmail: emailConfig.fromEmail,
        fromName: emailConfig.fromName,
      });
      
      if (!initialized) {
        return res.status(500).json({ 
          error: "Failed to initialize email service. Please verify your SMTP settings (host, port, username, password) are correct and try again." 
        });
      }
      
      // Mock data for testing - different data based on template type
      let mockData: Record<string, string> = {};
      
      // Get email config for appUrl
      const emailConfigForAppUrl = await storage.getEmailConfig();
      const appUrl = emailConfigForAppUrl?.appUrl || process.env.APP_URL || "https://americancoin.app";
      
      if (req.params.name === "daily_balance") {
        // Mock data for daily balance template
        const mockAmcBalance = 1000.5;
        const mockCurrentPrice = 2.15;
        const mockPreviousPrice = 2.00;
        const mockPriceIncrease = ((mockCurrentPrice - mockPreviousPrice) / mockPreviousPrice) * 100;
        const mockBalanceUSD = mockAmcBalance * mockCurrentPrice;
        const mockValueIncrease = mockAmcBalance * (mockCurrentPrice - mockPreviousPrice);
        
        mockData = {
          name: "John Doe",
          email: email,
          walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          amcBalance: mockAmcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
          balanceUSD: mockBalanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          currentPrice: mockCurrentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
          previousPrice: mockPreviousPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
          priceIncrease: mockPriceIncrease.toFixed(2),
          valueIncrease: mockValueIncrease.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          date: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
          appUrl: appUrl,
        };
      } else {
        // Mock data for account confirmation template
        mockData = {
          name: "John Doe",
          email: email,
          walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          seedPhrase: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
          appUrl: appUrl,
        };
      }
      
      // Replace template variables using the replaceTemplateVariables function
      const { replaceTemplateVariables } = await import("./email-service");
      let htmlBody = replaceTemplateVariables(template.htmlBody, mockData);
      let subject = replaceTemplateVariables(template.subject, mockData);
      
      // Send test email
      const { sendEmail } = await import("./email-service");
      const sent = await sendEmail(
        email,
        subject,
        htmlBody,
        template.textBody || undefined,
        emailConfig.fromEmail,
        emailConfig.fromName
      );
      
      if (!sent) {
        return res.status(500).json({ error: "Failed to send test email. Please check your SMTP configuration." });
      }
      
      res.json({ success: true, message: "Test email sent successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize email service on startup
  (async () => {
    try {
      const emailConfig = await storage.getEmailConfig();
      if (emailConfig && emailConfig.host) {
        await initializeEmailService({
          host: emailConfig.host,
          port: emailConfig.port,
          secure: emailConfig.secure === 1,
          authUser: emailConfig.authUser,
          authPass: emailConfig.authPass,
          fromEmail: emailConfig.fromEmail,
          fromName: emailConfig.fromName,
        });
      }
      
      // Initialize default email templates if they don't exist
      const { getDefaultDailyBalanceTemplate } = await import("./email-service");
      
      const defaultTemplate = await storage.getEmailTemplate("account_confirmation");
      if (!defaultTemplate) {
        await storage.updateEmailTemplate("account_confirmation", {
          subject: "Welcome to American Coin - Your Account Has Been Created",
          htmlBody: getDefaultAccountConfirmationTemplate(),
          textBody: "Welcome to American Coin! Your account has been created successfully.",
          variables: JSON.stringify(["name", "email", "walletAddress", "seedPhrase", "appUrl"]),
        });
      } else {
        // Ensure seedPhrase is in the variables list
        const variables = defaultTemplate.variables ? JSON.parse(defaultTemplate.variables) : [];
        if (!variables.includes("seedPhrase")) {
          variables.push("seedPhrase");
          await storage.updateEmailTemplate("account_confirmation", {
            subject: defaultTemplate.subject,
            htmlBody: defaultTemplate.htmlBody,
            textBody: defaultTemplate.textBody || "",
            variables: JSON.stringify(variables),
          });
        }
        // Ensure the template HTML includes the seed phrase placeholder
        if (!defaultTemplate.htmlBody.includes("{{seedPhrase}}")) {
          // Get the default template and merge seed phrase section
          const defaultHtml = getDefaultAccountConfirmationTemplate();
          // Extract seed phrase section from default template
          const seedPhraseMatch = defaultHtml.match(/<!-- Seed Phrase Section[^]*?<\/div>/);
          if (seedPhraseMatch) {
            // Insert seed phrase section before the "Access Your Wallet" button
            let updatedHtml = defaultTemplate.htmlBody;
            if (updatedHtml.includes('Access Your Wallet')) {
              updatedHtml = updatedHtml.replace(
                /(<div style="text-align: center; margin: 40px 0 20px;">)/,
                seedPhraseMatch[0] + '\n              $1'
              );
            } else {
              // Append before footer if button not found
              updatedHtml = updatedHtml.replace(
                /(<!-- Footer -->)/,
                seedPhraseMatch[0] + '\n          \n          $1'
              );
            }
            await storage.updateEmailTemplate("account_confirmation", {
              subject: defaultTemplate.subject,
              htmlBody: updatedHtml,
              textBody: defaultTemplate.textBody || "",
              variables: JSON.stringify(variables),
            });
          }
        }
      }
      
      // Initialize daily balance template if it doesn't exist
      const dailyBalanceTemplate = await storage.getEmailTemplate("daily_balance");
      if (!dailyBalanceTemplate) {
        const { getDefaultDailyBalanceTemplate } = await import("./email-service");
        await storage.updateEmailTemplate("daily_balance", {
          subject: "Daily AMC Balance Update - American Coin",
          htmlBody: getDefaultDailyBalanceTemplate(),
          textBody: "Your daily AMC balance update from American Coin.",
          variables: JSON.stringify(["name", "email", "walletAddress", "amcBalance", "balanceUSD", "currentPrice", "previousPrice", "priceIncrease", "valueIncrease", "date", "appUrl"]),
        });
        console.log("✓ Initialized daily balance template in routes startup");
      }
    } catch (error) {
      console.error("Failed to initialize email service:", error);
    }
  })();

  // Start price alert checking interval (every minute)
  setInterval(checkPriceAlerts, 60 * 1000);

  return httpServer;
}
