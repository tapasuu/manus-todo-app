import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, todos, InsertUser, InsertTodo, Todo, User } from "../drizzle/schema";
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

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return result[0];
}

// 開発用ユーザーを作成または取得
export async function getOrCreateDevUser(): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const devOpenId = "dev-user-001";

  // 既存のdevユーザーを検索
  let devUser = await getUserByOpenId(devOpenId);

  if (!devUser) {
    // 存在しなければ作成
    await db.insert(users).values({
      openId: devOpenId,
      name: "開発ユーザー",
      email: "dev@example.com",
      loginMethod: "dev",
      role: "user",
    });
    devUser = await getUserByOpenId(devOpenId);
  }

  return devUser;
}

// Todo関連
export async function createTodo(data: InsertTodo): Promise<Todo | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(todos).values(data);
  const insertId = result[0].insertId;

  // 作成したTodoを取得
  const created = await db
    .select()
    .from(todos)
    .where(eq(todos.id, insertId))
    .limit(1);

  return created[0];
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
