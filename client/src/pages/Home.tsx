import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, LogOut, CheckCircle2, Circle } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [newTodo, setNewTodo] = useState("");
  const utils = trpc.useUtils();

  const { data: todos, isLoading: todosLoading } = trpc.todos.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const createTodo = trpc.todos.create.useMutation({
    onSuccess: () => {
      utils.todos.list.invalidate();
      setNewTodo("");
      toast.success("Todoを追加しました");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleTodo = trpc.todos.toggle.useMutation({
    onSuccess: () => {
      utils.todos.list.invalidate();
    },
  });

  const deleteTodo = trpc.todos.delete.useMutation({
    onSuccess: () => {
      utils.todos.list.invalidate();
      toast.success("Todoを削除しました");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodo.trim()) {
      createTodo.mutate({ title: newTodo.trim() });
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("ログアウトしました");
  };

  // ローディング中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // 未認証
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <CheckCircle2 className="w-16 h-16 mx-auto text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Todo App</h1>
            <p className="text-muted-foreground mb-8">
              シンプルで使いやすいTodoアプリ。
              <br />
              タスクを管理して、生産性を向上させましょう。
            </p>
            <Button asChild size="lg" className="w-full">
              <a href={getLoginUrl()}>ログインして始める</a>
            </Button>
          </div>
        </main>
        <footer className="py-4 text-center text-sm text-muted-foreground">
          Powered by Manus
        </footer>
      </div>
    );
  }

  // 認証済み
  const completedCount = todos?.filter((t) => t.completed).length ?? 0;
  const totalCount = todos?.length ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ヘッダー */}
      <header className="border-b bg-card">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span className="font-semibold">Todo App</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="flex-1 container py-8">
        <div className="max-w-lg mx-auto">
          {/* 入力フォーム */}
          <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
            <Input
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="新しいTodoを入力..."
              className="flex-1"
              disabled={createTodo.isPending}
            />
            <Button type="submit" disabled={createTodo.isPending || !newTodo.trim()}>
              追加
            </Button>
          </form>

          {/* 進捗 */}
          {totalCount > 0 && (
            <div className="mb-4 text-sm text-muted-foreground">
              {completedCount} / {totalCount} 完了
            </div>
          )}

          {/* Todo リスト */}
          {todosLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              読み込み中...
            </div>
          ) : todos?.length === 0 ? (
            <div className="text-center py-12">
              <Circle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Todoがありません。
                <br />
                上のフォームから追加してください。
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {todos?.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center gap-3 p-3 bg-card border rounded-lg group"
                >
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => toggleTodo.mutate({ id: todo.id })}
                    disabled={toggleTodo.isPending}
                  />
                  <span
                    className={`flex-1 ${
                      todo.completed
                        ? "line-through text-muted-foreground"
                        : ""
                    }`}
                  >
                    {todo.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTodo.mutate({ id: todo.id })}
                    disabled={deleteTodo.isPending}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
