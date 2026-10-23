import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSession, signInWithGoogle, signOut } from "@/services/auth";

export function useAuthSession() {
  return useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const { data, error } = await getSession();
      if (error) throw error;
      return data.session;
    },
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: async () => {
      const res = await signInWithGoogle();
      if (res.error) throw res.error;
      return res;
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
