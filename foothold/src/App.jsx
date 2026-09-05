import React, { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  Search, ChevronDown, ChevronUp, Copy, Check, ShieldAlert,
  SlidersHorizontal, Shuffle, ArrowLeft, CornerDownLeft, X, User,
} from "lucide-react";

// ---------- Design tokens ----------
const COLORS = {
  ink: "#1C2321",
  paper: "#EDEAE1",
  surface: "#F7F5EF",
  forest: "#2F5233",
  forestDark: "#203A25",
  brass: "#A9823D",
  line: "#D9D2C2",
  lineSoft: "#E4DECE",
  muted: "#6B6558",
  alertBg: "#F3E7E1",
  alertText: "#7A3A2B",
  rowHover: "#F2EEE3",
};
const AVATAR_TONES = ["#2F5233", "#A9823D", "#5B4A3F", "#3E5C55", "#8A5A44"];
const SERIF = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

// ---------- Deterministic pseudo-random generation ----------
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
function wordsOverlap(a, b) {
  const aw = a.toLowerCase().split(/\s+/);
  const bw = b.toLowerCase().split(/\s+/);
  return aw.some((w) => w.length > 2 && bw.includes(w));
}
function initials(name) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}
function avatarTone(name) {
  const r = hashString(name)();
  return AVATAR_TONES[Math.floor(r * AVATAR_TONES.length)];
}

const FIRST_NAMES = [
  "Maya", "Daniel", "Priya", "Ethan", "Sofia", "Marcus", "Grace", "Noah",
  "Elena", "Jordan", "Aisha", "Lucas", "Hannah", "Omar", "Zoe", "Tyler",
  "Nadia", "Caleb", "Ravi", "Chloe", "Andre", "Mei", "Isaac", "Fatima",
  "Owen", "Simone", "Wyatt", "Leila", "Jack", "Priyanka",
];
const LAST_NAMES = [
  "Chen", "Okafor", "Martinez", "Kim", "Patel", "Nguyen", "Sullivan",
  "Rossi", "Haddad", "Park", "Silva", "Kowalski", "Torres", "Ahmed",
  "Larsen", "Osei", "Ferreira", "Novak", "Reyes", "Dubois",
];
const RECRUITER_TITLES = ["University Recruiter", "Recruiting Lead", "Talent Partner"];
const OTHER_COMPANIES = [
  "Google", "Meta", "Lockheed Martin", "Raytheon", "Anduril", "Tesla",
  "Amazon", "a robotics startup", "a defense-tech startup", "Microsoft",
];

// Departments a company might have, used only when the search doesn't imply one.
const DEPARTMENTS_GENERIC = [
  "Marketing", "Sales", "Product", "Design", "Data & Analytics", "Finance",
  "Human Resources", "Operations", "Customer Success", "Legal", "Communications",
  "Research & Development", "Platform Engineering", "Applied Machine Learning",
  "Infrastructure", "Systems Engineering",
];
// If the searched role hints at a function, prefer the matching department.
const ROLE_DEPARTMENT_HINTS = [
  [/market/i, "Marketing"], [/sales/i, "Sales"], [/design|ux|ui\b/i, "Design"],
  [/data|scientist|analytics|analyst/i, "Data & Analytics"], [/financ|account/i, "Finance"],
  [/\bhr\b|human resources|people (partner|ops)|recruit/i, "Human Resources"],
  [/operation|\bops\b|logistic/i, "Operations"], [/customer|support|success/i, "Customer Success"],
  [/legal|counsel/i, "Legal"], [/communicat|public relations|\bpr\b/i, "Communications"],
  [/research/i, "Research & Development"], [/product/i, "Product"],
  [/machine learning|\bml\b|\bai\b/i, "Applied Machine Learning"],
  [/infrastructure|devops|site reliability|\bsre\b/i, "Infrastructure"],
  [/systems|embedded|hardware/i, "Systems Engineering"],
  [/software|developer|platform|full[- ]?stack|backend|frontend/i, "Platform Engineering"],
];
function pickDepartment(position, department, rand) {
  if (department.trim()) return department;
  const hint = ROLE_DEPARTMENT_HINTS.find(([re]) => re.test(position));
  return hint ? hint[1] : pick(rand, DEPARTMENTS_GENERIC);
}

// Builds job-title variants rooted in whatever role was actually searched,
// instead of pulling from a fixed unrelated title list.
const QUALIFIER_RE = /\b(intern(ship)?|co-?op|new grad(uate)?|entry[- ]level|trainee)\b/gi;
function titlePoolFor(position) {
  const trimmedPosition = position.trim();
  const baseRole = trimmedPosition.replace(QUALIFIER_RE, "").replace(/\s+/g, " ").trim() || trimmedPosition || "Team Member";
  const hasSeniorWord = /\b(senior|lead|staff|principal|director|head|manager|vp|chief)\b/i.test(baseRole);
  const entryLevel = [
    trimmedPosition || `${baseRole} Intern`,
    `${baseRole} I`,
    `Associate ${baseRole}`,
  ];
  const mid = [
    baseRole,
    `${baseRole} II`,
    hasSeniorWord ? baseRole : `Senior ${baseRole}`,
  ];
  const senior = [
    hasSeniorWord ? baseRole : `Senior ${baseRole}`,
    `Lead ${baseRole}`,
    hasSeniorWord ? baseRole : `Director of ${baseRole}`,
  ];
  return { entryLevel, mid, senior };
}

