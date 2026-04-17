"use client";

// useTenantQuery — wraps TanStack Query with tenant-scoped cache keys.
// Prepends [tenantId] to every query key to prevent cross-tenant cache
// pollution during platform admin impersonation sessions.
//
// IMPORTANT: mutations that invalidate queries MUST also use tenant-scoped keys:
//   queryClient.invalidateQueries({ queryKey: [tenantId, "roles"] })
// Never invalidate with plain keys like queryClient.invalidateQueries({ queryKey: ["roles"] })

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export function useTenantQuery<TData, TError = Error>(
  key: unknown[],
  fetcher: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, "queryKey" | "queryFn">
) {
  const { tenantId } = useAuth();

  return useQuery<TData, TError>({
    queryKey: [tenantId, ...key],
    queryFn: fetcher,
    enabled: !!tenantId && (options?.enabled ?? true),
    ...options,
  });
}

export function useTenantMutation<TData, TVariables, TError = Error>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateKeys?: unknown[][],
  options?: Omit<UseMutationOptions<TData, TError, TVariables>, "mutationFn" | "onSuccess">
) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables>({
    mutationFn,
    onSuccess: (data, variables, context) => {
      // Invalidate with tenant-scoped keys — prevents cross-tenant cache pollution
      if (invalidateKeys && tenantId) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [tenantId, ...key] });
        });
      }
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}
