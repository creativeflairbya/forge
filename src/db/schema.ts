import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

// A project is a single WebApp workspace built with the AI.
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  framework: text("framework").notNull().default("vanilla"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Chat messages between the user and the AI for a project.
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  // Optional structured data about generated files for assistant turns.
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Generated code files that make up the WebApp.
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  content: text("content").notNull().default(""),
  language: text("language").notNull().default("plaintext"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type FileRow = typeof files.$inferSelect;
export type NewFileRow = typeof files.$inferInsert;

// Stored AI chart-image analyses + their computed technical context.
export const chartAnalyses = pgTable("chart_analyses", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().default(""),
  timeframe: text("timeframe").notNull().default(""),
  verdict: text("verdict").notNull().default("HOLD"),
  confidence: integer("confidence").notNull().default(0),
  analysis: text("analysis").notNull().default(""),
  indicators: jsonb("indicators"),
  source: text("source").notNull().default("gemini"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChartAnalysis = typeof chartAnalyses.$inferSelect;
export type NewChartAnalysis = typeof chartAnalyses.$inferInsert;

// Provider API keys — the admin-managed vault. Never exposed to the client raw.
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(), // "gemini" | "openai"
  keyValue: text("key_value").notNull(),
  tier: text("tier").notNull().default("free"), // "free" | "paid"
  status: text("status").notNull().default("active"), // active | limited | invalid | disabled
  note: text("note").notNull().default(""),
  lastError: text("last_error").notNull().default(""),
  lastStatusCode: integer("last_status_code"),
  limitedAt: timestamp("limited_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Real per-call usage log. No synthetic numbers — one row per actual API call.
export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  endpoint: text("endpoint").notNull().default(""),
  ok: boolean("ok").notNull().default(true),
  statusCode: integer("status_code"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  error: text("error").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Admin credentials + server secrets (single-admin system).
export const adminConfig = pgTable("admin_config", {
  id: serial("id").primaryKey(),
  configKey: text("config_key").notNull().unique(),
  configValue: text("config_value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Regular users created & managed by the master admin.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  canSignals: boolean("can_signals").notNull().default(true),
  canAnalyze: boolean("can_analyze").notNull().default(false),
  canGenerate: boolean("can_generate").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type AdminConfig = typeof adminConfig.$inferSelect;
export type User = typeof users.$inferSelect;
