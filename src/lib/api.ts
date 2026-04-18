import Papa from "papaparse";

const SPREADSHEET_ID = '1R_O4llA1K43Y97GAgkK97WMvWbqg-tftz_FXpcUSZPU';
const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1XEBoEshSpMdQNGwOCcyZdDgANiUMWuLgJfiNnmdlQOV2BSRxAqOrm0J-7vj6cDCH/exec';

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
  REMARK_COMMENT: 93,
  REMARK_COUNT: 94, REMARK_TEXT: 94, REMARK_BY: 95, REMARK_DATE: 96
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
  const parts = str.split('/');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const num = Number(part);
    if (!isNaN(num) && part !== '' && num >= allowMark) return true;
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
    status = anyScorePasses(percentText, allowMark) ? 'Allow' : 'Not Allow';
  }
  return { subject: name + ' (%)', percent: percentText, set: setText, date: dateText, status: status };
}

function formatBatch(value: string) {
  value = String(value || '').trim();
  if (/^\d{2}$/.test(value)) return '20' + value;
  return value;
}

function extractNum(v: string) {
  const m = String(v || '').match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function parseRemarkCell(raw: string, rmNum: number) {
  const show = (rmNum >= 4) || (raw.length > 0 && rmNum > 0);
  if (!show || !raw) return { count: rmNum, show: false, body: '', byLine: '', dateLine: '' };

  const lines = raw.replace(/\r/g, '').split('\n');
  const bodyLines = [];
  let byLine = '';
  let dateLine = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.charAt(0) === '#') byLine = line;
    else if (/^date\s*:/i.test(line)) dateLine = line;
    else bodyLines.push(line);
  }

  let body = bodyLines.join('\n').trim();
  if (!body) body = 'সমস্যাঃ\n** খাতা দেখার নিয়ম না মেনে খাতা দেখা।\n** প্রিন্টিং কমেন্ট করা।\n** কনসেপ্ট দুর্বল।\n** একাধিকবার সুযোগ দেয়া সত্ত্বেও শুধরাতে পারেননি।';

  return { count: rmNum, show: true, body: body, byLine: byLine, dateLine: dateLine };
}

// Storage helper using IndexedDB for high-capacity caching (>5MB)
const DB_NAME = 'ExaminerPortalDB';
const STORE_NAME = 'cache';

async function getDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToDB(key: string, val: any) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(val, key);
  } catch (e) { console.error('DB Save fail', e); }
}

async function getFromDB(key: string) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return new Promise((resolve) => {
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
    });
  } catch (e) { return null; }
}

let cachedIndex: Map<string, any[]> = new Map(); // Stores RAW row arrays for speed
let isFetching = false;
let lastSyncTime = 0;

async function loadPersistentCache() {
  const saved = await getFromDB('full_index') as any[][];
  const ts = await getFromDB('sync_ts') as number;
  
  if (saved && Array.isArray(saved)) {
    const freshIndex = new Map();
    for (const rawRow of saved) {
      // Indexing raw rows directly (Lightning Fast)
      const t = normalizeSearchKey(rawRow[COL.TPIN - 1]);
      const m1 = normalizeSearchKey(rawRow[COL.MOBILE_1 - 1]);
      const m2 = normalizeSearchKey(rawRow[COL.MOBILE_2 - 1]);
      if (t) freshIndex.set(t, rawRow);
      if (m1) freshIndex.set(m1, rawRow);
      if (m2) freshIndex.set(m2, rawRow);
    }
    cachedIndex = freshIndex;
    lastSyncTime = ts || 0;
    console.log(`[System] Ultra-Load: ${cachedIndex.size} entries ready in 0.1s`);
  }
}

async function savePersistentCache() {
  // Save only unique raw rows
  const allRawRows = Array.from(new Set(cachedIndex.values()));
  await saveToDB('full_index', allRawRows);
  await saveToDB('sync_ts', Date.now());
}

// Initial Fast Load
loadPersistentCache();

function formatMobile(v: any) {
  const s = String(v || '').trim();
  if (!s) return '';
  // যদি ১০ ডিজিটের হয়, তবে আগে ০ বসাবে
  if (s.length === 10) return '0' + s;
  return s;
}

