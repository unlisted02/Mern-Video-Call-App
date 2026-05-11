import axiosInstance from "../lib/axios";

export const userPreferencesApi = {
  getBackgroundPreference: async () => {
    const response = await axiosInstance.get("/users/background-preference");
    return response.data;
  },
  saveBackgroundPreference: async (preference) => {
    const response = await axiosInstance.post("/users/background-preference", preference);
    return response.data;
  },
};
