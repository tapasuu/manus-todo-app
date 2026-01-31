import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cookie from "cookie";
import * as jose from "jose";
import path from "path";
import { fileURLToPath } from "url";
import { appRouter } from "./routers";
import { ENV } from "./env";
import { getUserByOpenId, upsertUser, getOrCreateDevUser } from "./db";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import type { TrpcContext } from "./context";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// JWT シークレットキー
const secret = new TextEncoder().encode(ENV.cookieSecret);

// 開発モード判定
const isDevMode = ENV.isDevMode;

if (isDevMode) {
  console.log("========================================");
  console.log("  開発モードで起動中 (DEV_MODE=true)");
  console.log("  - ダミーログイン有効");
  console.log("  - MySQL: " + ENV.databaseUrl.split("@")[1]?.split("/")[0]);
  console.log("========================================");
}

// ユーザー取得ミドルウェア
async function getUserFromCookie(
  cookieHeader: string | undefined
): Promise<TrpcContext["user"]> {
  // 開発モード: クッキーがなければ開発ユーザーを返す
  if (isDevMode && !cookieHeader) {
    return await getOrCreateDevUser() ?? null;
  }

  if (!cookieHeader) return null;

  try {
    const cookies = cookie.parse(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) {
      // 開発モードならdevユーザーを返す
      if (isDevMode) {
        return await getOrCreateDevUser() ?? null;
      }
      return null;
    }

    const { payload } = await jose.jwtVerify(token, secret);
    const openId = payload.sub;
    if (!openId) return null;

    return (await getUserByOpenId(openId)) ?? null;
  } catch {
    // 開発モードならdevユーザーを返す
    if (isDevMode) {
      return await getOrCreateDevUser() ?? null;
    }
    return null;
  }
}

// tRPC ミドルウェア
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req, res }): Promise<TrpcContext> => {
      const user = await getUserFromCookie(req.headers.cookie);
      return { user, req, res };
    },
  })
);

// 開発モード用: 自動ログインエンドポイント
if (isDevMode) {
  app.get("/api/dev/auto-login", async (_req, res) => {
    const devUser = await getOrCreateDevUser();
    if (!devUser) {
      return res.status(500).send("Dev user not available");
    }

    const jwt = await new jose.SignJWT({ sub: devUser.openId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1y")
      .sign(secret);

    res.cookie(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: ONE_YEAR_MS,
    });

    res.redirect("/");
  });
}

// OAuth コールバック（Manus環境用）
app.get("/api/oauth/callback", async (req, res) => {
  // 開発モードではスキップ
  if (isDevMode) {
    return res.redirect("/api/dev/auto-login");
  }

  const { token, state } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).send("Missing token");
  }

  try {
    // Manus OAuth サーバーからユーザー情報を取得
    const userInfoRes = await fetch(
      `${ENV.oAuthServerUrl}/api/userinfo?token=${token}`
    );
    if (!userInfoRes.ok) {
      throw new Error("Failed to get user info");
    }

    const userInfo = (await userInfoRes.json()) as {
      openId: string;
      name?: string;
      email?: string;
      loginMethod?: string;
    };

    // ユーザーをDB に保存/更新
    await upsertUser({
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod,
      lastSignedIn: new Date(),
    });

    // セッションクッキーを設定
    const jwt = await new jose.SignJWT({ sub: userInfo.openId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1y")
      .sign(secret);

    res.cookie(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: "lax",
      maxAge: ONE_YEAR_MS,
    });

    // リダイレクト
    const redirectPath =
      typeof state === "string" ? decodeURIComponent(state) : "/";
    res.redirect(redirectPath);
  } catch (error) {
    console.error("[OAuth] Callback error:", error);
    res.status(500).send("Authentication failed");
  }
});

// 本番環境では静的ファイルを配信
if (ENV.isProduction) {
  const publicPath = path.join(__dirname, "public");
  app.use(express.static(publicPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
