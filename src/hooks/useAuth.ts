import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "platform_admin" | "tenant_admin";
  tenantId: string | null;
  permissions: string[];
}

interface AuthState {
  user: AuthUser;
  requiresPasswordReset: boolean;
  requiresTwoFactor: boolean;
}

async function fetchSession(): Promise<AuthState | null> {
  const res = await fetch("/api/auth/refresh", { method: "POST" });
  if (!res.ok) return null;
  return res.json() as Promise<AuthState>;
}

export function useAuth() {
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery<AuthState | null>({
    queryKey: ["auth", "session"],
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const logout = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST" }).then(() => undefined),
    onSuccess: () => {
      qc.clear();
      router.push("/login");
    },
  });

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    requiresPasswordReset: data?.requiresPasswordReset ?? false,
    logout: logout.mutate,
    hasPermission: (permission: string) => data?.user.permissions.includes(permission) ?? false,
  };
}
