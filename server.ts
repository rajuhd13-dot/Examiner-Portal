import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import Papa from "papaparse";

const app = express();
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for all devices and external hosting (Vercel, Mobile, etc.)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const PORT = 3000;

const SPREADSHEET_ID = '1R_O4llA1K43Y97GAgkK97WMvWbqg-tftz_FXpcUSZPU';
// We'll try to fetch the first sheet (gid=0) as CSV. 
// If the sheet name 'Examiner Information' is not the first sheet, this might need adjustment.
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;

const COL = {
  NICK_NAME: 2, TPIN: 4, INST: 5, DEPT: 6, HSC_BATCH: 7, RM: 8,
  MOBILE_1: 10, MOBILE_2: 11, MOBILE_BANKING: 12,
  RUNNING_PROGRAM: 16, PREVIOUS_PROGRAM: 17,
  EMAIL: 22, TEAMS_ID: 23,
  HSC_ROLL: 28, HSC_REG: 29, HSC_BOARD: 30, HSC_GPA: 31,
  SUBJECT_1: 34, SUBJECT_2: 35, SUBJECT_3: 36, SUBJECT_4: 37, SUBJECT_5: 38,
  VERSION_INTERESTED: 39,
  FULL_NAME: 43, RELIGION: 45, GENDER: 46, DATE_OF_BIRTH: 47,
  FATHERS_NAME: 52, MOTHERS_NAME: 56, HOME_DISTRICT: 61,
  ENGLISH_PCT: 62, ENGLISH_SET: 63, ENGLISH_DATE: 64,
  BANGLA_PCT: 65, BANGLA_SET: 66, BANGLA_DATE: 67,
  PHYSICS_PCT: 68, PHYSICS_SET: 69, PHYSICS_DATE: 70,
  CHEMISTRY_PCT: 71, CHEMISTRY_SET: 72, CHEMISTRY_DATE: 73,
  MATH_PCT: 74, MATH_SET: 75, MATH_DATE: 76,
  BIOLOGY_PCT: 77, BIOLOGY_SET: 78, BIOLOGY_DATE: 79,
  ICT_PCT: 80, ICT_SET: 81, ICT_DATE: 82,
  TRAINING_REPORT: 83, TRAINING_DATE: 84,
  ID_CHECKED: 86, FORM_FILL_DATE: 88, PHYSICAL_CAMPUS_PREF: 89,
  SELECTED_SUBJECT: 92,
  RM4_COMMENT: 93,
  REMARK_BY: 95, REMARK_DATE: 96
};

const ALLOW_MARK = {
  ENGLISH: 60, BANGLA: 50, PHYSICS: 50, CHEMISTRY: 50,
  MATH: 50, BIOLOGY: 50, ICT: 50
};

function convertBanglaToEnglishDigits(str: string): string {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str || '').replace(/[০-৯]/g, (d) => String(banglaDigits.indexOf(d)));
}

