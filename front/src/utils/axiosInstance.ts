import axios from "axios";

/**
 * No default `Content-Type`: a global `application/json` header breaks `multipart/form-data`
 * (browser must set the boundary). JSON requests still get the correct header when `data` is a plain object.
 */
const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 60000,
});

export default axiosInstance;
