import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const T = { signOut: "יציאה" };

export function SignOutButton() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const onClick = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <Button variant="ghost" size="sm" onClick={onClick} title={T.signOut}>
      <LogOut className="size-4 ms-1" /> {T.signOut}
    </Button>
  );
}
