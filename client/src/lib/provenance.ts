// Provenance tracking system
type Prov = { 
  source: 'user' | 'local' | 'api' | 'static' | 'url' | 'computed',
  key: string, 
  detail?: any, 
  ts: number, 
  page: string 
};

const bus: Prov[] = [];
const seen = new Set<string>();
const last: Record<string, number> = {};
const THROTTLE_WINDOW = 500;

export const record = (p: Prov) => {
  bus.push(p);
  // Keep only last 100 events to prevent memory issues
  if (bus.length > 100) {
    bus.shift();
  }
};

// Record only once per page/source/key combination
export const recordOnce = (p: Prov) => {
  const key = `${p.source}:${p.page}:${p.key}`;
  if (seen.has(key)) return;
  seen.add(key);
  record(p);
};

// Throttle repeated accesses within 500ms window
export const recordThrottled = (p: Prov) => {
  const key = `${p.source}:${p.page}:${p.key}`;
  const now = Date.now();
  if ((last[key] ?? 0) > now - THROTTLE_WINDOW) return;
  last[key] = now;
  record(p);
};

export const useProv = () => bus;

export const clearProv = () => {
  bus.length = 0;
  seen.clear();
  Object.keys(last).forEach(k => delete last[k]);
};

// Check if provenance tracking is enabled
export const isProvEnabled = () => {
  return new URLSearchParams(window.location.search).has('prov') || 
         sessionStorage.getItem('provenance-enabled') === 'true';
};

// Force enable provenance for debugging
export const enableProvenance = () => {
  sessionStorage.setItem('provenance-enabled', 'true');
};

// Toggle provenance tracking
export const toggleProv = () => {
  const enabled = isProvEnabled();
  if (enabled) {
    sessionStorage.removeItem('provenance-enabled');
  } else {
    sessionStorage.setItem('provenance-enabled', 'true');
  }
  window.location.reload(); // Reload to apply changes
};

// Adapter for localStorage - throttled to avoid spam
export const withLocalStore = {
  get: (k: string) => {
    const v = localStorage.getItem(k);
    if (isProvEnabled()) {
      recordThrottled({
        source: 'local', 
        key: k, 
        detail: { size: v?.length || 0 }, 
        ts: Date.now(), 
        page: location.pathname
      });
    }
    return v;
  },
  set: (k: string, v: string) => {
    localStorage.setItem(k, v);
    if (isProvEnabled()) {
      recordThrottled({
        source: 'local', 
        key: k, 
        detail: { size: v.length, action: 'write' }, 
        ts: Date.now(), 
        page: location.pathname
      });
    }
  }
};

// Adapter for API calls
export const withApiClient = async (path: string, body?: any) => {
  if (isProvEnabled()) {
    record({
      source: 'api', 
      key: path, 
      detail: { dir: 'req' }, 
      ts: Date.now(), 
      page: location.pathname
    });
  }
  
  const options: RequestInit = {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const r = await fetch(path, options);
  
  if (isProvEnabled()) {
    record({
      source: 'api', 
      key: path, 
      detail: { dir: 'res', status: r.status }, 
      ts: Date.now(), 
      page: location.pathname
    });
  }
  
  return r;
};

// Adapter for static config access - record once per page
export const withStaticConfig = (key: string, data: any) => {
  if (isProvEnabled()) {
    recordOnce({
      source: 'static', 
      key, 
      detail: { type: typeof data, count: Array.isArray(data) ? data.length : undefined }, 
      ts: Date.now(), 
      page: location.pathname
    });
  }
  return data;
};

// Adapter for computed values
export const withComputed = (key: string, fn: () => any, inputs?: any[]) => {
  const result = fn();
  if (isProvEnabled()) {
    record({
      source: 'computed', 
      key, 
      detail: { inputCount: inputs?.length || 0 }, 
      ts: Date.now(), 
      page: location.pathname
    });
  }
  return result;
};

// Adapter for URL params
export const withUrlParams = (key: string) => {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(key);
  if (isProvEnabled()) {
    record({
      source: 'url', 
      key, 
      detail: { found: !!value }, 
      ts: Date.now(), 
      page: location.pathname
    });
  }
  return value;
};