// Skills a department is presumed to value — powers the skill-match signal.
const DEPARTMENT_SKILLS = {
  "Platform Engineering": ["Distributed Systems", "Kubernetes", "Go", "Python", "Cloud Infrastructure"],
  "Applied Machine Learning": ["Python", "PyTorch", "Machine Learning", "Data Science", "NLP"],
  "Infrastructure": ["Linux", "Networking", "Python", "Site Reliability", "Cloud Infrastructure"],
  "Product": ["Product Strategy", "SQL", "Analytics", "Communication"],
  "Data & Analytics": ["Python", "SQL", "Statistics", "Machine Learning", "Data Visualization"],
  "Systems Engineering": ["C++", "Embedded Systems", "Systems Design", "Python"],
  "Marketing": ["SEO", "Content Strategy", "Analytics", "Communication", "Copywriting"],
  "Sales": ["Salesforce", "Negotiation", "Prospecting", "Communication"],
  "Design": ["Figma", "UX Research", "Prototyping", "Visual Design"],
  "Finance": ["Excel", "Financial Modeling", "Accounting", "Forecasting"],
  "Human Resources": ["Recruiting", "Employee Relations", "HRIS", "Onboarding"],
  "Operations": ["Process Improvement", "Project Management", "Logistics"],
  "Customer Success": ["Communication", "CRM Tools", "Account Management"],
  "Legal": ["Contract Review", "Compliance", "Legal Research"],
  "Communications": ["Copywriting", "Media Relations", "Communication"],
  "Research & Development": ["Research Design", "Data Analysis", "Technical Writing"],
  "University Recruiting": [],
};

// ---------- Search / autocomplete vocabulary ----------
const COMPANIES = [
  "Saronic Technologies", "Google", "Anthropic", "Meta", "Raytheon", "SpaceX",
  "Anduril", "Tesla", "Microsoft", "Amazon", "Lockheed Martin", "Palantir",
  "OpenAI", "NVIDIA",
];
const ROLES = [
  "Software Engineering Intern", "Software Engineer", "Data Science Intern",
  "Product Manager Intern", "Machine Learning Engineer", "Marketing Coordinator",
  "Sales Development Representative", "UX Designer Intern", "Financial Analyst",
  "HR Coordinator", "Supply Chain Analyst", "New Grad Software Engineer",
];
const POPULAR_SEARCHES = [
  "Software Engineering Intern at Saronic Technologies",
  "Marketing Coordinator at Google",
  "UX Designer Intern at Anthropic",
  "Financial Analyst at Raytheon",
  "Sales Development Representative at Microsoft",
];

function buildSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_SEARCHES;
  const candidates = [];
  for (const role of ROLES) for (const company of COMPANIES) candidates.push(`${role} at ${company}`);
  for (const company of COMPANIES) candidates.push(company);
  const matches = candidates
    .filter((c) => c.toLowerCase().includes(q))
    .sort((a, b) => a.toLowerCase().indexOf(q) - b.toLowerCase().indexOf(q));
  return [...new Set(matches)].slice(0, 6);
}

function parseQuery(raw) {
  let text = raw.trim();
  let location = "";
  const inMatch = text.match(/\s+in\s+([A-Za-z .,]+)$/i);
  if (inMatch) { location = inMatch[1].trim(); text = text.slice(0, inMatch.index).trim(); }
  let company = "", position = "";
  const atMatch = text.match(/\s+at\s+(.+)$/i);
  if (atMatch) { company = atMatch[1].trim(); position = text.slice(0, atMatch.index).trim(); }
  else {
    const found = COMPANIES.find((c) => text.toLowerCase().includes(c.toLowerCase()));
    if (found) { company = found; position = text.replace(new RegExp(found, "i"), "").trim(); }
    else { company = text; position = ""; }
  }
  return { company, position, location, department: "" };
}

function generatePeopleBase({ company, position, location, department }) {
  if (!company.trim()) return [];
  const seed = `${company}|${position}|${location}|${department}`.toLowerCase();
  const rand = hashString(seed);
  const count = 9 + Math.floor(rand() * 3);
  const isInternSearch = /intern|new grad|co-op|entry/i.test(position);
  const wantsAustin = /austin/i.test(location);
  const titles = titlePoolFor(position || "Team Member");

  const people = [];
  for (let i = 0; i < count; i++) {
    const isFormer = rand() < 0.28;
    const isRecruiter = i === 0 || rand() < 0.2;
    const seniorityRoll = rand();
    let title;
    if (isRecruiter) title = pick(rand, RECRUITER_TITLES);
    else if (seniorityRoll < 0.4) title = pick(rand, titles.entryLevel);
    else if (seniorityRoll < 0.75) title = pick(rand, titles.mid);
    else title = pick(rand, titles.senior);

    const dept = pickDepartment(position, department, rand);
    const tenureYears = 1 + Math.floor(rand() * 7);
    const university = wantsAustin && rand() < 0.45
      ? "University of Texas at Austin"
      : pick(rand, ["Georgia Tech", "UC Berkeley", "Texas A&M", "University of Michigan", "Purdue", "MIT", "UIUC"]);
    const currentCompany = isFormer ? pick(rand, OTHER_COMPANIES) : company;

    const sharedContext = [];
    if (university === "University of Texas at Austin") sharedContext.push("Also studied at UT Austin");
    if (!isFormer && rand() < 0.3) sharedContext.push("Started there as an intern");
    if (isFormer && rand() < 0.5) sharedContext.push(`Left ${company} within the last 2 years`);

    const signals = {
      roleMatch: position.trim() ? (wordsOverlap(title, position) ? 1 : 0.25) : 0.5,
      recruiter: isRecruiter ? (isInternSearch ? 1 : 0.5) : 0,
      deptMatch: department.trim() ? (dept === department ? 1 : 0.15) : 0.5,
      tenure: Math.min(1, tenureYears / 7),
      context: Math.min(1, sharedContext.length / 2),
      noise: rand(),
    };

    people.push({
      id: i, name: `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`,
      title, department: dept, tenureYears, isFormer, company, currentCompany,
      university, sharedContext, signals,
    });
  }
  return people;
}

