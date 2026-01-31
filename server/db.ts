import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, todos, InsertUser, InsertTodo, Todo } from "../drizzle/schema";
import { ENV } from "./env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ユーザー関連
export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db || !user.openId) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  if (user.name !== undefined) {
    values.name = user.name;
    updateSet.name = user.name;
  }
  if (user.email !== undefined) {
    values.email = user.email;
    updateSet.email = user.email;
  }
  if (user.loginMethod !== undefined) {
    values.loginMethod = user.loginMethod;
    updateSet.loginMethod = user.loginMethod;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  // オーナーは自動的に admin に
  if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0];
}

// Todo関連
export async function createTodo(data: InsertTodo): Promise<Todo | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(todos).values(data);

  // 作成したTodoを取得
  const result = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, data.userId))
    .orderBy(todos.id)
    .limit(1);

  return result[0];
}

export async function getTodosByUserId(userId: number): Promise<Todo[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId))
    .orderBy(todos.createdAt);
}

export async function getTodoById(id: number, userId: number): Promise<Todo | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .limit(1);

  return result[0];
}

export async function updateTodo(
  id: number,
  userId: number,
  data: Partial<InsertTodo>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(todos)
    .set(data)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)));
}

export async function deleteTodo(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, userId)));
}
