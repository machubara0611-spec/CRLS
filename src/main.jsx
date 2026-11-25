import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CANYON,
  DATA,
  HELI_IMG,
  HQ,
  LANGS,
  RULES,
  SPOT_IMG,
  SVS,
  SVS_IMG,
  T,
  TASKS,
  TOWER,
  TYRANT_IMG,
} from "./data.js";
import "./styles.css";

const STATUS = [
  { key: "mud", color: "#b1f26c" },
  { key: "grass", color: "#57c8f2" },
  { key: "no", color: "#ff727c" },
  { key: "none", color: "#78828c" },
];
const RANKS = ["R5", "R4", "R3", "R2", "R1", "?"];
const VIEW_IDS = ["tasks", "svs", "rules", "hq", "members"];
const SLOT_JST = [11, 15, 19, 23, 3, 7];
const DAY_MS = 864e5;
const HOUR_MS = 36e5;
const REF_MON = Date.UTC(2026, 10, 16, 2, 0);
const AT_TZ = "Etc/GMT+2";
const TZ_LIST = [
  "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Manila",
  "Asia/Bangkok", "Asia/Ho_Chi_Minh", "Asia/Jakarta", "Asia/Kolkata",
  "Australia/Sydney", "Europe/London", "Europe/Paris", "Europe/Rome",
  "America/New_York", "America/Chicago", "America/Mexico_City",
  "America/Los_Angeles", "America/Sao_Paulo", "UTC",
];
const CAT_COLORS = {
  build: "#f5bd55",
  research: "#55caf2",
  hero: "#bf8bff",
  army: "#ff727c",
  car: "#72e0a2",
};
const DAYDEF = [
  { color: "#72e0a2", slots: ["build", "research", "car", "hero", "army", "car"], match: [2, 5] },
  { color: "#f5bd55", slots: ["research", "hero", "build", "army", "car", "build"], match: [2, 5] },
  { color: "#55caf2", slots: ["hero", "army", "research", "car", "build", "research"], match: [2, 5] },
  { color: "#bf8bff", slots: ["army", "car", "hero", "build", "research", "hero"], match: [2, 5] },
  { color: "#b1f26c", slots: ["car", "build", "army", "research", "hero", "army"], match: [0, 1, 2, 3, 5] },
  { color: "#ff727c", slots: ["research", "car", "hero", "build", "army", "hero"], match: [] },
  { color: "#78828c", slots: ["car", "build", "army", "research", "hero", "army"], match: [] },
];
const SQUADS = {
  A: { box: [238, 5, 655, 205], fill: "#e9f3e6", stroke: "#3f9a4c", label: [262, 52, "start"], hq: [["cap", 292, 150], [2, 459, 105], [5, 517, 175], [3, 650, 175], [4, 829, 93]] },
  B: { box: [720, 218, 295, 520], fill: "#fbeaea", stroke: "#c94a4a", label: [1000, 262, "end"], hq: [[4, 810, 290], [3, 761, 426], [5, 955, 514], ["cap", 761, 674], [2, 864, 674]] },
  C: { box: [180, 760, 558, 206], fill: "#e8eef9", stroke: "#3e66b8", label: [725, 945, "end"], hq: [["cap", 219, 866], [2, 364, 922], [3, 498, 886], [5, 620, 832], [4, 700, 866]] },
  D: { box: [31, 233, 212, 525], fill: "#f8f0de", stroke: "#c98a1e", label: [46, 612, "start"], hq: [[5, 78, 300], [4, 200, 300], [3, 200, 540], [2, 72, 718], ["cap", 188, 718]] },
};
const WATER = [[568, 106], [166, 83], [120, 143], [916, 140], [745, 300], [900, 478], [105, 516], [415, 866], [258, 761], [146, 898], [766, 916], [886, 808]];
const HOSPITALS = [[198, 150], [783, 846]];
const BASES = [[70, 830], [283, 945]];

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem("crls-lang");
    if (LANGS.includes(saved)) return saved;
  } catch {
    // Continue with the browser language when storage is unavailable.
  }
  const browserLanguage = (navigator.language || "en").toLowerCase().split("-")[0];
  const aliases = { fil: "tl", ms: "id", pt: "es" };
  const language = aliases[browserLanguage] || browserLanguage;
  return LANGS.includes(language) ? language : "en";
}

function getInitialTimezone() {
  try {
    return localStorage.getItem("crls-tz") || "auto";
  } catch {
    return "auto";
  }
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";
}

function timeParts(milliseconds, timezone = browserTimezone()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(milliseconds));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    hm: `${values.hour}:${values.minute}`,
    ymd: `${values.year}-${values.month}-${values.day}`,
  };
}

function getWeekStart() {
  const elapsedDays = Math.floor((Date.now() - REF_MON) / DAY_MS);
  return REF_MON + Math.floor(elapsedDays / 7) * 7 * DAY_MS;
}

function gameClock() {
  const elapsed = Date.now() - REF_MON;
  const weekOffset = ((elapsed % (7 * DAY_MS)) + 7 * DAY_MS) % (7 * DAY_MS);
  return { day: Math.floor(weekOffset / DAY_MS), slot: Math.floor((weekOffset % DAY_MS) / (4 * HOUR_MS)) };
}