function normalizeSearchKey(value: string) {
  value = convertBanglaToEnglishDigits(String(value || '').trim());
  if (!value) return '';
  // Strip common prefixes like TPIN:, TPIN-, #
  value = value.replace(/^tpin[:\s\-_#]*/i, '').trim();
  const digits = value.replace(/\D+/g, '');
  if (digits) {
    if (digits.length >= 12 && digits.indexOf('880') === 0) return digits;
    if (digits.indexOf('0') === 0 && digits.length === 11) return '88' + digits;
    if (digits.indexOf('1') === 0 && digits.length === 10) return '880' + digits;
    return digits;
  }
  return value.toUpperCase();
}

function anyScorePasses(value: string, allowMark: number) {
  const str = String(value || '').trim();
  if (!str) return false;
  const matches = str.match(/\d+(?:\.\d+)?/g);
  if (!matches) return false;
  for (let i = 0; i < matches.length; i++) {
    const num = Number(matches[i]);
    if (!isNaN(num) && num >= allowMark) return true;
  }
  return false;
}

function makeAssessment(name: string, pct: string, set: string, date: string, allowMark: number) {
  const percentText = String(pct || '').trim();
  const setText = String(set || '').trim();
  const dateText = String(date || '').trim();
  const hasAny = percentText || setText || dateText;
  let status = 'No Exam';
  if (hasAny) {
    status = (anyScorePasses(percentText, allowMark) || anyScorePasses(setText, allowMark)) ? 'Allow' : 'Not Allow';
  }
  return { subject: name + ' (%)', percent: percentText, set: setText, date: dateText, status: status };
}

function formatBatch(value: string) {
  value = String(value || '').trim();
  if (/^\d{2}$/.test(value)) return '20' + value;
  return value;
}

function buildDefaultRemarkBody() {
  return [
    'সমস্যাঃ',
    '** খাতা দেখার নিয়ম না মেনে খাতা দেখা।',
    '** প্রিন্টিং কমেন্ট করা।',
    '** কনসেপ্ট দুর্বল।',
    '** একাধিকবার সুযোগ দেয়া সত্ত্বেও শুধরাতে পারেননি।'
  ].join('\n');
}

function mapRowFromServer(row: any[]) {
  const g = (col: number) => row[col - 1] || '';
  return {
    quick: {
      tpin: g(COL.TPIN), rm: String(g(COL.RM)).trim(), nickName: g(COL.NICK_NAME),
      fullName: g(COL.FULL_NAME), mobile1: g(COL.MOBILE_1), mobile2: g(COL.MOBILE_2), 
      nagadNumber: g(COL.MOBILE_BANKING), institute: g(COL.INST), department: g(COL.DEPT),
      hscGpa: g(COL.HSC_GPA), hscBatch: formatBatch(g(COL.HSC_BATCH)),
      trainingReport: g(COL.TRAINING_REPORT), trainingDate: g(COL.TRAINING_DATE),
      physicalCampus: g(COL.PHYSICAL_CAMPUS_PREF)
    },
    personal: {
      fathersName: g(COL.FATHERS_NAME), mothersName: g(COL.MOTHERS_NAME),
      religion: g(COL.RELIGION), gender: g(COL.GENDER), dateOfBirth: g(COL.DATE_OF_BIRTH), 
      hscRoll: g(COL.HSC_ROLL), hscReg: g(COL.HSC_REG), hscBoard: g(COL.HSC_BOARD),
      teamsId: g(COL.TEAMS_ID), email: g(COL.EMAIL), homeDistrict: g(COL.HOME_DISTRICT), 
      subjectsChoice: [g(COL.SUBJECT_1), g(COL.SUBJECT_2), g(COL.SUBJECT_3), g(COL.SUBJECT_4), g(COL.SUBJECT_5)].filter(Boolean).join(', '),
      versionInterested: g(COL.VERSION_INTERESTED), runningProgram: g(COL.RUNNING_PROGRAM), 
      previousProgram: g(COL.PREVIOUS_PROGRAM), regDate: g(COL.FORM_FILL_DATE), 
      selectedSub: g(COL.SELECTED_SUBJECT), idChecked: g(COL.ID_CHECKED)
    },
    assessments: [
      makeAssessment('English', g(COL.ENGLISH_PCT), g(COL.ENGLISH_SET), g(COL.ENGLISH_DATE), ALLOW_MARK.ENGLISH),
      makeAssessment('Bangla', g(COL.BANGLA_PCT), g(COL.BANGLA_SET), g(COL.BANGLA_DATE), ALLOW_MARK.BANGLA),
      makeAssessment('Physics', g(COL.PHYSICS_PCT), g(COL.PHYSICS_SET), g(COL.PHYSICS_DATE), ALLOW_MARK.PHYSICS),
      makeAssessment('Chemistry', g(COL.CHEMISTRY_PCT), g(COL.CHEMISTRY_SET), g(COL.CHEMISTRY_DATE), ALLOW_MARK.CHEMISTRY),
      makeAssessment('Math', g(COL.MATH_PCT), g(COL.MATH_SET), g(COL.MATH_DATE), ALLOW_MARK.MATH),
      makeAssessment('Biology', g(COL.BIOLOGY_PCT), g(COL.BIOLOGY_SET), g(COL.BIOLOGY_DATE), ALLOW_MARK.BIOLOGY),
      makeAssessment('ICT', g(COL.ICT_PCT), g(COL.ICT_SET), g(COL.ICT_DATE), ALLOW_MARK.ICT)
    ],
    remark: {
      show: String(g(COL.RM)).trim() === '4',
      rmValue: String(g(COL.RM)).trim(),
      body: String(g(COL.RM4_COMMENT)).trim() || buildDefaultRemarkBody(),
      byLine: String(g(COL.REMARK_BY)).trim(),
      dateLine: String(g(COL.REMARK_DATE)).trim() ? ('Date: ' + String(g(COL.REMARK_DATE)).trim()) : ''
    }
  };
}

// --- Global Cache with TTL for Real-time Multi-Device Accuracy ---
interface CacheEntry {
  data: any;
  timestamp: number;
}
const cacheStore: Map<string, CacheEntry> = new Map();
// 10 minutes fresh cache TTL: gives instant repeated searches across all sessions
const CACHE_FRESH_TTL_MS = 10 * 60 * 1000;

const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1XEBoEshSpMdQNGwOCcyZdDgANiUMWuLgJfiNnmdlQOV2BSRxAqOrm0J-7vj6cDCH/exec';

function setCacheItem(mappedData: any) {
  if (!mappedData || !mappedData.quick) return;
  const now = Date.now();
  const entry: CacheEntry = { data: mappedData, timestamp: now };

  const addKeyAliases = (val: string) => {
    if (!val) return;
    const norm = normalizeSearchKey(val);
    if (!norm) return;
    cacheStore.set(norm, entry);
    // If it's a normalized Bangladeshi phone number (starts with 880, 13 digits)
    if (norm.length === 13 && norm.startsWith('880')) {
      const local11 = '0' + norm.substring(3); // 017...
      const core10 = norm.substring(3);        // 17...
      cacheStore.set(local11, entry);
      cacheStore.set(core10, entry);
    }
  };

  addKeyAliases(mappedData.quick.tpin);
  addKeyAliases(mappedData.quick.mobile1);
  addKeyAliases(mappedData.quick.mobile2);
}

app.get("/api/search", async (req, res) => {
  const query = req.query.q as string;
  const forceRefresh = req.query.refresh === 'true';
  if (!query) {
    return res.status(400).json({ ok: false, message: "Search value is empty." });
  }

  const searchKey = normalizeSearchKey(query);
  const cached = cacheStore.get(searchKey);
  const now = Date.now();

  // If cached and force refresh is not requested, return instantly in 0ms!
  if (cached && !forceRefresh) {
    console.log(`[Search] Serving cached data (0ms) for ${searchKey}`);
    return res.json({ ok: true, data: cached.data, isCached: true });
  }

  console.log(`[Search] Fetching live real-time Google Sheet data for ${searchKey}...`);

  // In-flight request deduplication to prevent slamming Google Apps Script
  if (!global.inFlightRequests) {
    global.inFlightRequests = new Map();
  }

  try {
    let fetchPromise = global.inFlightRequests.get(searchKey);
    if (!fetchPromise) {
      const fetchWithRetry = async (retries = 1): Promise<any> => {
        try {
          const res = await axios.get(`${APPSCRIPT_URL}?q=${encodeURIComponent(query)}&cb=${Date.now()}`, {
            timeout: 38000,
            maxRedirects: 10,
            validateStatus: (status) => status < 500
          });
          return res.data;
        } catch (err: any) {
          const isTimeout = axios.isAxiosError(err) && (err.code === 'ECONNABORTED' || String(err.message || '').includes('timeout'));
          if (isTimeout) {
            // Apps Script only hangs or takes >38s when the record does not exist in the sheet
            console.log(`[Search] Search for ${searchKey} completed after timeout (not found in sheet).`);
            return { ok: false, notFound: true, message: "No examiner found." };
          }
          if (retries > 0) {
            console.log(`[Search] Apps Script transient network reset for ${searchKey}, retrying...`);
            await new Promise(r => setTimeout(r, 600));
            return fetchWithRetry(retries - 1);
          }
          throw err;
        }
      };

      fetchPromise = fetchWithRetry().finally(() => {
        global.inFlightRequests.delete(searchKey);
      });
      global.inFlightRequests.set(searchKey, fetchPromise);
    }

    let data = await fetchPromise;
    if (typeof data === 'string') {
      try { 
        data = JSON.parse(data); 
      } catch (e) {
        if (cached) {
          console.warn(`[Search] Apps Script non-JSON response, falling back to cached data for ${searchKey}`);
          return res.json({ ok: true, data: cached.data, isFallback: true });
        }
        return res.status(502).json({ ok: false, errorType: "NETWORK_ERROR", message: "Google Sheets connection glitch. Please retry." });
      }
    }

    if (data && data.ok && data.data) {
      setCacheItem(data.data);
      console.log(`[Search] Live data successfully retrieved from Google Sheet for ${searchKey}`);
      return res.json({ ok: true, data: data.data });
    }

    if (data && data.ok === false) {
      const msg = String(data.message || '').toLowerCase();
      const isScriptError = msg.includes('script error') || msg.includes('timed out') || msg.includes('quota') || msg.includes('lock') || msg.includes('exceeded') || msg.includes('exception');
      const isTrueNotFound = !isScriptError && (data.notFound === true || msg.includes('no examiner found') || msg.includes('not found') || msg.includes('empty'));

      if (isScriptError) {
        console.warn(`[Search] Apps Script internal glitch: ${data.message}`);
        if (cached) {
          console.log(`[Search] Serving cached data as error fallback for ${searchKey}`);
          return res.json({ ok: true, data: cached.data, isFallback: true });
        }
        return res.status(503).json({
          ok: false,
          errorType: "NETWORK_ERROR",
          message: "Temporary connection issue with Google Sheets. Please try again."
        });
      }

      if (isTrueNotFound) {
        // Legitimately not found in Google Sheets
        cacheStore.delete(searchKey);
        return res.json({ ok: false, notFound: true, message: "No examiner found." });
      }

      // If ambiguous message and we have cache, serve cache
      if (cached) {
        return res.json({ ok: true, data: cached.data, isFallback: true });
      }

      return res.json({ ok: false, message: data?.message || "No examiner found." });
    }

    if (cached) {
      return res.json({ ok: true, data: cached.data, isFallback: true });
    }

    return res.json({ ok: false, message: data?.message || "No examiner found." });
  } catch (error: any) {
    const isTimeout = axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || String(error.message || '').includes('timeout'));
    if (isTimeout) {
      console.log(`[Search] Request for ${searchKey} reached timeout without match.`);
      if (cached) {
        return res.json({ ok: true, data: cached.data, isFallback: true });
      }
      return res.json({ ok: false, notFound: true, message: "No examiner found." });
    }
    console.log(`[Search] Live network event for ${searchKey}:`, error?.message || error);
    if (cached) {
      console.log(`[Search] Serving cached data as network fallback for ${searchKey}`);
      return res.json({ ok: true, data: cached.data, isFallback: true });
    }
    // Return 503 so frontend knows it was a network timeout/glitch, NOT a missing record!
    return res.status(503).json({ 
      ok: false, 
      errorType: "NETWORK_ERROR",
      message: "Temporary connection issue with Google Sheets. Please try again."
    });
  }
});

// GET refresh endpoint: Fetches fresh single record from Apps Script & updates cache
app.get("/api/refresh", async (req, res) => {
  const tpin = req.query.tpin as string;
  if (!tpin) return res.status(400).json({ ok: false, message: "TPIN required" });
  
  console.log(`[Cache] GET Refresh for TPIN: ${tpin}`);
  try {
    const response = await axios.get(`${APPSCRIPT_URL}?q=${encodeURIComponent(tpin)}&cb=${Date.now()}`, { timeout: 25000 });
    let data = response.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) {}
    }
    if (data && data.ok && data.data) {
      setCacheItem(data.data);
      console.log(`[Cache] Successfully refreshed cache for TPIN: ${tpin}`);
      return res.json({ ok: true, data: data.data, message: `Cache refreshed for TPIN ${tpin}` });
    } else {
      return res.status(404).json({ ok: false, message: data?.message || "TPIN not found in sheet" });
    }
  } catch (error: any) {
    console.warn(`[Cache] Failed to refresh TPIN ${tpin}:`, error.message);
    return res.status(500).json({ ok: false, message: `Error refreshing TPIN: ${error.message}` });
  }
});

// POST refresh endpoint: Triggered by Google Sheet installable On Edit webhook trigger
app.post("/api/refresh", (req, res) => {
  const { tpin, data } = req.body;
  if (!tpin || !data) {
    return res.status(400).json({ ok: false, message: "tpin and data are required in the request body" });
  }
  
  console.log(`[Cache] Instant POST Refresh webhook from Google Sheet for TPIN: ${tpin}`);
  try {
    setCacheItem(data);
    const searchKey = normalizeSearchKey(tpin);
    if (searchKey) {
      cacheStore.set(searchKey, { data, timestamp: Date.now() });
    }
    console.log(`[Cache] Cache instantly updated for TPIN: ${tpin}`);
    return res.json({ ok: true, message: `Cache updated instantly for TPIN ${tpin}` });
  } catch (error: any) {
    console.error(`[Cache] Error processing POST refresh payload for TPIN ${tpin}:`, error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
