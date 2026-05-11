import axiosInstance from "../lib/axios";

export const backgroundsApi = {
  getCategories: async () => {
    const response = await axiosInstance.get("/backgrounds/categories");
    return response.data;
  },
  search: async ({ query, page = 1, perPage = 18 }) => {
    const response = await axiosInstance.get("/backgrounds/search", {
      params: { q: query, page, perPage },
    });
    return response.data;
  },
  getUploadSignature: async () => {
    const response = await axiosInstance.post("/backgrounds/upload-signature");
    return response.data;
  },
};
