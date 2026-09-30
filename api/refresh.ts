import axios from "axios";

const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1XEBoEshSpMdQNGwOCcyZdDgANiUMWuLgJfiNnmdlQOV2BSRxAqOrm0J-7vj6cDCH/exec';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const tpin = (req.query?.tpin || '') as string;
    if (!tpin) return res.status(400).json({ ok: false, message: "TPIN required" });

    try {
      const response = await axios.get(`${APPSCRIPT_URL}?q=${encodeURIComponent(tpin)}&cb=${Date.now()}`, { timeout: 25000 });
      let data = response.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {}
      }
      if (data && data.ok && data.data) {
        return res.status(200).json({ ok: true, data: data.data, message: `Refreshed for TPIN ${tpin}` });
      }
      return res.status(404).json({ ok: false, message: data?.message || "TPIN not found in sheet" });
    } catch (error: any) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  }

  if (req.method === 'POST') {
    const { tpin, data } = req.body || {};
    if (!tpin || !data) {
      return res.status(400).json({ ok: false, message: "tpin and data are required" });
    }
    return res.status(200).json({ ok: true, message: `Cache updated instantly for TPIN ${tpin}` });
  }

  return res.status(405).json({ ok: false, message: "Method not allowed" });
}