const DEFAULT_WEIGHTS = { roleMatch: 25, recruiter: 20, deptMatch: 10, tenure: 10, context: 10, skillMatch: 25 };

function skillMatchInfo(person, profileSkills) {
  const deptSkills = DEPARTMENT_SKILLS[person.department] || [];
  if (deptSkills.length === 0 || profileSkills.length === 0) return { value: 0.4, matched: [] };
  const matched = deptSkills.filter((d) => profileSkills.some((s) => s.toLowerCase() === d.toLowerCase()));
  return { value: Math.min(1, matched.length / Math.min(3, deptSkills.length)), matched };
}

function scorePerson(person, weights, profileSkills) {
  const sm = skillMatchInfo(person, profileSkills);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const raw =
    person.signals.roleMatch * weights.roleMatch +
    person.signals.recruiter * weights.recruiter +
    person.signals.deptMatch * weights.deptMatch +
    person.signals.tenure * weights.tenure +
    person.signals.context * weights.context +
    sm.value * weights.skillMatch;
  const pct = (raw / totalWeight) * 100;
  const textured = pct * 0.94 + person.signals.noise * 6;
  return Math.max(4, Math.min(99, Math.round(textured)));
}

function scoreBreakdown(person, weights, profileSkills) {
  const sm = skillMatchInfo(person, profileSkills);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const rows = [
    ["Role match", person.signals.roleMatch, weights.roleMatch],
    ["Recruiter access", person.signals.recruiter, weights.recruiter],
    ["Department fit", person.signals.deptMatch, weights.deptMatch],
    ["Tenure", person.signals.tenure, weights.tenure],
    ["Shared context", person.signals.context, weights.context],
    ["Skill match", sm.value, weights.skillMatch],
  ];
  return rows
    .map(([label, signal, w]) => ({ label, contribution: Math.round(((signal * w) / totalWeight) * 100) }))
    .sort((a, b) => b.contribution - a.contribution)
    .filter((r) => r.contribution > 0);
}

const MESSAGE_VARIANTS = {
  recruiter: [
    (p, s, profile, ctx) =>
      `Hi ${p.first},\n\n${ctx.schoolLine} I'm interested in the ${s.position} role on the ${p.department} team at ${s.company}, and wanted to introduce myself ahead of applying. Would you be open to a short chat about what your team looks for and how the process works this cycle?\n\nThanks for considering it,\n${profile.name || "[Your name]"}`,
    (p, s, profile, ctx) =>
      `Hi ${p.first},\n\n${ctx.schoolLine} I've been following ${s.company}'s ${p.department} team and would love to apply for the ${s.position} role with a bit more context first. Is there a good time this week for a quick 10-minute call?\n\nAppreciate it,\n${profile.name || "[Your name]"}`,
  ],
  former: [
    (p, s, profile, ctx) =>
      `Hi ${p.first},\n\n${ctx.schoolLine} I noticed you spent time at ${s.company} before moving to ${p.currentCompany}. I'm exploring the ${s.position} role there and would really value your perspective on the team and interview process, if you have 15 minutes sometime.\n\nThanks either way,\n${profile.name || "[Your name]"}`,
    (p, s, profile, ctx) =>
      `Hi ${p.first},\n\nI'm looking closely at the ${s.position} role at ${s.company} and came across your time there before ${p.currentCompany}. ${ctx.schoolLine} Would you be willing to share what surprised you most about the team, good or bad?\n\nThanks for considering it,\n${profile.name || "[Your name]"}`,
  ],
  current: [
    (p, s, profile, ctx) =>
      `Hi ${p.first},\n\n${ctx.schoolLine} I came across your work on the ${p.department} team at ${s.company} while researching the ${s.position} role.${ctx.contextLine}${ctx.skillLine} Would you be open to a brief call about your experience there?\n\nAppreciate your time,\n${profile.name || "[Your name]"}`,
    (p, s, profile, ctx) =>
      `Hi ${p.first},\n\nI'm targeting the ${s.position} role on ${p.department} at ${s.company} and wanted to reach out directly rather than just apply cold.${ctx.contextLine}${ctx.skillLine} ${ctx.schoolLine} Open to a quick chat about what the team's working on?\n\nThanks,\n${profile.name || "[Your name]"}`,
  ],
};

function draftMessage(person, searchParams, profile, variant) {
  const first = person.name.split(" ")[0];
  const sm = skillMatchInfo(person, profile.skills || []);
  const ctx = {
    schoolLine: profile.school
      ? `I'm a student at ${profile.school}${profile.major ? ` studying ${profile.major}` : ""}.`
      : "I'm a student exploring roles in this space.",
    contextLine: person.sharedContext.length ? ` ${person.sharedContext[0]} — small world.` : "",
    skillLine: sm.matched.length ? ` I've also worked with ${sm.matched[0]}, which seems relevant to the team.` : "",
  };
  const bucket = person.title.toLowerCase().includes("recruit") || person.title.toLowerCase().includes("talent")
    ? "recruiter" : person.isFormer ? "former" : "current";
  const variants = MESSAGE_VARIANTS[bucket];
  const fn = variants[variant % variants.length];
  return fn({ ...person, first }, searchParams, profile, ctx);
}

// ---------- Small UI pieces ----------
function ScoreBar({ score }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 92 }}>
      <div style={{ width: 60, height: 5, background: COLORS.line, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: COLORS.brass, transition: "width 400ms ease" }} />
      </div>
      <span style={{ fontSize: 12, color: COLORS.muted, fontVariantNumeric: "tabular-nums", width: 20 }}>{score}</span>
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: avatarTone(name), color: "#F7F5EF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 13, letterSpacing: 0.3 }}>
      {initials(name)}
    </div>
  );
}

