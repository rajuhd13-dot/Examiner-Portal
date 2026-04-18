import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Phone, 
  User, 
  ClipboardList, 
  ShieldCheck, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { searchExaminerAPI, startBackgroundSync } from "./lib/api";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Assessment {
  subject: string;
  percent: string;
  set: string;
  date: string;
  status: string;
}

interface ExaminerData {
  quick: {
    tpin: string;
    rm: string;
    nickName: string;
    fullName: string;
    mobile1: string;
    mobile2: string;
    nagadNumber: string;
    institute: string;
    department: string;
    hscGpa: string;
    hscBatch: string;
    trainingReport: string;
    trainingDate: string;
    physicalCampus: string;
  };
  personal: {
    fathersName: string;
    mothersName: string;
    religion: string;
    gender: string;
    dateOfBirth: string;
    hscRoll: string;
    hscReg: string;
    hscBoard: string;
    teamsId: string;
    email: string;
    homeDistrict: string;
    subjectsChoice: string;
    versionInterested: string;
    runningProgram: string;
    previousProgram: string;
    regDate: string;
    selectedSub: string;
    idChecked: string;
  };
  assessments: Assessment[];
  remark: {
    count: number;
    show: boolean;
    body: string;
    byLine: string;
    dateLine: string;
  };
}

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExaminerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search on load and Start Sync
  useEffect(() => {
    searchInputRef.current?.focus();
    // Start background sync immediately
    startBackgroundSync().catch(() => {});
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const searchKey = query.trim();
    if (!searchKey) return;

    // If already showing this data, don't re-fetch unless it's a manual search
    if (!e && data && (data.quick.tpin === searchKey || data.quick.mobile1 === searchKey || data.quick.mobile2 === searchKey)) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // searchExaminerAPI handles the 0.1s cache internally
      const result = await searchExaminerAPI(searchKey);

      if (result.ok) {
        setData(result.data);
      } else {
        // Only set error if it's a manual search or we've reached full length
        if (searchKey.length >= 4) {
          setData(null);
          setError(result.message || "No examiner found.");
        }
      }
    } catch (err: any) {
      console.error("Search error:", err);
      setError(err.message || "Server error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const getWaLink = (num: string) => {
    const d = String(num || "").replace(/\D+/g, "");
    if (!d) return null;
    let formatted = d;
    if (!d.startsWith("880")) {
      if (d.startsWith("0") && d.length === 11) formatted = "88" + d;
      else if (d.startsWith("1") && d.length === 10) formatted = "880" + d;
    }
    return `https://wa.me/${formatted}`;
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans text-slate-900 pb-20 selection:bg-blue-100">
      {/* Hero Search Section */}
      <div className="max-w-5xl mx-auto px-4 pt-3">
        <div className="bg-gradient-to-br from-[#1a237e] to-[#0d1340] rounded-[24px] p-4 md:p-5 shadow-xl relative overflow-hidden text-center">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-white uppercase tracking-widest">Live System</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-0.5 tracking-tight">Examiner Portal</h1>
            <p className="text-blue-200/60 text-xs md:text-sm font-medium mb-3">টি-পিন বা মোবাইল নম্বর দিয়ে এক্সামিনার খুঁজুন</p>

            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="flex flex-col md:flex-row items-center bg-white/5 backdrop-blur-sm p-1.5 rounded-[20px] border border-white/10 shadow-lg">
                <div className="flex-1 flex items-center bg-white rounded-[16px] px-4 h-12 w-full">
                  <Search className="text-slate-400 w-4 h-4 mr-2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    className="w-full bg-transparent border-none outline-none text-base font-semibold text-slate-800 placeholder:text-slate-300"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 md:mt-0 md:ml-2 w-full md:w-auto h-12 px-8 bg-[#4466ff] hover:bg-[#3355ee] text-white font-bold rounded-[16px] transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 mt-1">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-xl mx-auto mb-2 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 flex items-center gap-2 shadow-sm"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}

          {data ? (
            <motion.div
              key={data.quick.tpin}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="space-y-3"
            >
              {/* 1. Remark Section (Moved to Top) */}
              {data.remark.show && (
                <section className="bg-rose-50 border border-rose-100 rounded-[20px] p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                      <ClipboardList className="text-white w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-rose-900 text-base">Remark & Feedback</h3>
                        <span className="px-3 py-1 bg-rose-600 text-white text-[9px] font-extrabold rounded-full uppercase tracking-widest">RM {data.quick.rm} Alert</span>
                      </div>
                      <div className="bg-white/60 backdrop-blur-sm border border-rose-100 rounded-xl p-4 text-rose-900 font-bold text-xs leading-relaxed whitespace-pre-line">
                        {data.remark.body}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] font-extrabold text-rose-400 uppercase tracking-widest">
                        <span>{data.remark.byLine}</span>
                        <span>{data.remark.dateLine}</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 2. Examiner Quick Info */}
              <section className="bg-white rounded-[12px] shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-[#1e295b] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-white font-bold text-xl tracking-tight">Examiner Quick Info</h2>
                    <p className="text-slate-300 text-[11px] mt-0.5 font-medium">Primary profile & eligibility snapshot</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="px-4 py-1.5 bg-[#2d3a75] rounded-full flex items-center gap-2 border border-white/5">
                      <span className="text-slate-300 text-[11px] font-bold">T-Pin</span>
                      <span className="text-[#facc15] font-bold text-sm">{data.quick.tpin}</span>
                    </div>
                    <div className="px-4 py-1.5 bg-[#2d3a75] rounded-full flex items-center gap-2 border border-white/5">
                      <span className="text-slate-300 text-[11px] font-bold">RM</span>
                      <span className="text-[#facc15] font-bold text-sm">{data.quick.rm}</span>
                    </div>
                  </div>
                </div>

                <div className="p-0 grid grid-cols-1 md:grid-cols-2">
                  <div className="border-r border-slate-100">
                    <InfoRow label="Nick Name" value={data.quick.nickName} />
                    <InfoRow label="Mobile 1" value={data.quick.mobile1} wa={getWaLink(data.quick.mobile1)} />
                    <InfoRow label="Mobile 2" value={data.quick.mobile2} wa={getWaLink(data.quick.mobile2)} />
                    <InfoRow label="Nagad Number" value={data.quick.nagadNumber} wa={getWaLink(data.quick.nagadNumber)} />
                    <InfoRow label="HSC GPA" value={data.quick.hscGpa} />
                    <InfoRow label="HSC Batch" value={data.quick.hscBatch} />
                  </div>
                  <div>
                    <InfoRow label="Full Name" value={data.quick.fullName} />
                    <InfoRow label="Institute" value={data.quick.institute} />
                    <InfoRow label="Department" value={data.quick.department} />
                    <InfoRow label="Training Report" value={data.quick.trainingReport} />
                    <InfoRow label="Training Date" value={data.quick.trainingDate} />
                    <InfoRow label="Physical Campus" value={data.quick.physicalCampus} />
                  </div>
                </div>
              </section>

              {/* 2. Assessments Report */}
              <section className="space-y-2">
                <div className="bg-white rounded-[12px] px-6 py-1.5 border border-slate-200 flex items-center gap-3 shadow-sm">
                  <div className="w-[3px] h-4 bg-blue-600 rounded-full" />
                  <h2 className="font-bold text-[#1e295b] text-[15px]">Assessments Report</h2>
                </div>
                
                <div className="bg-white rounded-[12px] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#334155] text-white">
                          <th className="px-6 py-1.5 text-[13px] font-bold">Subjects</th>
                          <th className="px-6 py-1.5 text-[13px] font-bold text-center">% & Set</th>
                          <th className="px-6 py-1.5 text-[13px] font-bold text-center">Date</th>
                          <th className="px-6 py-1.5 text-[13px] font-bold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.assessments.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-1.5 font-bold text-slate-800 text-[13px]">{item.subject}</td>
                            <td className="px-6 py-1.5 text-slate-600 font-bold text-center text-[13px]">
                              {[item.percent, item.set].filter(v => v).join(" | ") || ""}
                            </td>
                            <td className="px-6 py-1.5 text-slate-500 text-[13px] text-center font-medium">{item.date || ""}</td>
                            <td className="px-6 py-1.5 text-right">
                              <StatusBadge status={item.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* 3. Personal Information */}
              <section className="space-y-2">
                <div className="bg-white rounded-[12px] px-6 py-1.5 border border-slate-200 flex items-center gap-3 shadow-sm">
                  <div className="w-[3px] h-4 bg-blue-600 rounded-full" />
                  <h2 className="font-bold text-[#1e295b] text-[15px]">Personal Information</h2>
                </div>

                <div className="bg-white rounded-[12px] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-0 grid grid-cols-1 md:grid-cols-2">
                    <div className="border-r border-slate-100">
                      <InfoRow label="Father's Name" value={data.personal.fathersName} />
                      <InfoRow label="Religion" value={data.personal.religion} />
                      <InfoRow label="Date of Birth" value={data.personal.dateOfBirth} />
                      <InfoRow label="Teams ID" value={data.personal.teamsId} />
                      <InfoRow label="E-mail" value={data.personal.email} />
                      <InfoRow label="Home District" value={data.personal.homeDistrict} />
                      <InfoRow label="Subjects Choice" value={data.personal.subjectsChoice} color="text-blue-600" />
                      <InfoRow label="Version" value={data.personal.versionInterested} />
                      <InfoRow label="Running Program" value={data.personal.runningProgram} />
                    </div>
                    <div>
                      <InfoRow label="Mother's Name" value={data.personal.mothersName} />
                      <InfoRow label="Gender" value={data.personal.gender} />
                      <InfoRow label="HSC Roll" value={data.personal.hscRoll} />
                      <InfoRow label="HSC Reg" value={data.personal.hscReg} />
                      <InfoRow label="HSC Board" value={data.personal.hscBoard} />
                      <InfoRow label="Reg. Date" value={data.personal.regDate} />
                      <InfoRow label="Selected Sub" value={data.personal.selectedSub} />
                      <InfoRow label="ID Checked?" value={data.personal.idChecked} />
                      <InfoRow label="Previous Program" value={data.personal.previousProgram} />
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      
      {/* Footer Branding */}
      <footer className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Powered by Examiner Portal v9.0</span>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function InfoRow({ label, value, wa, color = "text-slate-800" }: { label: string, value: string, wa?: string | null, color?: string }) {
  return (
    <div className="flex items-center px-6 py-1 border-b border-slate-100 last:border-0 min-h-[32px]">
      <span className="text-slate-500 text-[13px] font-medium w-36 shrink-0">{label}</span>
      <div className="flex-1 flex items-center justify-between min-w-0">
        <span className={cn("font-bold text-[13px] leading-tight break-all", color)}>
          {value || ""}
        </span>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="w-5 h-5 bg-[#25d366] rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform shrink-0 ml-2"
          >
            <MessageCircle className="w-3 h-3 text-white fill-white" />
          </a>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Allow") {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-green-600 text-[13px] font-bold">Allow</span>
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
      </div>
    );
  }
  if (status === "Not Allow") {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-rose-600 text-[13px] font-bold">Not Allow</span>
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
      </div>
    );
  }
  return (
    <span className="text-slate-400 text-[13px] font-bold text-right block">No Exam</span>
  );
}