function replaceTaskTimes(text, weekStart, timezone) {
  const times = Object.fromEntries(
    SLOT_JST.map((hour, index) => [
      String(hour).padStart(2, "0"),
      timeParts(weekStart + index * 4 * HOUR_MS, timezone).hm,
    ]),
  );
  return text.replace(/\{(\d\d)\}/g, (match, hour) => times[hour] || match);
}

function displayNumber(value) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function displayResource(value) {
  if (!value) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(3).replace(/\.?0+$/, "")}G`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  return `${(value / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
}

function AnimatedNumber({ value, suffix = "" }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return undefined;
    }
    let frame;
    const started = performance.now();
    const duration = 1100;
    const tick = (now) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - (1 - progress) ** 4;
      setShown(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const formatted = value % 1 === 0
    ? Math.round(shown).toLocaleString("en-US")
    : shown.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <>{formatted}{suffix}</>;
}

function richText(text) {
  return text.split("**").map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
  );
}

function Ticker() {
  const items = ["ALLIANCE ONLINE", "NO ONE FIGHTS ALONE", "PREPARE · COORDINATE · CONQUER", "CRLS · LAST Z"];
  return <div className="ticker" aria-label="Alliance announcements">
    <span className="sr-only">Alliance online. No one fights alone. Prepare, coordinate, conquer. CRLS Last Z.</span>
    <div className="ticker-track" aria-hidden="true">
      {[0, 1].map((copy) => <div className="ticker-group" key={copy}>
        {items.map((item) => <span className="ticker-item" key={`${copy}-${item}`}>{item}<i>✳</i></span>)}
      </div>)}
    </div>
  </div>;
}

function ScrollProgress() {
  const barRef = useRef(null);
  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
        if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return <div ref={barRef} className="scroll-progress" aria-hidden="true" />;
}

function Header({ language, setLanguage, activeView }) {
  const labels = {
    tasks: TASKS[language].tab,
    svs: SVS[language].tab,
    rules: RULES.tab[language],
    hq: HQ.L[language].tab,
    members: T[language].title,
  };
  return (
    <header className="topbar">
      <a className="brand" href="#tasks" aria-label="CRLS Last Z command center">
        <span className="brand-mark"><span /></span>
        <span className="brand-copy"><strong>CRLS</strong><small>LAST Z · ALLIANCE HQ</small></span>
      </a>
      <div className="topbar-status"><span className="signal-dot" /> ALLIANCE COMMAND <i /> {labels[activeView]}</div>
      <label className="language-picker">
        <span aria-hidden="true">◎</span>
        <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language">
          {LANGS.map((code) => <option value={code} key={code}>{T[code].label}</option>)}
        </select>
      </label>
    </header>
  );
}

