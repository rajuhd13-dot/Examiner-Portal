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
const CACHE_TTL_MS = 0; // 0 seconds: 100% real-time direct Google Sheet data fetch on every search

const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1XEBoEshSpMdQNGwOCcyZdDgANiUMWuLgJfiNnmdlQOV2BSRxAqOrm0J-7vj6cDCH/exec';

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

app.get("/api/search", async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    return res.status(400).json({ ok: false, message: "Search value is empty." });
  }

  const searchKey = normalizeSearchKey(query);
  const cached = cacheStore.get(searchKey);
  const now = Date.now();

  console.log(`[Search] Fetching live real-time Google Sheet data for ${searchKey}...`);

  // In-flight request deduplication to prevent slamming Google Apps Script
  if (!global.inFlightRequests) {
    global.inFlightRequests = new Map();
  }

  try {
    let fetchPromise = global.inFlightRequests.get(searchKey);
    if (!fetchPromise) {
      fetchPromise = axios.get(`${APPSCRIPT_URL}?q=${encodeURIComponent(query)}&cb=${Date.now()}`, {
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      }).then(r => r.data).finally(() => {
        global.inFlightRequests.delete(searchKey);
      });
      global.inFlightRequests.set(searchKey, fetchPromise);
    }

    let data = await fetchPromise;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) {
        if (cached) {
          console.warn(`[Search] Apps Script non-JSON response, falling back to cached data for ${searchKey}`);
          return res.json({ ok: true, data: cached.data, isFallback: true });
        }
        return res.json({ ok: false, message: "No examiner found." });
      }
    }

    if (data && data.ok && data.data) {
      setCacheItem(data.data);
      cacheStore.set(searchKey, { data: data.data, timestamp: now });
      console.log(`[Search] Live data successfully retrieved from Google Sheet for ${searchKey}`);
      return res.json({ ok: true, data: data.data });
    }

    // If live search returned not found in Google Sheets, clear cache so stale data is never preserved
    cacheStore.delete(searchKey);
    return res.json({ ok: false, message: data?.message || "No examiner found." });
  } catch (error: any) {
    console.warn(`[Search] Notice fetching live data for ${searchKey}:`, error?.message || error);
    if (cached) {
      console.log(`[Search] Serving stale cache as network fallback for ${searchKey}`);
      return res.json({ ok: true, data: cached.data, isFallback: true });
    }
    return res.status(200).json({ 
      ok: false, 
      message: "No examiner found."
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