function Highlighted({ text, query }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (<>{text.slice(0, idx)}<strong style={{ fontWeight: 600 }}>{text.slice(idx, idx + query.trim().length)}</strong>{text.slice(idx + query.trim().length)}</>);
}

function SearchBox({ value, onChange, onSubmit, size, autoFocus }) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(() => buildSuggestions(value), [value]);
  const showDropdown = focused && suggestions.length > 0;

  useEffect(() => setActiveIndex(-1), [value, focused]);

  const commit = (text) => { onChange(text); onSubmit(text); setFocused(false); };

  const handleKeyDown = (e) => {
    if (!showDropdown) { if (e.key === "Enter") commit(value); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") { e.preventDefault(); commit(activeIndex >= 0 ? suggestions[activeIndex] : value); }
    else if (e.key === "Escape") setFocused(false);
  };

  const big = size === "large";
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: `1.5px solid ${focused ? COLORS.forest : COLORS.line}`, borderRadius: big ? 8 : 5, padding: big ? "14px 18px" : "9px 14px", boxShadow: focused ? "0 2px 10px rgba(28,35,33,0.08)" : "none", transition: "border-color 150ms ease, box-shadow 150ms ease" }}>
        <Search size={big ? 19 : 16} color={COLORS.muted} style={{ flexShrink: 0 }} />
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder="What are you looking for? Try a company, or a role at a company…"
          style={{ flex: 1, border: "none", outline: "none", fontSize: big ? 17 : 14, fontFamily: SANS, color: COLORS.ink, background: "transparent" }}
        />
        {value && (
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => onChange("")} style={{ border: "none", background: "transparent", color: COLORS.muted, cursor: "pointer", fontSize: big ? 16 : 13, padding: 2 }} aria-label="Clear search">×</button>
        )}
      </div>
      {showDropdown && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "white", border: `1px solid ${COLORS.line}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(28,35,33,0.12)", overflow: "hidden", zIndex: 20 }}>
          {!value.trim() && <div style={{ fontSize: 11, color: COLORS.muted, padding: "10px 16px 4px" }}>Popular searches</div>}
          {suggestions.map((s, i) => (
            <button key={s} onMouseDown={(e) => e.preventDefault()} onClick={() => commit(s)} onMouseEnter={() => setActiveIndex(i)}
              style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, border: "none", background: activeIndex === i ? COLORS.rowHover : "transparent", padding: "10px 16px", fontSize: 14, fontFamily: SANS, color: COLORS.ink, cursor: "pointer" }}>
              <Search size={14} color={COLORS.muted} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlighted text={s} query={value} /></span>
              {activeIndex === i && <CornerDownLeft size={13} color={COLORS.muted} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Tag input (skills, target roles, locations) ----------
// forwardRef exposes flush(), so the parent form can commit whatever's
// still typed in the box (but not yet turned into a chip) at submit time.
const TagInput = forwardRef(function TagInput({ label, values, onChange, placeholder, tone }, ref) {
  const [text, setText] = useState("");
  const color = tone === "brass" ? COLORS.brass : COLORS.forest;

  const commit = (raw) => {
    const v = raw.trim();
    if (!v) return values;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) { setText(""); return values; }
    const next = [...values, v];
    onChange(next);
    setText("");
    return next;
  };

  useImperativeHandle(ref, () => ({
    flush: () => commit(text),
  }));

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(text); }
    else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
  };

  return (
    <div>
      <span style={{ display: "block", fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: 8, background: "white" }}>
        {values.map((v) => (
          <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${color}1A`, color, borderRadius: 3, padding: "3px 8px", fontSize: 12.5 }}>
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} style={{ border: "none", background: "transparent", color, cursor: "pointer", padding: 0, display: "flex" }} aria-label={`Remove ${v}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(text)}
          placeholder={values.length ? "" : placeholder}
          style={{ flex: 1, minWidth: 100, border: "none", outline: "none", fontSize: 13.5, fontFamily: SANS, padding: "3px 2px" }}
        />
      </div>
    </div>
  );
});

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, color: COLORS.muted, marginBottom: 5 }}>{label}</span>
      <input
        value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", border: `1px solid ${COLORS.line}`, borderRadius: 3, padding: "8px 10px", fontSize: 14, fontFamily: SANS, background: "white", color: COLORS.ink, boxSizing: "border-box", outline: "none", transition: "border-color 150ms ease" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = COLORS.forest)}
        onBlur={(e) => (e.currentTarget.style.borderColor = COLORS.line)}
      />
    </label>
  );
}

function WeightSlider({ label, value, onChange }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
        <span style={{ color: COLORS.ink }}>{label}</span>
        <span style={{ color: COLORS.muted, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: COLORS.forest }} />
    </div>
  );
}

function PersonCard({ person, rank, expanded, onToggle, searchParams, profile, weights, delay }) {
  const [copied, setCopied] = useState(false);
  const [variant, setVariant] = useState(0);
  const score = scorePerson(person, weights, profile.skills);
  const breakdown = scoreBreakdown(person, weights, profile.skills);
  const sm = skillMatchInfo(person, profile.skills);
  const message = useMemo(() => draftMessage(person, searchParams, profile, variant), [person, searchParams, profile, variant]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch (e) {}
  };

  return (
    <div className="foothold-row" style={{ borderBottom: `1px solid ${COLORS.lineSoft}`, animation: `foothold-in 320ms ease both`, animationDelay: `${delay}ms` }}>
      <button onClick={onToggle} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "14px 8px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", borderRadius: 4, transition: "background 150ms ease" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.rowHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <span style={{ fontFamily: SERIF, fontSize: 14, color: COLORS.muted, width: 16, flexShrink: 0 }}>{rank}</span>
        <Avatar name={person.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: SERIF, fontSize: 16.5, color: COLORS.ink }}>{person.name}</span>
            {person.isFormer && <span style={{ fontSize: 12, color: COLORS.muted }}>now at {person.currentCompany}</span>}
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
            {person.title} · {person.department} · {person.tenureYears}yr {person.isFormer ? `at ${person.company}` : "there"}
          </div>
          {(person.sharedContext.length > 0 || sm.matched.length > 0) && (
            <div style={{ fontSize: 12, color: COLORS.forest, marginTop: 4 }}>
              {[...person.sharedContext, sm.matched.length ? `Matches your skills: ${sm.matched.join(", ")}` : null].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <ScoreBar score={score} />
        {expanded ? <ChevronUp size={16} color={COLORS.muted} /> : <ChevronDown size={16} color={COLORS.muted} />}
      </button>

      <div style={{ display: "grid", gridTemplateRows: expanded ? "1fr" : "0fr", transition: "grid-template-rows 260ms ease" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ padding: "4px 8px 22px 62px", display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: 11.5, color: COLORS.muted, marginBottom: 8 }}>Why they're ranked here</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {breakdown.map((b) => (
                  <div key={b.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, gap: 16 }}>
                    <span style={{ color: COLORS.ink }}>{b.label}</span>
                    <span style={{ color: COLORS.brass, fontVariantNumeric: "tabular-nums" }}>+{b.contribution}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, color: COLORS.muted }}>Draft message</span>
                <button onClick={() => setVariant((v) => v + 1)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: COLORS.muted, fontSize: 12, cursor: "pointer", padding: 0 }}>
                  <Shuffle size={12} /> Try another phrasing
                </button>
              </div>
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 3, padding: 14, fontSize: 13.5, lineHeight: 1.6, color: COLORS.ink, whiteSpace: "pre-wrap" }}>
                {message}
              </div>
              <button onClick={handleCopy} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: copied ? COLORS.forest : "transparent", color: copied ? COLORS.surface : COLORS.forest, border: `1px solid ${COLORS.forest}`, fontSize: 13, padding: "6px 12px", borderRadius: 3, cursor: "pointer", fontFamily: SANS, transition: "all 150ms ease" }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy message"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FILTERS = ["All", "Current", "Former", "Recruiters"];
const SORTS = ["Relevance", "Longest tenure", "Name A–Z"];
const EXPERIENCE_LEVELS = ["Seeking an internship", "Seeking a new-grad role", "Seeking experienced hire"];
const GLOBAL_STYLE = `
  @keyframes foothold-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes foothold-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @media (prefers-reduced-motion: reduce) { .foothold-row, .foothold-rise { animation: none !important; } }
  input[type="range"] { height: 4px; }
`;

function ProfileSetup({ profile, onChange, onSubmit, editing }) {
  const [error, setError] = useState("");
  const skillsRef = useRef(null);
  const rolesRef = useRef(null);
  const locationsRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Commit any text still sitting in a tag box (typed but not yet
    // turned into a chip with Enter) before checking whether we can proceed.
    const finalSkills = skillsRef.current ? skillsRef.current.flush() : profile.skills;
    rolesRef.current && rolesRef.current.flush();
    locationsRef.current && locationsRef.current.flush();

    if (!profile.name.trim() || !profile.school.trim() || finalSkills.length === 0) {
      const missing = [];
      if (!profile.name.trim()) missing.push("your name");
      if (!profile.school.trim()) missing.push("your school");
      if (finalSkills.length === 0) missing.push("at least one skill (type it, then press Enter)");
      setError(`Missing: ${missing.join(", ")}.`);
      return;
    }
    setError("");
    onSubmit();
  };

  return (
    <div style={{ fontFamily: SANS, background: COLORS.paper, color: COLORS.ink, minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{GLOBAL_STYLE}</style>
      <div className="foothold-rise" style={{ width: "100%", maxWidth: 560 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 30, margin: "0 0 6px", textAlign: "center" }}>
          {editing ? "Your profile" : "Let's set up your profile"}
        </h1>
        <p style={{ color: COLORS.muted, fontSize: 14, textAlign: "center", marginTop: 0, marginBottom: 26 }}>
          This powers how people are ranked for you and what goes into your drafted messages.
        </p>
        {error && (
          <div style={{ display: "flex", gap: 8, background: COLORS.alertBg, color: COLORS.alertText, border: `1px solid ${COLORS.alertText}44`, borderRadius: 4, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Full name" value={profile.name} onChange={(v) => onChange({ ...profile, name: v })} placeholder="Nima Ansari" />
            <Field label="Grad year" value={profile.gradYear} onChange={(v) => onChange({ ...profile, gradYear: v })} placeholder="2027" />
            <Field label="School" value={profile.school} onChange={(v) => onChange({ ...profile, school: v })} />
            <Field label="Major" value={profile.major} onChange={(v) => onChange({ ...profile, major: v })} />
          </div>

          <div>
            <span style={{ display: "block", fontSize: 12, color: COLORS.muted, marginBottom: 5 }}>What you're looking for</span>
            <select
              value={profile.experienceLevel}
              onChange={(e) => onChange({ ...profile, experienceLevel: e.target.value })}
              style={{ width: "100%", border: `1px solid ${COLORS.line}`, borderRadius: 3, padding: "8px 10px", fontSize: 14, fontFamily: SANS, background: "white", color: COLORS.ink }}
            >
              {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <TagInput ref={skillsRef} label="Skills" values={profile.skills} onChange={(v) => onChange({ ...profile, skills: v })} placeholder="Python, SQL, Machine Learning… (Enter to add)" tone="forest" />
          <TagInput ref={rolesRef} label="Target roles (optional)" values={profile.targetRoles} onChange={(v) => onChange({ ...profile, targetRoles: v })} placeholder="Software Engineering Intern…" tone="brass" />
          <TagInput ref={locationsRef} label="Preferred locations (optional)" values={profile.locations} onChange={(v) => onChange({ ...profile, locations: v })} placeholder="Austin, TX…" tone="brass" />

          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 12, color: COLORS.muted, marginBottom: 5 }}>Short bio (optional)</span>
            <textarea
              value={profile.bio}
              onChange={(e) => onChange({ ...profile, bio: e.target.value })}
              rows={2}
              placeholder="A sentence or two about what you're working on or interested in."
              style={{ width: "100%", border: `1px solid ${COLORS.line}`, borderRadius: 3, padding: "8px 10px", fontSize: 13.5, fontFamily: SANS, color: COLORS.ink, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>

          <button type="submit" style={{ background: COLORS.forest, color: COLORS.surface, border: "none", padding: "11px 18px", borderRadius: 3, fontSize: 14, cursor: "pointer", fontFamily: SANS, alignSelf: "flex-start" }}>
            {editing ? "Save changes" : "Create profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- Opening animation: a skyline rising, connections lighting up ----------
const INTRO_BUILDINGS = [
  { x: 10, w: 62, h: 150 }, { x: 84, w: 46, h: 210 }, { x: 140, w: 80, h: 130 },
  { x: 232, w: 54, h: 250 }, { x: 296, w: 92, h: 170 }, { x: 400, w: 64, h: 230 },
  { x: 476, w: 50, h: 140 }, { x: 538, w: 78, h: 200 }, { x: 626, w: 58, h: 160 },
  { x: 694, w: 88, h: 220 }, { x: 792, w: 48, h: 120 },
];
const INTRO_NODES = [
  { x: 60, y: 70 }, { x: 190, y: 45 }, { x: 330, y: 80 }, { x: 470, y: 40 },
  { x: 600, y: 65 }, { x: 730, y: 50 },
];

function BuildingGroup({ b, i }) {
  const baseline = 420;
  const rows = Math.max(2, Math.floor((b.h - 20) / 26));
  const cols = Math.max(1, Math.floor((b.w - 14) / 20));
  const windows = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = (r + c + i) % 3 === 0;
      if (!lit) continue;
      windows.push(
        <rect
          key={`${r}-${c}`}
          x={b.x + 8 + c * 20}
          y={baseline - b.h + 14 + r * 26}
          width={8} height={11}
          fill={COLORS.brass}
          opacity={0}
          style={{ animation: `intro-window 400ms ease forwards`, animationDelay: `${1100 + i * 90 + r * 60 + c * 40}ms` }}
        />
      );
    }
  }
  return (
    <g>
      <rect
        x={b.x} width={b.w} height={b.h} y={baseline}
        fill={i % 2 === 0 ? COLORS.forestDark : COLORS.ink}
        opacity={0.94}
        style={{ transformOrigin: `${b.x + b.w / 2}px ${baseline + b.h}px`, animation: `intro-rise 900ms cubic-bezier(.2,.8,.2,1) forwards`, animationDelay: `${i * 70}ms` }}
      />
      {windows}
    </g>
  );
}

function IntroScreen({ onContinue }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={() => ready && onContinue()}
      style={{ position: "relative", width: "100%", height: "100%", minHeight: "100vh", background: `linear-gradient(180deg, ${COLORS.ink} 0%, #2C3B2E 55%, ${COLORS.paper} 100%)`, overflow: "hidden", cursor: ready ? "pointer" : "default", fontFamily: SANS }}
    >
      <style>{`
        @keyframes intro-rise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes intro-window { from { opacity: 0; } to { opacity: 0.9; } }
        @keyframes intro-line { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes intro-node { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
        @keyframes intro-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .intro-anim-el { animation: none !important; opacity: 1 !important; }
        }
      `}</style>

      <svg viewBox="0 0 850 450" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {INTRO_BUILDINGS.map((b, i) => <BuildingGroup key={i} b={b} i={i} />)}

        {/* Connections forming above the skyline */}
        {INTRO_NODES.map((n, i) => {
          if (i === INTRO_NODES.length - 1) return null;
          const next = INTRO_NODES[i + 1];
          const len = Math.hypot(next.x - n.x, next.y - n.y);
          return (
            <line
              key={`l-${i}`} x1={n.x} y1={n.y} x2={next.x} y2={next.y}
              stroke={COLORS.brass} strokeWidth={1.2} opacity={0.7}
              strokeDasharray={len} strokeDashoffset={len}
              pathLength={len}
              style={{ animation: `intro-line 700ms ease forwards`, animationDelay: `${1500 + i * 160}ms` }}
            />
          );
        })}
        {INTRO_NODES.map((n, i) => (
          <circle
            key={`n-${i}`} cx={n.x} cy={n.y} r={4.5} fill={COLORS.brass}
            opacity={0}
            style={{ transformOrigin: `${n.x}px ${n.y}px`, animation: `intro-node 400ms ease forwards`, animationDelay: `${1450 + i * 160}ms` }}
          />
        ))}

        {/* A path finding its way from outside into the skyline */}
        <path d="M -20,300 Q 260,190 430,255 T 800,190" fill="none" stroke={COLORS.brass} strokeWidth={2} opacity={0.55}
          strokeDasharray="900" strokeDashoffset="900"
          style={{ animation: `intro-line 1600ms ease forwards`, animationDelay: "2050ms" }} />
        <circle r={5} fill={COLORS.paper} opacity={0} style={{ animation: "intro-node 300ms ease forwards", animationDelay: "2050ms" }}>
          <animateMotion path="M -20,300 Q 260,190 430,255 T 800,190" dur="1.6s" begin="2.05s" fill="freeze" />
        </circle>
      </svg>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: "12%", textAlign: "center" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 46, color: COLORS.surface, margin: 0, opacity: 0, animation: "intro-fade-up 700ms ease forwards", animationDelay: "2500ms", textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
          Foothold
        </h1>
        <p style={{ color: COLORS.surface, opacity: 0, fontSize: 15, margin: "8px 0 26px", animation: "intro-fade-up 700ms ease forwards", animationDelay: "2700ms" }}>
          A warmer way into the team you're trying to join.
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onContinue(); }}
          style={{
            opacity: 0, animation: "intro-fade-up 700ms ease forwards", animationDelay: "2950ms",
            background: COLORS.brass, color: COLORS.ink, border: "none", padding: "11px 24px",
            borderRadius: 3, fontSize: 14, cursor: "pointer", fontFamily: SANS, fontWeight: 500,
          }}
        >
          Enter Foothold
        </button>
        {!ready && (
          <span style={{ position: "absolute", bottom: 14, fontSize: 11, color: COLORS.surface, opacity: 0.6 }}>
            Building the picture…
          </span>
        )}
      </div>
    </div>
  );
}

