import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/mysql-core";

// ユーザーテーブル（Manus-OAuth 連携用）
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// Todoテーブル
export const todos = mysqlTable("todos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 型エクスポート
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Todo = typeof todos.$inferSelect;
export type InsertTodo = typeof todos.$inferInsert;
