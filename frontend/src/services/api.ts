import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Client-side in-memory cache for static/rarely-changing endpoints (branches, doctors list)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const isCacheableRequest = (url?: string, method?: string) => {
  if (!url || (method && method.toLowerCase() !== 'get')) return false;
  const cleanPath = url.split('?')[0].replace(/\/$/, '');
  return cleanPath === '/branches' || cleanPath === '/doctors';
};

api.interceptors.request.use(
  (config) => {
    (config as any)._startTime = performance.now();

    // Invalidate cached lists when a branch or doctor is created/updated/deleted
    if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
      const url = config.url || '';
      if (url.includes('/branches')) {
        for (const k of apiCache.keys()) {
          if (k.includes('/branches')) apiCache.delete(k);
        }
      }
      if (url.includes('/doctors')) {
        for (const k of apiCache.keys()) {
          if (k.includes('/doctors')) apiCache.delete(k);
        }
      }
    }

    // Check in-memory cache for static listing endpoints
    if (isCacheableRequest(config.url, config.method)) {
      const cacheKey = `${config.method?.toUpperCase()}:${config.url}`;
      const cached = apiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`⚡ [CACHED 0ms] ${config.method?.toUpperCase()} ${config.url}`);
        config.adapter = async () => ({
          data: JSON.parse(JSON.stringify(cached.data)),
          status: 200,
          statusText: 'OK (Cached)',
          headers: {},
          config,
        });
        return config;
      }
    }

    const token = localStorage.getItem('access_token');
    const skipAuth = (config as any).skipAuth;
    
    if (token && config.headers && !skipAuth) {
      const url = config.url || '';
      const isExternal = url.startsWith('http://') || url.startsWith('https://');
      const isInternalApi = !isExternal || (API_BASE_URL && url.startsWith(API_BASE_URL));
      
      if (isInternalApi) {
        if (typeof config.headers.set === 'function') {
          config.headers.set('Authorization', `Bearer ${token}`);
        } else {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Intercept 401 response and handle token refresh / redirect to login
api.interceptors.response.use(
  (response) => {
    const startTime = (response.config as any)?._startTime;
    const duration = startTime ? Math.round(performance.now() - startTime) : 0;
    
    if (response.statusText !== 'OK (Cached)') {
      console.log(`⚡ [API ${duration}ms] ${response.config.method?.toUpperCase()} ${response.config.url} (${response.status})`);
    }

    // Cache successful GET response for cacheable endpoints
    if (
      isCacheableRequest(response.config?.url, response.config?.method) &&
      response.status >= 200 &&
      response.status < 300 &&
      response.statusText !== 'OK (Cached)'
    ) {
      const cacheKey = `${response.config.method?.toUpperCase()}:${response.config.url}`;
      apiCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });
    }

    return response;
  },
  async (error) => {
    const startTime = (error.config as any)?._startTime;
    const duration = startTime ? Math.round(performance.now() - startTime) : 0;
    if (error.config?.url) {
      console.warn(`⚠️ [API ${duration}ms] ${error.config?.method?.toUpperCase()} ${error.config?.url} (${error.response?.status || error.message})`);
    }
    const originalRequest = error.config;
    
    // If unauthorized and we haven't retried yet, and it is not a login or refresh request
    const isAuthRequest = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh-token');
    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (typeof originalRequest.headers.set === 'function') {
              originalRequest.headers.set('Authorization', `Bearer ${token}`);
            } else {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
            refresh_token: refreshToken,
          });
          
          if (res.status === 200 && res.data?.success) {
            const { access_token } = res.data.data;
            localStorage.setItem('access_token', access_token);
            if (typeof originalRequest.headers.set === 'function') {
              originalRequest.headers.set('Authorization', `Bearer ${access_token}`);
            } else {
              originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            }
            processQueue(null, access_token);
            isRefreshing = false;
            return api(originalRequest);
          } else {
            processQueue(new Error('Token refresh failed'), null);
            isRefreshing = false;
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = '/';
            return Promise.reject(error);
          }
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;
          // Refresh token expired or invalid -> logout user
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/';
          return Promise.reject(refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export const getWebSocketUrl = (): string => {
  const base = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.host}`;
  const wsProto = base.startsWith('https') ? 'wss' : 'ws';
  const cleanBase = base.replace(/^https?:\/\//, '');
  const token = localStorage.getItem('access_token');
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${wsProto}://${cleanBase}/api/v1/ws${query}`;
};