const EMPTY_PROFILE = {
  name: "", school: "University of Texas at Austin", major: "Data Science & Informatics",
  gradYear: "", experienceLevel: EXPERIENCE_LEVELS[0], skills: [], targetRoles: [], locations: [], bio: "",
};

export default function FootholdApp() {
  const [screen, setScreen] = useState("intro"); // 'intro' | 'profile' | 'landing' | 'results'
  const [returnScreen, setReturnScreen] = useState("landing");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ company: "", position: "", location: "", department: "" });
  const [searchParams, setSearchParams] = useState({ company: "", position: "", location: "", department: "" });
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("Relevance");
  const [showWeights, setShowWeights] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [basePeople, setBasePeople] = useState([]);

  const runSearch = (raw) => {
    if (!raw.trim()) return;
    const parsed = parseQuery(raw);
    setQuery(raw);
    setForm(parsed);
    setLoading(true);
    setExpandedId(null);
    setTimeout(() => {
      setSearchParams(parsed);
      setBasePeople(generatePeopleBase(parsed));
      setLoading(false);
      setScreen("results");
    }, 420);
  };

  const applyRefine = () => {
    setLoading(true);
    setExpandedId(null);
    setTimeout(() => {
      setSearchParams(form);
      setBasePeople(generatePeopleBase(form));
      setLoading(false);
    }, 320);
  };

  const people = useMemo(() => {
    let list = basePeople.map((p) => ({ ...p, score: scorePerson(p, weights, profile.skills) }));
    if (filter === "Current") list = list.filter((p) => !p.isFormer);
    if (filter === "Former") list = list.filter((p) => p.isFormer);
    if (filter === "Recruiters") list = list.filter((p) => p.title.toLowerCase().includes("recruit") || p.title.toLowerCase().includes("talent"));
    if (sort === "Relevance") list.sort((a, b) => b.score - a.score);
    else if (sort === "Longest tenure") list.sort((a, b) => b.tenureYears - a.tenureYears);
    else if (sort === "Name A–Z") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [basePeople, weights, filter, sort, profile.skills]);

  const recommendations = useMemo(() => {
    if (profile.targetRoles.length === 0) return [];
    const loc = profile.locations[0] ? ` in ${profile.locations[0]}` : "";
    return profile.targetRoles.slice(0, 3).map((role, i) => `${role} at ${COMPANIES[i % COMPANIES.length]}${loc}`);
  }, [profile.targetRoles, profile.locations]);

  const editProfile = (from) => { setReturnScreen(from); setScreen("profile"); };
  const finishProfile = () => setScreen(returnScreen === "profile" ? "landing" : returnScreen);

  // ---------- Intro screen ----------
  if (screen === "intro") {
    return <IntroScreen onContinue={() => setScreen("profile")} />;
  }

  // ---------- Profile screen ----------
  if (screen === "profile") {
    return <ProfileSetup profile={profile} onChange={setProfile} onSubmit={finishProfile} editing={returnScreen !== "landing" || basePeople.length > 0} />;
  }

  // ---------- Landing screen ----------
  if (screen === "landing") {
    return (
      <div style={{ fontFamily: SANS, background: COLORS.paper, color: COLORS.ink, minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{GLOBAL_STYLE}</style>
        <div className="foothold-rise" style={{ animation: "foothold-rise 380ms ease both", width: "100%", maxWidth: 560, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={() => editProfile("landing")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${COLORS.line}`, color: COLORS.muted, padding: "5px 10px", borderRadius: 3, fontSize: 12, cursor: "pointer", fontFamily: SANS }}>
              <User size={12} /> {profile.name ? profile.name.split(" ")[0] : "Edit profile"}
            </button>
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 40, margin: "0 0 8px" }}>Foothold</h1>
          <p style={{ color: COLORS.muted, fontSize: 15, marginTop: 0, marginBottom: 28 }}>
            A warmer way into the team you're trying to join.
          </p>
          <SearchBox value={query} onChange={setQuery} onSubmit={runSearch} size="large" autoFocus />

          {recommendations.length > 0 && (
            <div style={{ marginTop: 20, textAlign: "left" }}>
              <div style={{ fontSize: 11.5, color: COLORS.muted, marginBottom: 8 }}>Recommended for you</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recommendations.map((r) => (
                  <button key={r} onClick={() => runSearch(r)} style={{ textAlign: "left", background: "white", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "9px 12px", fontSize: 13.5, color: COLORS.ink, cursor: "pointer", fontFamily: SANS }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p style={{ color: COLORS.muted, fontSize: 12.5, marginTop: 16 }}>
            Try "Software Engineering Intern at Saronic Technologies" or just a company name.
          </p>
          <div style={{ display: "flex", gap: 8, background: COLORS.alertBg, color: COLORS.alertText, border: `1px solid ${COLORS.alertText}22`, borderRadius: 3, padding: "9px 13px", fontSize: 12, lineHeight: 1.5, marginTop: 20, textAlign: "left" }}>
            <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Results here are synthetic demo profiles, not real people — no scraped contact data.</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Results screen ----------
  return (
    <div style={{ fontFamily: SANS, background: COLORS.paper, color: COLORS.ink, minHeight: "100%", padding: "20px 20px 60px" }}>
      <style>{GLOBAL_STYLE}</style>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <button onClick={() => { setScreen("landing"); setQuery(""); }} style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13, flexShrink: 0 }}>
            <ArrowLeft size={15} />
          </button>
          <h1 onClick={() => { setScreen("landing"); setQuery(""); }} style={{ fontFamily: SERIF, fontSize: 21, margin: 0, cursor: "pointer", flexShrink: 0 }}>Foothold</h1>
          <div style={{ flex: 1 }}>
            <SearchBox value={query} onChange={setQuery} onSubmit={runSearch} size="small" />
          </div>
          <button onClick={() => editProfile("results")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${COLORS.line}`, color: COLORS.muted, padding: "7px 10px", borderRadius: 3, fontSize: 12, cursor: "pointer", fontFamily: SANS, flexShrink: 0 }}>
            <User size={12} /> {profile.name ? profile.name.split(" ")[0] : "Profile"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, background: COLORS.alertBg, color: COLORS.alertText, border: `1px solid ${COLORS.alertText}22`, borderRadius: 3, padding: "10px 14px", fontSize: 12.5, lineHeight: 1.5, marginBottom: 20 }}>
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Synthetic demo profiles only — no real people or scraped contact data. A production version would draw from public professional profiles people have made discoverable, and route outreach through platform messaging rather than harvested emails or phone numbers.</span>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setShowRefine((s) => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${COLORS.line}`, color: COLORS.ink, padding: "7px 12px", borderRadius: 3, fontSize: 13, cursor: "pointer", fontFamily: SANS }}>
            Refine search {showRefine ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={() => setShowWeights((s) => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${COLORS.line}`, color: COLORS.ink, padding: "7px 12px", borderRadius: 3, fontSize: 13, cursor: "pointer", fontFamily: SANS }}>
            <SlidersHorizontal size={13} /> Adjust ranking
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateRows: showRefine ? "1fr" : "0fr", transition: "grid-template-rows 220ms ease" }}>
          <div style={{ overflow: "hidden" }}>
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
                <Field label="Position" value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
                <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
                <Field label="Department (optional)" value={form.department} onChange={(v) => setForm({ ...form, department: v })} placeholder="e.g. Platform Engineering" />
              </div>
              <button onClick={applyRefine} style={{ background: COLORS.forest, color: COLORS.surface, border: "none", padding: "8px 16px", borderRadius: 3, fontSize: 13, cursor: "pointer", fontFamily: SANS }}>
                Update results
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateRows: showWeights ? "1fr" : "0fr", transition: "grid-template-rows 220ms ease" }}>
          <div style={{ overflow: "hidden" }}>
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: 18, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <WeightSlider label="Role match" value={weights.roleMatch} onChange={(v) => setWeights({ ...weights, roleMatch: v })} />
              <WeightSlider label="Recruiter access" value={weights.recruiter} onChange={(v) => setWeights({ ...weights, recruiter: v })} />
              <WeightSlider label="Department fit" value={weights.deptMatch} onChange={(v) => setWeights({ ...weights, deptMatch: v })} />
              <WeightSlider label="Tenure" value={weights.tenure} onChange={(v) => setWeights({ ...weights, tenure: v })} />
              <WeightSlider label="Shared context" value={weights.context} onChange={(v) => setWeights({ ...weights, context: v })} />
              <WeightSlider label="Skill match" value={weights.skillMatch} onChange={(v) => setWeights({ ...weights, skillMatch: v })} />
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button onClick={() => setWeights(DEFAULT_WEIGHTS)} style={{ background: "transparent", border: "none", color: COLORS.muted, fontSize: 12.5, cursor: "pointer", padding: 0 }}>
                  Reset to default weighting
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 18, margin: 0 }}>
              People at {searchParams.company}
              {searchParams.location && <span style={{ color: COLORS.muted, fontSize: 14 }}> · {searchParams.location}</span>}
            </h2>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {FILTERS.map((f) => (
                  <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? COLORS.forest : "transparent", color: filter === f ? COLORS.surface : COLORS.muted, border: `1px solid ${filter === f ? COLORS.forest : COLORS.line}`, borderRadius: 3, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: SANS, transition: "all 150ms ease" }}>
                    {f}
                  </button>
                ))}
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 3, padding: "4px 8px", fontSize: 12, color: COLORS.ink, background: "white", fontFamily: SANS }}>
                {SORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ height: 54, background: COLORS.surface, borderRadius: 4, animation: "foothold-in 400ms ease both", animationDelay: `${i * 70}ms`, opacity: 0.6 }} />
              ))}
            </div>
          ) : (
            <div>
              {people.map((p, i) => (
                <PersonCard key={p.id} person={p} rank={i + 1} expanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} searchParams={searchParams} profile={profile} weights={weights} delay={Math.min(i * 40, 240)} />
              ))}
              {people.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
                  No one matches this filter yet. Try "All" or widen your search.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
