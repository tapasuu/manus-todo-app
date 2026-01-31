import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cookie from "cookie";
import * as jose from "jose";
import path from "path";
import { fileURLToPath } from "url";
import { appRouter } from "./routers";
import { ENV } from "./env";
import { getUserByOpenId, upsertUser } from "./db";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import type { TrpcContext } from "./context";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// JWT シークレットキー
const secret = new TextEncoder().encode(ENV.cookieSecret);

// ユーザー取得ミドルウェア
async function getUserFromCookie(
  cookieHeader: string | undefined
): Promise<TrpcContext["user"]> {
  if (!cookieHeader) return null;

  try {
    const cookies = cookie.parse(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;

    const { payload } = await jose.jwtVerify(token, secret);
    const openId = payload.sub;
    if (!openId) return null;

    return (await getUserByOpenId(openId)) ?? null;
  } catch {
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

// OAuth コールバック（Manus環境用）
app.get("/api/oauth/callback", async (req, res) => {
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
  console.log(`Server running on port ${PORT}`);
});