function Sidebar({ language, activeView, setActiveView }) {
  const links = [
    { id: "tasks", icon: "◷", label: TASKS[language].tab, eyebrow: "01" },
    { id: "svs", icon: "⚔", label: SVS[language].tab, eyebrow: "02" },
    { id: "rules", icon: "⌖", label: RULES.tab[language], eyebrow: "03" },
    { id: "hq", icon: "⌂", label: HQ.L[language].tab, eyebrow: "04" },
    { id: "members", icon: "◉", label: T[language].title, eyebrow: "05" },
  ];
  return (
    <aside className="sidebar">
      <div className="side-label">OPERATIONS</div>
      <nav className="side-nav" aria-label="Main navigation">
        {links.map(({ id, icon, label, eyebrow }) => (
          <a
            href={`#${id}`}
            key={id}
            className={`side-link ${activeView === id ? "active" : ""}`}
            aria-current={activeView === id ? "page" : undefined}
            onClick={() => setActiveView(id)}
          >
            <span className="side-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
            <small>{eyebrow}</small>
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="sidebar-emblem">C</span>
        <span><strong>CRLS</strong><small>UNITED · READY · STRONG</small></span>
      </div>
    </aside>
  );
}

function PageHeading({ eyebrow, title, description, trailing }) {
  const words = title.trim().split(/\s+/);
  return (
    <section className="page-heading">
      <div className="hero-copy">
        <div className="eyebrow"><span />{eyebrow}</div>
        <h1 aria-label={title}><span className="hero-title-words" aria-hidden="true">{words.map((word, index) => (
          <span className={`hero-word ${index === words.length - 1 ? "hero-word-accent" : ""}`} key={`${word}-${index}`} style={{ "--word-index": index }}>{word}</span>
        ))}</span></h1>
        {description && <p>{description}</p>}
      </div>
      <div className="hero-side">
        {trailing || <div className="hero-emblem" aria-hidden="true"><span className="hero-emblem-core">C</span><i /><b /><small>CRLS / LV.∞</small></div>}
      </div>
    </section>
  );
}

function SectionTitle({ children, detail }) {
  return <div className="section-title"><h2>{children}</h2>{detail && <span>{detail}</span>}</div>;
}

function MemberView({ language }) {
  const L = T[language];
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [sortKey, setSortKey] = useState("p");
  const [sortDirection, setSortDirection] = useState(-1);
  const [toast, setToast] = useState("");
  const rankedMembers = useMemo(() => {
    const sortedPowers = DATA.map((member) => member.p).sort((a, b) => b - a);
    return DATA.map((member) => ({ ...member, place: sortedPowers.indexOf(member.p) + 1 }));
  }, []);
  const statusCounts = useMemo(
    () => Object.fromEntries(STATUS.map(({ key }) => [key, DATA.filter((member) => member.s === key).length])),
    [],
  );
  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rankedMembers
      .filter((member) =>
        (statusFilter === "all" || member.s === statusFilter) &&
        (rankFilter === "all" || member.rk === rankFilter) &&
        (!normalizedQuery || member.n.toLowerCase().includes(normalizedQuery)),
      )
      .sort((a, b) => {
        const left = sortKey === "rk" ? RANKS.indexOf(a.rk)
          : sortKey === "s" ? STATUS.findIndex(({ key }) => key === a.s)
            : sortKey === "n" ? a.n.toLowerCase() : a[sortKey];
        const right = sortKey === "rk" ? RANKS.indexOf(b.rk)
          : sortKey === "s" ? STATUS.findIndex(({ key }) => key === b.s)
            : sortKey === "n" ? b.n.toLowerCase() : b[sortKey];
        const comparison = left < right ? -1 : left > right ? 1 : 0;
        return (sortDirection < 0 ? -comparison : comparison) || b.p - a.p;
      });
  }, [rankedMembers, query, statusFilter, rankFilter, sortKey, sortDirection]);
  const totalPower = DATA.reduce((sum, member) => sum + member.p, 0);
  const activeCount = statusCounts.mud + statusCounts.grass;
  const filteredPower = filteredMembers.reduce((sum, member) => sum + member.p, 0);

  function sortBy(key) {
    if (sortKey === key) setSortDirection((direction) => direction * -1);
    else {
      setSortKey(key);
      setSortDirection(["p", "hq", "ap"].includes(key) ? -1 : 1);
    }
  }

  async function exportCsv() {
    const header = [L.place, L.name, L.rank, "HQ", `${L.power} (M)`, `${L.arena} (M)`, "SvS", L.inactive];
    const cell = (value) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = [
      header.map(cell).join(","),
      ...filteredMembers.map((member) =>
        [member.place, member.n, member.rk === "?" ? L.unk : member.rk, member.hq, member.p.toFixed(1), member.ap.toFixed(1), L[member.s], member.ia ? L.inactive : ""]
          .map(cell).join(","),
      ),
    ];
    const csv = rows.join("\r\n");
    let saved = false;
    try {
      const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "CRLS_members_2026-11-14.csv";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      saved = true;
    } catch {
      saved = false;
    }
    if (window.self !== window.top || !saved) {
      try {
        await navigator.clipboard.writeText(csv);
        setToast(saved ? L.copied : L.copiedFb);
      } catch (error) {
        setToast(error instanceof Error ? error.message : String(error));
      }
    }
    window.setTimeout(() => setToast(""), 3500);
  }

  const columns = [
    ["place", L.place], ["n", L.name], ["rk", L.rank], ["hq", "HQ"],
    ["p", L.power], ["ap", L.arena], ["s", "SvS"],
  ];
  return (
    <>
      <PageHeading eyebrow="ALLIANCE ROSTER / 2026" title={L.title} description={L.updated}
        trailing={<span className="live-tag"><span /> ROSTER ACTIVE</span>} />
      <div className="stat-grid">
        {[
          { label: L.members, value: DATA.length, suffix: L.ppl, accent: "lime" },
          { label: L.total, value: totalPower, suffix: "M", accent: "cyan" },
          { label: L.avg, value: totalPower / DATA.length, suffix: "M", accent: "violet" },
          { label: L.going, value: activeCount, suffix: L.ppl, accent: "amber" },
        ].map((stat, index) => (
          <article className={`stat-card ${stat.accent}`} key={stat.label}>
            <span className="stat-index">0{index + 1}</span><span className="stat-label">{stat.label}</span>
            <strong><AnimatedNumber value={stat.value} suffix={stat.suffix} /></strong>
            <span className="stat-rule" />
          </article>
        ))}
      </div>
      <section className="panel attendance-panel">
        <SectionTitle detail={`${DATA.length} ${L.ppl}`}>{L.svsTitle}</SectionTitle>
        <div className="attendance-bar" role="img" aria-label={STATUS.map(({ key }) => `${L[key]} ${statusCounts[key]}`).join(", ")}>
          {STATUS.map(({ key, color }) => <span key={key} style={{ width: `${statusCounts[key] / DATA.length * 100}%`, background: color }} />)}
        </div>
        <div className="attendance-legend">
          {STATUS.map(({ key, color }) => (
            <span key={key}><i style={{ background: color }} />{L[key]} <b>{statusCounts[key]}</b></span>
          ))}
        </div>
      </section>
      <section className="panel roster-panel">
        <div className="roster-head">
          <div><SectionTitle detail={`${filteredMembers.length} / ${DATA.length}`}>{L.list}</SectionTitle>
            <p>{filteredMembers.length ? L.shown(filteredMembers.length, displayNumber(filteredPower)) : L.empty}</p></div>
          <button type="button" className="button-primary" onClick={exportCsv}><span aria-hidden="true">↓</span>{L.csv}</button>
        </div>
        <div className="filter-toolbar">
          <label className="search-field"><span aria-hidden="true">⌕</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L.searchPh} aria-label={L.searchPh} />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
          </label>
          <div className="filter-group" aria-label={L.rank}>
            <span className="filter-label">SvS</span>
            <button type="button" className={statusFilter === "all" ? "filter-chip selected" : "filter-chip"} onClick={() => setStatusFilter("all")}>{L.all}</button>
            {STATUS.map(({ key }) => <button key={key} type="button" className={statusFilter === key ? "filter-chip selected" : "filter-chip"} onClick={() => setStatusFilter(key)}>{L[key]} <span>{statusCounts[key]}</span></button>)}
          </div>
          <div className="filter-group">
            <span className="filter-label">{L.rank}</span>
            <button type="button" className={rankFilter === "all" ? "filter-chip selected" : "filter-chip"} onClick={() => setRankFilter("all")}>{L.all}</button>
            {RANKS.filter((rank) => DATA.some((member) => member.rk === rank)).map((rank) => <button key={rank} type="button" className={rankFilter === rank ? "filter-chip selected" : "filter-chip"} onClick={() => setRankFilter(rank)}>{rank === "?" ? L.unk : rank}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="roster-table">
            <thead><tr>{columns.map(([key, label]) => (
              <th key={key} aria-sort={sortKey === key ? (sortDirection < 0 ? "descending" : "ascending") : undefined} className={["place", "hq", "p", "ap"].includes(key) ? "numeric" : ""}>
                <button type="button" onClick={() => sortBy(key)}>{label}<span aria-hidden="true">{sortKey === key ? (sortDirection < 0 ? " ↓" : " ↑") : ""}</span></button>
              </th>
            ))}</tr></thead>
            <tbody>{filteredMembers.map((member) => {
              const status = STATUS.find(({ key }) => key === member.s);
              return <tr key={member.n} className={member.place <= 3 ? "top-member" : ""}>
                <td className="numeric rank-place">{member.place.toString().padStart(2, "0")}</td>
                <td className="member-name"><i style={{ background: status.color, visibility: member.s === "none" ? "hidden" : "visible" }} />{member.n}{member.ia && <span className="inactive-label">{L.inactive}</span>}</td>
                <td><span className={`rank-badge ${member.rk}`}>{member.rk === "?" ? L.unk : member.rk}</span></td>
                <td className="numeric">{member.hq}</td><td className="numeric power-value">{displayNumber(member.p)}M</td><td className="numeric muted-value">{displayNumber(member.ap)}M</td>
                <td>{member.s !== "none" && <span className={`status-pill ${member.s}`}><i />{L[member.s]}</span>}</td>
              </tr>;
            })}</tbody>
          </table>
          {!filteredMembers.length && <div className="empty-state"><span>⌕</span><strong>{L.empty}</strong></div>}
        </div>
        <div className="roster-footer"><span>{L.note}</span><span role="status">{toast}</span><span>CRLS · {DATA.length} MEMBERS</span></div>
      </section>
    </>
  );
}

function TaskView({ language, timezone, setTimezone }) {
  const L = TASKS[language];
  const now = gameClock();
  const [selectedDay, setSelectedDay] = useState(now.day);
  const currentTimezone = timezone === "auto" ? browserTimezone() : timezone;
  const weekStart = getWeekStart();
  const localTime = (milliseconds) => timeParts(milliseconds, currentTimezone);
  const slotTimes = SLOT_JST.map((_, index) => localTime(weekStart + index * 4 * HOUR_MS).hm);
  const day = DAYDEF[selectedDay];
  const dayStart = weekStart + selectedDay * DAY_MS;
  const dayDate = localTime(dayStart).ymd;
  return (
    <>
      <PageHeading eyebrow="EVENT INTEL / WEEKLY ROTATION" title={L.h1} description={L.lead}
        trailing={<label className="timezone-picker"><span>◷</span><select value={timezone} onChange={(event) => setTimezone(event.target.value)} aria-label={L.tzL}>
          <option value="auto">{L.tzAuto} – {browserTimezone()}</option>{TZ_LIST.map((zone) => <option key={zone} value={zone}>{zone.replace(/_/g, " ")}</option>)}
        </select></label>} />
      <p className="timezone-note">{L.tzNote.replace("{tz}", currentTimezone === AT_TZ ? L.atL : currentTimezone.replace(/_/g, " ")).replace("{t}", localTime(weekStart).hm)}</p>
      <SectionTitle>{L.common}</SectionTitle>
      <div className="task-rule-grid">
        {[["r1t", "r1p"], ["r2t", "r2p"], ["r3t", "r3p"]].map(([titleKey, bodyKey], index) => (
          <article className={`panel task-rule-card rule-${index + 1}`} key={titleKey}>
            <div className="rule-icon">{["◈", "⌁", "✦"][index]}</div><h3>{L[titleKey]}</h3><p>{richText(replaceTaskTimes(L[bodyKey], weekStart, currentTimezone))}</p>
            {index === 0 && <div className="slot-chips">{SLOT_JST.map((hour, slot) => (
              <span className={slot === 2 || slot === 5 ? "hot" : ""} key={hour}>{slotTimes[slot]}{currentTimezone !== AT_TZ && <small> AT {timeParts(weekStart + slot * 4 * HOUR_MS, AT_TZ).hm}</small>}</span>
            ))}</div>}
          </article>
        ))}
      </div>
      <SectionTitle detail={L.week}>{L.detail}</SectionTitle>
      <div className="day-selector" role="tablist" aria-label={L.detail}>
        {DAYDEF.map((item, index) => <button type="button" role="tab" aria-selected={selectedDay === index} key={index} style={{ "--day-color": item.color }} onClick={() => setSelectedDay(index)}>
          <span>{L.wd[index]}</span><small>{L.short[index]}</small>{index === now.day && <i>{L.today}</i>}
        </button>)}
      </div>
      <section className="panel selected-day" style={{ "--day-color": day.color }}>
        <div className="selected-day-header"><div><span className="eyebrow">DAY {String(selectedDay + 1).padStart(2, "0")} / 07</span><h2>{L.wd[selectedDay]}</h2></div><div className="day-theme"><small>{L.themeL}</small><strong>{L.themes[selectedDay]}</strong></div></div>
        <div className="timeline">
          {day.slots.map((category, slot) => {
            const eventTime = localTime(dayStart + slot * 4 * HOUR_MS);
            return <article className={`timeline-slot ${day.match.includes(slot) ? "match-slot" : ""} ${selectedDay === now.day && slot === now.slot ? "current-slot" : ""}`} key={slot}>
              {day.match.includes(slot) && <span className="match-badge">{L.match}</span>}
              <strong>{eventTime.hm}{eventTime.ymd !== dayDate && <sup>+1</sup>}</strong>
              {currentTimezone !== AT_TZ && <span className="alternate-time">AT {timeParts(dayStart + slot * 4 * HOUR_MS, AT_TZ).hm}</span>}
              <span className="slot-name">{L.cats[category]}</span><i style={{ background: CAT_COLORS[category] }} />
            </article>;
          })}
        </div>
        <div className="day-details">
          <article className="detail-card"><h3>{L.tasksT}</h3><div className="task-chips">{L.tasks[selectedDay].map((task) => <span key={task}>{task}</span>)}</div></article>
          <article className="detail-card"><h3>{L.todoT}</h3><ul>{L.todo[selectedDay].map((item, index) => <li key={index}>{richText(replaceTaskTimes(item, weekStart, currentTimezone))}</li>)}</ul></article>
        </div>
      </section>
      <div className="schedule-legend">{Object.keys(CAT_COLORS).map((category) => <span key={category}><i style={{ background: CAT_COLORS[category] }} />{L.cats[category]}</span>)}<span><i className="legend-match" />{L.matchL}</span><span>{L.nextL}</span></div>
      <SectionTitle>{L.week}</SectionTitle>
      <div className="panel table-wrap schedule-table-wrap"><table className="schedule-table">
        <thead><tr><th>{L.thDay}</th><th>{L.thTheme}</th>{SLOT_JST.map((_, index) => <th key={index}>{slotTimes[index]}{localTime(weekStart + index * 4 * HOUR_MS).ymd !== localTime(weekStart).ymd && <sup>+1</sup>}</th>)}</tr></thead>
        <tbody>{DAYDEF.map((definition, index) => <tr key={index} className={index === now.day ? "today-row" : ""}>
          <th>{L.wd[index]}</th><td>{L.short[index]}</td>{definition.slots.map((category, slot) => <td key={slot}><span className={`schedule-cell ${definition.match.includes(slot) ? "is-match" : ""}`} style={{ "--category-color": CAT_COLORS[category] }}>{L.cats[category]}</span></td>)}
        </tr>)}</tbody>
      </table></div>
      <SectionTitle>{L.tipsT}</SectionTitle>
      <article className="panel tips-panel"><ul>{L.tips.map((tip, index) => <li key={index}>{richText(replaceTaskTimes(tip, weekStart, currentTimezone))}</li>)}</ul></article>
      <p className="content-note">{L.note}</p>
    </>
  );
}

function SvsView({ language }) {
  const S = SVS[language];
  const L = TASKS[language];
  const requiredTasks = [4, 5, 6];
  return <>
    <PageHeading eyebrow="BATTLE INTEL / BI-WEEKLY" title={S.title} />
    <SectionTitle>{S.ovT}</SectionTitle>
    <article className="panel svs-overview">
      <div className="overview-copy">{S.ov.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      <div className="week-strip">{[6, 0, 1, 2, 3, 4, 5].map((day, index) => <span className={index === 6 ? "battle-day" : ""} key={day}>{L.wd[day]}</span>)}</div>
      <div className="week-strip-labels"><span>{S.pA}</span><span>{S.pB}</span></div>
    </article>
    <SectionTitle>{S.tT}</SectionTitle>
    <article className="panel svs-task-panel"><p className="svs-lead">{S.tL}</p><ol>{S.tasks.map((task, index) => <li className={requiredTasks.includes(index) ? "required" : ""} key={index}>
      <span className="task-number">{String(index + 1).padStart(2, "0")}</span><span>{task}</span>{requiredTasks.includes(index) && <b>{S.must}</b>}
    </li>)}</ol></article>
    <SectionTitle>{S.mT}</SectionTitle>
    <div className="must-grid">{S.mi.map(([heading, body], index) => <article className="panel must-card" key={heading}><span className="must-number">0{index + 1}</span><h3>{heading}</h3><p>{body}</p></article>)}</div>
    <div className="svs-sides">{[[S.dT, S.d, "defense"], [S.oT, S.o, "offense"]].map(([heading, body, type]) => <article className={`panel battle-side ${type}`} key={heading}><span>{type === "defense" ? "01 / HOLD" : "02 / ADVANCE"}</span><h3>{heading}</h3><p>{body}</p></article>)}</div>
    <figure className="panel image-panel"><img src={SVS_IMG} alt={S.cap} loading="lazy" /><figcaption>{S.cap}</figcaption></figure>
  </>;
}

function RuleCard({ ruleKey, language, timezone }) {
  const rule = RULES[ruleKey];
  const image = { heli: HELI_IMG, tyrant: TYRANT_IMG }[ruleKey];
  const weekStart = getWeekStart();
  const currentTimezone = timezone === "auto" ? browserTimezone() : timezone;
  const localTime = (minutes) => {
    const japanese = ["ja", "zh"].includes(language);
    return `${timeParts(weekStart + minutes * 60000, currentTimezone).hm}${japanese ? "（" : " ("}${currentTimezone === AT_TZ ? TASKS[language].atL : currentTimezone.replace(/_/g, " ")}${japanese ? "）" : ")"}`;
  };
  const replaceTimes = (text) => text.replace(/\{L:(\d+)\}/g, (_match, minutes) => timeParts(weekStart + Number(minutes) * 60000, currentTimezone).hm);
  return <article className="panel guide-card" id={`rule-${ruleKey}`}>
    <div className="guide-card-heading"><span className="guide-diamond" /><h3>{rule.title[language]}</h3></div>
    <div className="guide-body">
      {image && <figure className="guide-image"><img src={image} alt={rule.caption[language]} loading="lazy" /><figcaption>{rule.caption[language]}</figcaption></figure>}
      {rule.plain ? rule.items[language].map((item, index) => <p key={index}>{replaceTimes(item)}</p>) : <ol>{rule.items[language].map((item, index) => {
        const localized = (rule.local || []).includes(index);
        const spot = (rule.liImg || {})[String(index)];
        const content = replaceTimes(localized ? item.replace("{local}", localTime(rule.at)) : item);
        const className = (rule.warn || []).includes(index) ? "warning" : localized ? "local-time" : (rule.tip || []).includes(index) ? "guide-tip" : "";
        return <li className={className} key={index}><span>{content}</span>{spot && <figure className="guide-image"><img src={spot === "spot" ? SPOT_IMG : ""} alt={rule.liCap[language]} loading="lazy" /><figcaption>{rule.liCap[language]}</figcaption></figure>}</li>;
      })}</ol>}
    </div>
  </article>;
}

function SquadMap({ content }) {
  return <svg viewBox="0 0 1010 1000" role="img" aria-label={content.mapTitle} className="canyon-map">
    <rect width="1010" height="1000" fill="#fdfbf7" />
    {Object.entries(SQUADS).map(([name, squad]) => <g key={name}>
      <rect x={squad.box[0]} y={squad.box[1]} width={squad.box[2]} height={squad.box[3]} fill={squad.fill} stroke={squad.stroke} strokeWidth="4" rx="4" />
      {squad.hq.map(([number, x, y], index) => <g key={index}>
        <rect x={x - 38} y={y - 24} width="76" height="48" rx="3" fill="#fff" stroke="#2b211c" strokeWidth="2" />
        <rect x={x - 38} y={y - 24} width="76" height="15" rx="3" fill="#2b211c" />
        <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">HQ</text>
        {[-24, -4, 16].map((dx) => <rect key={dx} x={x + dx} y={y + 2} width="9" height="14" fill="#2b211c" />)}
        {number === "cap" ? <path d={`M${x - 8} ${y - 30} v-25 l20 6 -20 7`} fill="#d23b2a" /> : <text x={x} y={y - 32} textAnchor="middle" fontSize="30" fontWeight="700" fill={squad.stroke}>{number}</text>}
      </g>)}
      <text x={squad.label[0]} y={squad.label[1]} textAnchor={squad.label[2]} fontSize="28" fontWeight="700" fill="#3a2d27" stroke="#fdfbf7" strokeWidth="5" paintOrder="stroke">{content.squadName.replace("{x}", name)}</text>
    </g>)}
    {WATER.map(([x, y], index) => <ellipse key={index} cx={x} cy={y} rx="19" ry="23" fill="#3f86d6" />)}
    {HOSPITALS.map(([x, y], index) => <g key={index}><path d={`M${x} ${y - 34} L${x + 38} ${y + 26} L${x - 38} ${y + 26}Z`} fill="#1d1a19" /><path d={`M${x - 6} ${y + 10} h12 M${x} ${y + 4} v12`} stroke="#fff" strokeWidth="3" /></g>)}
    {BASES.map(([x, y], index) => <g key={index}><path d={`M${x - 40} ${y + 30} V${y - 15} h10 v8 h10 v-8 h10 v-12 l10 -16 l10 16 v12 h10 v8 h10 v-8 h10 V${y + 30} H${x + 8} v-16 a8 8 0 0 0 -16 0 v16 Z`} fill="#1d1a19" /></g>)}
    <image href={TOWER} x="456" y="262" width="124" height="412" />
    <text x="518" y="708" textAnchor="middle" fontSize="26" fontWeight="700" fill="#b8541c">{content.core}</text>
    <circle cx="950" cy="60" r="48" fill="#f6e2dc" stroke="#b8541c" strokeWidth="4" /><text x="950" y="78" textAnchor="middle" fontSize="48">☠</text>
    <text x="1004" y="200" textAnchor="end" fontSize="20" fontWeight="700" fill="#a3261b" stroke="#fdfbf7" strokeWidth="5" paintOrder="stroke">{content.canyonCap}</text>
  </svg>;
}

function CanyonGuide({ language, timezone }) {
  const C = CANYON[language];
  const currentTimezone = timezone === "auto" ? browserTimezone() : timezone;
  const lineup = ["A", "B", "C", "D"];
  return <article className="panel canyon-card" id="rule-canyon">
    <div className="canyon-heading"><span>FIELD PLAN / 04 SQUADS</span><h3>{C.title}</h3><p>{C.sub}</p></div>
    <div className="canyon-content">
      <SectionTitle>{C.schedT}</SectionTitle>
      <div className="canyon-schedule">{[[1, 540], [2, 1380]].map(([team, minutes]) => <div key={team}><span>{C.team.replace("{n}", team)}</span><strong>AT {String(Math.floor(minutes / 60)).padStart(2, "0")}:{String(minutes % 60).padStart(2, "0")}</strong><small>{C.yourT} {timeParts(getWeekStart() + minutes * 60000, currentTimezone).hm}</small></div>)}</div>
      <p className="canyon-vote">{C.vote}</p>
      <div className="phase-list">{C.phases.map(([title, body], index) => <article key={title}><span>PHASE 0{index + 1}</span><h4>{title}</h4><p>{richText(body)}</p></article>)}</div>
      <SectionTitle>{C.mapTitle}</SectionTitle>
      <div className="map-frame"><SquadMap content={C} /></div>
      <ul className="map-legend">{C.legend.map((item, index) => <li key={item}><span>{["≈", "♜", "+", "▮", "⚑", "☠"][index]}</span>{item}</li>)}</ul>
      <SectionTitle>{C.tipsTitle}</SectionTitle>
      <ul className="canyon-tips">{C.tips.map(([heading, body]) => <li key={heading}><strong>{heading}</strong><span> — {body}</span></li>)}</ul>
      <SectionTitle>{C.lineupTitle}</SectionTitle>
      <div className="lineup-table"><div className="lineup-row lineup-header"><span>{C.squad}</span><span>{C.captain}</span>{[2, 3, 4, 5].map((number) => <span key={number}>HQ {number}</span>)}</div>
        {lineup.map((squad) => <div className={`lineup-row squad-${squad}`} key={squad}><span><b>{squad}</b>{C.squad}</span><span>{C.captain}</span>{[2, 3, 4, 5].map((number) => <span key={number}>{number}</span>)}</div>)}
      </div>
    </div>
  </article>;
}

function RulesView({ language, timezone }) {
  const ruleCards = ["rank", "heli", "tyrant", "siege"];
  const navigation = [
    ["rank", RULES.rank.title[language]], ["heli", RULES.heli.title[language]],
    ["canyon", CANYON[language].card], ["tyrant", RULES.tyrant.title[language]], ["siege", RULES.siege.title[language]],
  ];
  return <>
    <PageHeading eyebrow="FIELD MANUAL / ALLIANCE DOCTRINE" title={RULES.tab[language]} />
    <nav className="guide-jump-nav" aria-label="Guide sections">{navigation.map(([id, title], index) => <a href={`#rule-${id}`} key={id}><span>0{index + 1}</span>{title}<b>↗</b></a>)}</nav>
    <div className="guide-list">{ruleCards.slice(0, 2).map((key) => <RuleCard key={key} ruleKey={key} language={language} timezone={timezone} />)}
      <CanyonGuide language={language} timezone={timezone} />
      {ruleCards.slice(2).map((key) => <RuleCard key={key} ruleKey={key} language={language} timezone={timezone} />)}
    </div>
  </>;
}

function HqView({ language }) {
  const L = HQ.L[language];
  const [from, setFrom] = useState(24);
  const [to, setTo] = useState(30);
  const selectedRows = HQ.rows.filter((row) => row.lv > from && row.lv <= to);
  const totals = [
    selectedRows.reduce((sum, row) => sum + row.wn, 0),
    selectedRows.reduce((sum, row) => sum + row.zn, 0),
    selectedRows.reduce((sum, row) => sum + row.fn, 0),
  ];
  return <>
    <PageHeading eyebrow="PROGRESSION / RESOURCE PLANNER" title={L.tab} description={L.lead} />
    <p className="hq-reference"><span>ⓘ</span>{L.ref}</p>
    <section className="panel calculator-panel">
      <div className="calculator-title"><span>⌂</span><div><h2>{L.calcT}</h2><p>{L.total}</p></div></div>
      <div className="calculator-range">
        <label>{L.from}<select value={from} onChange={(event) => { const value = Number(event.target.value); setFrom(value); if (to <= value) setTo(value + 1); }}>{Array.from({ length: 27 }, (_, index) => index + 3).map((level) => <option key={level} value={level}>Lv.{level}</option>)}</select></label>
        <span>→</span>
        <label>{L.to}<select value={to} onChange={(event) => { const value = Number(event.target.value); setTo(value); if (from >= value) setFrom(value - 1); }}>{Array.from({ length: 27 }, (_, index) => index + 4).map((level) => <option key={level} value={level}>Lv.{level}</option>)}</select></label>
      </div>
      <div className="resource-totals">{L.res.map((resource, index) => <div key={resource}><span>{L.total} · {resource}</span><strong>{displayResource(totals[index])}</strong></div>)}</div>
    </section>
    <SectionTitle detail={`${HQ.rows.length} LEVELS`}>{L.lv}</SectionTitle>
    <div className="panel table-wrap hq-table-wrap"><table className="hq-table">
      <thead><tr><th>{L.lv}</th>{L.res.map((resource) => <th className="numeric" key={resource}>{resource}</th>)}<th>{L.pre}</th></tr></thead>
      <tbody>{HQ.rows.map((row) => <tr className={row.lv > from && row.lv <= to ? "in-range" : ""} key={row.lv}>
        <th>Lv.{row.lv}</th><td className="numeric">{row.w}</td><td className="numeric">{row.z}</td><td className="numeric">{row.f}</td>
        <td>{row.pre.map(([level, building], index) => <span className="prerequisite" key={`${building}-${index}`}>{L.bld[building]} Lv.{level}</span>)}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="content-note">{L.note}</p>
  </>;
}

function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [timezone, setTimezone] = useState(getInitialTimezone);
  const contentRef = useRef(null);
  const [activeView, setActiveView] = useState(() => {
    const hash = window.location.hash.slice(1);
    return VIEW_IDS.includes(hash) ? hash : hash.startsWith("rule-") ? "rules" : "tasks";
  });
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.slice(1);
      setActiveView(VIEW_IDS.includes(hash) ? hash : hash.startsWith("rule-") ? "rules" : "tasks");
    };
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  useEffect(() => {
    document.documentElement.lang = { zh: "zh-CN", tl: "fil" }[language] || language;
    document.title = "CRLS | Last Z Command Center";
    try { localStorage.setItem("crls-lang", language); } catch { /* Storage is optional. */ }
  }, [language]);
  useEffect(() => {
    try { localStorage.setItem("crls-tz", timezone); } catch { /* Storage is optional. */ }
  }, [timezone]);
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return undefined;
    const revealItems = [...node.children].filter((child) => !child.classList.contains("site-footer"));
    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return undefined;
    }
    node.classList.add("motion-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -36px 0px" });
    revealItems.forEach((item, index) => {
      item.dataset.reveal = "";
      item.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 55}ms`);
      observer.observe(item);
    });
    return () => {
      observer.disconnect();
      node.classList.remove("motion-ready");
    };
  }, [activeView]);

  return <div className="app-shell">
    <ScrollProgress />
    <Ticker />
    <Header language={language} setLanguage={setLanguage} activeView={activeView} />
    <div className="app-layout"><Sidebar language={language} activeView={activeView} setActiveView={setActiveView} />
      <main className="main-content" key={activeView} ref={contentRef}>
        {activeView === "tasks" && <TaskView language={language} timezone={timezone} setTimezone={setTimezone} />}
        {activeView === "svs" && <SvsView language={language} />}
        {activeView === "rules" && <RulesView language={language} timezone={timezone} />}
        {activeView === "hq" && <HqView language={language} />}
        {activeView === "members" && <MemberView language={language} />}
        <footer className="site-footer"><span><b>CRLS</b> · LAST Z</span><span>ALLIANCE OPERATIONS CENTER <i /> EST. 2026</span></footer>
      </main>
    </div>
  </div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