function mapRawRow(row: any[]) {
  if (!row || row.length < 10) return null;
  const g = (col: number) => row[col - 1] || '';
  const rm = String(g(COL.RM)).trim();
  const rmNum = extractNum(rm);

  return {
    quick: {
      tpin: g(COL.TPIN), rm, nickName: g(COL.NICK_NAME),
      fullName: g(COL.FULL_NAME), 
      mobile1: formatMobile(g(COL.MOBILE_1)), 
      mobile2: formatMobile(g(COL.MOBILE_2)), 
      nagadNumber: formatMobile(g(COL.MOBILE_BANKING)), 
      institute: g(COL.INST), department: g(COL.DEPT),
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
    remark: parseRemarkCell(String(g(COL.REMARK_COMMENT)).trim(), rmNum)
  };
}

export async function updateClientCache(mode: 'bulk' | 'realtime' = 'realtime') {
  if (isFetching) return;
  isFetching = true;

  try {
    const freshIndex = new Map();

    const fetchWithRetry = async (url: string, options: any, retries = 3): Promise<Response> => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
      } catch (err) {
        if (retries > 0) {
          console.warn(`[Sync] Network issue, retrying in 1s... (${retries} left)`);
          await new Promise(r => setTimeout(r, 1000));
          return fetchWithRetry(url, options, retries - 1);
        }
        throw err;
      }
    };

    const fetchBulk = async () => {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;
      const response = await fetchWithRetry(url, { referrerPolicy: 'no-referrer' });
      const textData = await response.text();
      if (textData.includes('<!DOCTYPE html>') || textData.length < 500) return false;
      
      const results = Papa.parse(textData, { header: false, skipEmptyLines: true });
      const rows = results.data as any[][];
      if (rows.length <= 1) return false;

      // Skip header, store raw data directly
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const t = normalizeSearchKey(row[COL.TPIN - 1]);
        const m1 = normalizeSearchKey(row[COL.MOBILE_1 - 1]);
        const m2 = normalizeSearchKey(row[COL.MOBILE_2 - 1]);
        if (t) freshIndex.set(t, row);
        if (m1) freshIndex.set(m1, row);
        if (m2) freshIndex.set(m2, row);
      }
      return true;
    };

    const fetchRealtime = async () => {
      const response = await fetchWithRetry(`${APPSCRIPT_URL}?action=sync&cb=${Date.now()}`, { referrerPolicy: 'no-referrer' });
      const result = await response.json();
      if (!result || !result.ok || !Array.isArray(result.data)) return false;

      for (const rawRow of result.data) {
        const t = normalizeSearchKey(rawRow[COL.TPIN - 1]);
        const m1 = normalizeSearchKey(rawRow[COL.MOBILE_1 - 1]);
        const m2 = normalizeSearchKey(rawRow[COL.MOBILE_2 - 1]);
        if (t) freshIndex.set(t, rawRow);
        if (m1) freshIndex.set(m1, rawRow);
        if (m2) freshIndex.set(m2, rawRow);
      }
      return true;
    };

    let success = false;
    if (mode === 'bulk') {
      try { 
        success = await fetchBulk(); 
        console.log('[Sync] Bulk Load: OK');
      } catch (e) { 
        console.warn('[Sync] Bulk failed, using Realtime fallback...');
        success = await fetchRealtime(); 
      }
    } else {
      success = await fetchRealtime();
    }

    if (success && freshIndex.size > 0) {
      cachedIndex = freshIndex;
      lastSyncTime = Date.now();
      await savePersistentCache();
      console.log(`[Sync] Update Complete: ${cachedIndex.size} entries.`);
    }
  } catch (err) {
    if (cachedIndex.size > 0) {
      console.warn('[System] Network/CORS issue detected. System is continuing with currently saved data.');
    } else {
      console.error('[System] Boot Sync failed. Check if Sheet is public.', err);
    }
  }
  isFetching = false;
}

export async function startBackgroundSync() {
  console.log('[System] High-Speed Engine Ignited...');
  
  // Start bulk sync immediately
  updateClientCache('bulk').catch(() => {});
  
  // Real-time sync slightly delayed to not block initial bulk load
  setTimeout(() => {
    updateClientCache('realtime').catch(() => {});
  }, 500);

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      updateClientCache('realtime');
    }
  }, 10000); // 10s sync for live updates
}

export async function searchExaminerAPI(query: string, forceLive = false) {
  if (!query) {
    return { ok: false, message: "Search value is empty." };
  }

  const searchKey = normalizeSearchKey(query);

  if (!forceLive && cachedIndex.has(searchKey)) {
    const rawData = cachedIndex.get(searchKey);
    // LAZY MAP: Map only when found
    const mapped = Array.isArray(rawData) ? mapRawRow(rawData) : rawData;
    return { ok: true, data: mapped };
  }

  try {
    const response = await fetch(`${APPSCRIPT_URL}?q=${encodeURIComponent(query)}`);
    const result = await response.json();

    if (result && result.ok) {
      // Result from AppScript is already mapped by server
      cachedIndex.set(searchKey, result.data);
      return { ok: true, data: result.data };
    }
    return { ok: false, message: result?.message || "No examiner found." };
  } catch (error: any) {
    return { ok: false, message: "Search failed. Check your connection." };
  }
}
