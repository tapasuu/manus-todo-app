import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { publicProcedure, protectedProcedure, router } from "./trpc";
import * as db from "./db";

export const appRouter = router({
  // 認証
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME);
      return { success: true };
    }),
  }),

  // Todo
  todos: router({
    // 一覧取得
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getTodosByUserId(ctx.user.id);
    }),

    // 作成
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1, "タイトルは必須です").max(255),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createTodo({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
        });
      }),

    // 更新
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          completed: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateTodo(id, ctx.user.id, data);
        return { success: true };
      }),

    // 完了状態の切り替え
    toggle: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const todo = await db.getTodoById(input.id, ctx.user.id);
        if (!todo) {
          throw new Error("Todo not found");
        }
        await db.updateTodo(input.id, ctx.user.id, {
          completed: !todo.completed,
        });
        return { success: true };
      }),

    // 削除
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteTodo(input.id, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
