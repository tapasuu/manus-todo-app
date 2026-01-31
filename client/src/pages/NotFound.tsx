import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-8">ページが見つかりません</p>
      <Button asChild>
        <Link href="/">ホームに戻る</Link>
      </Button>
    </div>
  );
}
