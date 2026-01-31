import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <Toaster position="top-right" />
      <Router />
    </TooltipProvider>
  );
}
