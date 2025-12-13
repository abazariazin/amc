import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  walletAddress: text("wallet_address").notNull().unique(),
  seedPhrase: text("seed_phrase").notNull().unique(),
  btcAddress: text("btc_address"),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: text("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("completed"),
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  from: text("from"),
  to: text("to"),
  hash: text("hash").notNull().unique(),
}, (table) => ({
  currencyIdx: index("transactions_currency_idx").on(table.currency),
  dateIdx: index("transactions_date_idx").on(table.date),
  userIdx: index("transactions_user_idx").on(table.userId),
}));

export const userAssets = sqliteTable("user_assets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  balance: text("balance").notNull().default("0"),
}, (table) => ({
  userSymbolIdx: index("user_assets_user_symbol_idx").on(table.userId, table.symbol),
}));

export const tokenConfigs = sqliteTable("token_configs", {
  symbol: text("symbol").primaryKey(),
  displayName: text("display_name").notNull(),
  currentPrice: text("current_price").notNull(),
  basePrice: text("base_price").notNull(),
  lastUpdatedAt: integer("last_updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  autoMode: text("auto_mode").notNull().default("none"),
  changeRate: text("change_rate").notNull().default("0"),
  changeIntervalMinutes: integer("change_interval_minutes").notNull().default(60),
  cycleDirection: text("cycle_direction").default("increase"),
  cycleIncreaseCount: integer("cycle_increase_count").default(3), // How many increases before one decrease
  cycleCurrentCount: integer("cycle_current_count").default(0), // Current counter for cycle
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index("push_subscriptions_user_idx").on(table.userId),
}));

export const priceAlerts = sqliteTable("price_alerts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  targetPrice: text("target_price").notNull(),
  condition: text("condition").notNull(),
  isActive: text("is_active").notNull().default("true"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  triggeredAt: integer("triggered_at", { mode: "timestamp" }),
}, (table) => ({
  userIdx: index("price_alerts_user_idx").on(table.userId),
  symbolIdx: index("price_alerts_symbol_idx").on(table.symbol),
}));

export const emailConfig = sqliteTable("email_config", {
  id: text("id").primaryKey().$defaultFn(() => "1"), // Single row
  host: text("host").notNull(),
  port: integer("port").notNull(),
  secure: integer("secure").notNull().default(0), // 0 = false, 1 = true
  authUser: text("auth_user").notNull(),
  authPass: text("auth_pass").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull().default("American Coin"),
  appUrl: text("app_url").default("https://americancoin.app"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const emailTemplates = sqliteTable("email_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body"),
  variables: text("variables"), // JSON array of available variables
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey().$defaultFn(() => "1"), // Single row
  autoSwapEnabled: integer("auto_swap_enabled").notNull().default(0), // 0 = false, 1 = true
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const otpCodes = sqliteTable("otp_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  code: text("code").notNull(),
  seedPhrase: text("seed_phrase").notNull(), // Encrypted seed phrase for auto-import
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  used: integer("used").notNull().default(0), // 0 = false, 1 = true
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  emailIdx: index("otp_codes_email_idx").on(table.email),
  codeIdx: index("otp_codes_code_idx").on(table.code),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  hash: true,
  date: true,
  status: true,
});

export const insertUserAssetSchema = createInsertSchema(userAssets).omit({
  id: true,
});

export const insertTokenConfigSchema = createInsertSchema(tokenConfigs);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
  triggeredAt: true,
  isActive: true,
});

export const updateTokenConfigSchema = z.object({
  displayName: z.string().optional(),
  currentPrice: z.string().optional(),
  basePrice: z.string().optional(),
  autoMode: z.enum(["none", "increase", "decrease", "cycle"]).optional(),
  changeRate: z.string().optional(),
  changeIntervalMinutes: z.number().optional(),
  cycleDirection: z.enum(["increase", "decrease"]).optional(),
  cycleIncreaseCount: z.number().optional(), // How many increases before one decrease
  cycleCurrentCount: z.number().optional(), // Current counter for cycle
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertUserAsset = z.infer<typeof insertUserAssetSchema>;
export type UserAsset = typeof userAssets.$inferSelect;

export type InsertTokenConfig = z.infer<typeof insertTokenConfigSchema>;
export type TokenConfig = typeof tokenConfigs.$inferSelect;
export type UpdateTokenConfig = z.infer<typeof updateTokenConfigSchema>;

export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;
