import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);

const MemoryStore = createMemoryStore(session);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Trust proxy for correct IP and protocol detection (needed for Cloudflare Tunnel)
app.set("trust proxy", 1);

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  }
  next();
});

// CORS middleware for API routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow requests from same origin or configured APP_URL
  const allowedOrigin = process.env.APP_URL || origin;
  
  if (origin && allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "american-coin-secret-key-change-in-production",
    resave: true, // Changed to true to ensure session is saved on every request
    saveUninitialized: true, // Changed to true to save sessions even if not modified
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
    name: "connect.sid", // Explicit session cookie name
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      // In production with proxy (Cloudflare), secure should be true
      // Trust proxy is set above to detect HTTPS properly
      secure: process.env.NODE_ENV === "production",
      sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "lax" | "none" | "strict", // "none" needed for cross-origin in production
      path: "/", // Explicitly set path to root
    },
  })
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database tables and default data
  await storage.initializeDatabase();
  await storage.initializeTokenConfigs();
  
  // Initialize default email templates
  try {
    const emailService = await import("./email-service");
    const { getDefaultAccountConfirmationTemplate, getDefaultDailyBalanceTemplate } = emailService;
    
    if (!getDefaultAccountConfirmationTemplate) {
      throw new Error("getDefaultAccountConfirmationTemplate function not found");
    }
    if (!getDefaultDailyBalanceTemplate) {
      throw new Error("getDefaultDailyBalanceTemplate function not found");
    }
    
    log("Starting email template initialization...");
    
    // Initialize account confirmation template
    const defaultTemplate = await storage.getEmailTemplate("account_confirmation");
    if (!defaultTemplate) {
      log("Creating account_confirmation template...");
      await storage.updateEmailTemplate("account_confirmation", {
        subject: "Welcome to American Coin - Your Account Has Been Created",
        htmlBody: getDefaultAccountConfirmationTemplate(),
        textBody: "Welcome to American Coin! Your account has been created successfully.",
        variables: JSON.stringify(["name", "email", "walletAddress", "seedPhrase", "appUrl"]),
      });
      log("✓ Initialized account_confirmation template");
    } else {
      log("Account confirmation template already exists");
    }

    // Initialize daily balance template
    const dailyBalanceTemplate = await storage.getEmailTemplate("daily_balance");
    if (!dailyBalanceTemplate) {
      log("Creating daily_balance template...");
      const dailyBalanceHtml = getDefaultDailyBalanceTemplate();
      if (!dailyBalanceHtml || dailyBalanceHtml.length === 0) {
        throw new Error("getDefaultDailyBalanceTemplate returned empty string");
      }
      await storage.updateEmailTemplate("daily_balance", {
        subject: "Daily AMC Balance Update - American Coin",
        htmlBody: dailyBalanceHtml,
        textBody: "Your daily AMC balance update from American Coin.",
        variables: JSON.stringify(["name", "email", "walletAddress", "amcBalance", "balanceUSD", "currentPrice", "previousPrice", "priceIncrease", "valueIncrease", "date", "appUrl"]),
      });
      log("✓ Initialized daily_balance template");
    } else {
      log("Daily balance template already exists");
    }
    
    log("Email template initialization completed successfully");
  } catch (error: any) {
    log(`Failed to initialize email templates: ${error?.message || error}`, "email-service");
    console.error("Email template initialization error details:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
  
  // Start periodic price updates for BTC/ETH (every 60 seconds)
  const { getCachedOrFetchPrices } = await import("./price-service");
  setInterval(async () => {
    try {
      await getCachedOrFetchPrices();
      log("Updated BTC/ETH prices from CoinGecko");
    } catch (error) {
      log(`Error updating prices: ${error}`, "price-service");
    }
  }, 60 * 1000);
  
  // Initial price fetch
  getCachedOrFetchPrices().catch(err => {
    log(`Initial price fetch failed: ${err}`, "price-service");
  });

  // Schedule daily balance emails (runs every 24 hours at midnight)
  const { sendDailyBalanceEmails } = await import("./email-service");
  
  // Calculate milliseconds until next midnight
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();
  
  // Set initial timeout to run at midnight
  setTimeout(() => {
    // Run immediately at midnight
    sendDailyBalanceEmails(storage).catch(err => {
      log(`Error sending daily balance emails: ${err}`, "email-service");
    });
    
    // Then schedule to run every 24 hours
    setInterval(() => {
      sendDailyBalanceEmails(storage).catch(err => {
        log(`Error sending daily balance emails: ${err}`, "email-service");
      });
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
  }, msUntilMidnight);
  
  log(`Daily balance emails scheduled to run at midnight and every 24 hours thereafter`);
  
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Only serve static files in production (Vite handles frontend in dev)
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10); // Changed default to 5000 for dev
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
