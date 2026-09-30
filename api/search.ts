import axios from "axios";

const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1XEBoEshSpMdQNGwOCcyZdDgANiUMWuLgJfiNnmdlQOV2BSRxAqOrm0J-7vj6cDCH/exec';

interface CacheEntry {
  data: any;
  timestamp: number;
}
const cacheStore: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 45 * 1000; // 45 seconds

function normalizeSearchKey(value: string) {
  value = String(value || '').trim();
  if (!value) return '';
  const digits = value.replace(/\D+/g, '');
  if (digits) {
    if (digits.length >= 12 && digits.indexOf('880') === 0) return digits;
    if (digits.indexOf('0') === 0 && digits.length === 11) return '88' + digits;
    if (digits.indexOf('1') === 0 && digits.length === 10) return '880' + digits;
    return digits;
  }
  return value.toUpperCase();
}

function setCacheItem(mappedData: any) {
  if (!mappedData || !mappedData.quick) return;
  const now = Date.now();
  const entry: CacheEntry = { data: mappedData, timestamp: now };
  const t = normalizeSearchKey(mappedData.quick.tpin);
  const m1 = normalizeSearchKey(mappedData.quick.mobile1);
  const m2 = normalizeSearchKey(mappedData.quick.mobile2);
  if (t) cacheStore.set(t, entry);
  if (m1) cacheStore.set(m1, entry);
  if (m2) cacheStore.set(m2, entry);
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = (req.query?.q || '') as string;
  if (!query) {
    return res.status(400).json({ ok: false, message: "Search value is empty." });
  }

  const searchKey = normalizeSearchKey(query);
  const cached = cacheStore.get(searchKey);
  const now = Date.now();

  try {
    const response = await axios.get(`${APPSCRIPT_URL}?q=${encodeURIComponent(query)}&cb=${Date.now()}`, {
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });

    let data = response.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) {
        if (cached) return res.status(200).json({ ok: true, data: cached.data, isFallback: true });
        return res.status(200).json({ ok: false, message: "No examiner found." });
      }
    }

    if (data && data.ok && data.data) {
      setCacheItem(data.data);
      cacheStore.set(searchKey, { data: data.data, timestamp: now });
      return res.status(200).json({ ok: true, data: data.data });
    }

    // If not found in Google Sheet, delete from cache so stale data is never preserved
    cacheStore.delete(searchKey);
    return res.status(200).json({ ok: false, message: data?.message || "No examiner found." });
  } catch (error: any) {
    if (cached) {
      return res.status(200).json({ ok: true, data: cached.data, isFallback: true });
    }
    return res.status(200).json({ ok: false, message: "No examiner found." });
  }
}
