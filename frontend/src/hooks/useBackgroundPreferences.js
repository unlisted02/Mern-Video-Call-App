import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { userPreferencesApi } from "../api/userPreferences";

const DEFAULT_PREFERENCE = { type: "none", value: {} };

export function useBackgroundPreference() {
  return useQuery({
    queryKey: ["backgroundPreference"],
    queryFn: userPreferencesApi.getBackgroundPreference,
    select: (data) => data?.preference || DEFAULT_PREFERENCE,
  });
}

export function useSaveBackgroundPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["saveBackgroundPreference"],
    mutationFn: userPreferencesApi.saveBackgroundPreference,
    onSuccess: (data) => {
      queryClient.setQueryData(["backgroundPreference"], data?.preference || DEFAULT_PREFERENCE);
      toast.success("Default background saved");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to save default background");
    },
  });
}
