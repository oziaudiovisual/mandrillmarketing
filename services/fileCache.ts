
// Simple in-memory cache for file objects to avoid re-downloading them
// immediately after upload (which causes CORS/Proxy issues).

const fileCache = new Map<string, File>();

export const setCachedFile = (id: string, file: File) => {
  fileCache.set(id, file);
};

export const getCachedFile = (id: string): File | undefined => {
  return fileCache.get(id);
};

export const clearFileCache = () => {
  fileCache.clear();
};
