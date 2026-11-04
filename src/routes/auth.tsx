import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { isValidUsername, normalizeUsername, usernameToEmail } from "@/lib/auth";

const T = {
  title: "מעקב בדיקות רכבים",
  signIn: "כניסה",
  signUp: "יצירת משתמש",
  username: "שם משתמש",
  password: "סיסמה",
  toSignUp: "אין לך משתמש? צור משתמש חדש",
  toSignIn: "יש לך משתמש? היכנס",
  badUsername: "שם משתמש: 3-30 תווים, אותיות באנגלית, ספרות, נקודה, מקף או קו תחתון",
  shortPassword: "הסיסמה חייבת להכיל לפחות 6 תווים",
  badLogin: "שם משתמש או סיסמה שגויים",
  taken: "שם המשתמש כבר תפוס",
  weak: "הסיסמה חלשה מדי או נפוצה מדי, בחר סיסמה אחרת",
  error: "שגיאה, נסה שוב",
};

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "כניסה — מעקב בדיקות רכבים" },
      { name: "description", content: "כניסה או יצירת משתמש במערכת מעקב בדיקות רכבים" },
      { property: "og:title", content: "כניסה — מעקב בדיקות רכבים" },
      { property: "og:description", content: "כניסה או יצירת משתמש במערכת מעקב בדיקות רכבים" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUsername(username)) return toast.error(T.badUsername);
    if (password.length < 6) return toast.error(T.shortPassword);
    setBusy(true);
    try {
      const email = usernameToEmail(username);
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: normalizeUsername(username) } },
        });
        if (error) {
          const m = error.message.toLowerCase();
          toast.error(m.includes("registered") ? T.taken : m.includes("password") ? T.weak : T.error);
          return;
        }
        if (!data.session) {
          const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
          if (e2) return toast.error(T.error);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return toast.error(T.badLogin);
      }
      navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-center gap-2">
            <Truck className="size-6 text-[color:var(--brand)]" />
            <h1 className="text-xl font-bold">{T.title}</h1>
          </div>
          <h2 className="text-center text-lg font-semibold">{mode === "in" ? T.signIn : T.signUp}</h2>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="username">{T.username}</Label>
              <Input id="username" dir="ltr" autoComplete="username" value={username}
                onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{T.password}</Label>
              <Input id="password" type="password" dir="ltr"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "in" ? T.signIn : T.signUp}
            </Button>
          </form>
          <button type="button" className="w-full text-sm text-muted-foreground underline"
            onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? T.toSignUp : T.toSignIn}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
