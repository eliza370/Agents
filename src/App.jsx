import { useState, useEffect, useRef } from "react";
import { THEMES } from "./theme";
import { LOCALES, makeT, categoryLabel, getInitialLang } from "./i18n";

// Category ids only. The display names live in the locale files, and
// the German terms live in i18n.js.
const CATEGORY_IDS = [
  'rental', 'registration', 'health', 'tax', 'jobcenter',
  'visa', 'insurance', 'rundfunk', 'pension', 'other',
];

const getDaysLeft = (deadline) => {
  if (!deadline) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(deadline) - now) / 86400000);
};

const getUrgency = (deadline, status) => {
  if (status !== 'active') return 'inactive';
  if (!deadline) return 'ongoing';
  const d = getDaysLeft(deadline);
  if (d < 0) return 'overdue';
  if (d <= 7) return 'urgent';
  if (d <= 30) return 'upcoming';
  return 'active';
};

const EXTRACT_SYS = `You are a German bureaucracy document analyzer. Return ONLY valid JSON, no other text:
{"title":"concise English title","category":"one of: rental,registration,health,tax,jobcenter,visa,insurance,rundfunk,pension,other","deadline":"YYYY-MM-DD or null","notes":"2-3 sentence summary","nextSteps":["Action 1","Action 2","Action 3"]}`;

const STEPS_SYS = `You are a German bureaucracy expert. Return ONLY a JSON array of 2-4 specific English next steps: ["Step 1","Step 2"]. No other text.`;

const callClaude = async (messages, system) => {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
};

const parseJson = (raw) => JSON.parse(raw.replace(/```json|```/g, '').trim());

// Read the saved theme once at startup. If there isn't one, follow
// whatever the operating system is set to.
const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem('buerokratik-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [lang, setLang] = useState(getInitialLang);
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [method, setMethod] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'other', deadline: '', notes: '' });
  const [pasteText, setPasteText] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const fileRef = useRef(null);

  const COLORS = THEMES[theme];
  const t = makeT(lang);

  // Persist the theme, and tell the browser which scheme to use for
  // native widgets — otherwise the date picker and scrollbars stay
  // stubbornly white in dark mode.
  useEffect(() => {
    try { localStorage.setItem('buerokratik-theme', theme); } catch {}
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = THEMES[theme].colorScheme;
    document.body.style.background = THEMES[theme].bg;
  }, [theme]);

  // Persist the language, and set it on <html> so screen readers and
  // the browser's own spellcheck know what they're looking at.
  useEffect(() => {
    try { localStorage.setItem('buerokratik-lang', lang); } catch {}
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('buerokratik-v1');
      if (saved) setDocs(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('buerokratik-v1', JSON.stringify(docs));
  }, [docs]);

  const addDoc = (data) => {
    setDocs(prev => [{
      id: Date.now().toString(),
      title: data.title || 'Untitled',
      category: data.category || 'other',
      deadline: data.deadline || null,
      notes: data.notes || '',
      nextSteps: data.nextSteps || [],
      status: 'active',
      createdAt: new Date().toISOString(),
    }, ...prev]);
    resetAdd();
  };

  const resetAdd = () => {
    setShowAdd(false); setMethod('manual');
    setForm({ title: '', category: 'other', deadline: '', notes: '' });
    setPasteText(''); setUploadFile(null); setExtracted(null);
    setError(''); setLoading(false);
  };

  const handleManual = async () => {
    if (!form.title.trim()) { setError(t('errors.noTitle')); return; }
    setLoading(true); setError('');
    try {
      const raw = await callClaude(
        [{ role: 'user', content: `Category: ${form.category}\nTitle: ${form.title}\nNotes: ${form.notes || 'none'}` }],
        STEPS_SYS
      );
      addDoc({ ...form, nextSteps: parseJson(raw) });
    } catch { setError(t('errors.stepsFailed')); }
    setLoading(false);
  };

  const handlePasteExtract = async () => {
    if (!pasteText.trim()) { setError(t('errors.noText')); return; }
    setLoading(true); setError('');
    try { setExtracted(parseJson(await callClaude([{ role: 'user', content: pasteText }], EXTRACT_SYS))); }
    catch { setError(t('errors.extractFailed')); }
    setLoading(false);
  };

  const handleUploadExtract = async () => {
    if (!uploadFile) { setError(t('errors.noFile')); return; }
    setLoading(true); setError('');
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(uploadFile);
      });
      const isPdf = uploadFile.type === 'application/pdf';
      const content = isPdf
        ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }, { type: 'text', text: 'Extract information from this German document.' }]
        : [{ type: 'image', source: { type: 'base64', media_type: uploadFile.type, data: base64 } }, { type: 'text', text: 'Extract information from this German document.' }];
      setExtracted(parseJson(await callClaude([{ role: 'user', content }], EXTRACT_SYS)));
    } catch { setError(t('errors.readFailed')); }
    setLoading(false);
  };

  const updateStatus = (id, status) => setDocs(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  const deleteDoc = (id) => setDocs(prev => prev.filter(d => d.id !== id));

  const filtered = docs.filter(d => {
    if (filter === 'all') return true;
    const u = getUrgency(d.deadline, d.status);
    if (filter === 'active') return d.status === 'active';
    if (filter === 'expiring') return d.status === 'active' && (u === 'overdue' || u === 'urgent' || u === 'upcoming');
    if (filter === 'closed') return d.status !== 'active';
    return true;
  });

  const urgentCount = docs.filter(d => { const u = getUrgency(d.deadline, d.status); return u === 'overdue' || u === 'urgent'; }).length;
  const upcomingCount = docs.filter(d => getUrgency(d.deadline, d.status) === 'upcoming').length;

  const dateLocale = LOCALES[lang]?.meta?.dateLocale || 'en-GB';
  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
    : t('card.noDeadline');

  const daysText = (deadline, status) => {
    if (status !== 'active' || !deadline) return null;
    const d = getDaysLeft(deadline);
    if (d < 0) return t('card.overdueBy', { n: Math.abs(d) });
    if (d === 0) return t('card.dueToday');
    return t('card.daysLeft', { n: d });
  };

  // Shared style objects. These live inside the component so they can
  // read COLORS, which changes when the theme changes.
  const btn = { padding: '8px 16px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' };
  const btnPrimary = { ...btn, background: COLORS.accent, color: COLORS.accentText, border: 'none', fontWeight: 500 };
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', colorScheme: COLORS.colorScheme };
  const lbl = { display: 'block', fontSize: 12, color: COLORS.textMuted, marginBottom: 6 };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'system-ui, sans-serif', color: COLORS.text }}>

      {/* Header */}
      <div style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Bürokratik</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>{t('app.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {urgentCount > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 600, color: COLORS.overdue.text }}>{urgentCount}</div><div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{t('app.urgent')}</div></div>}
          {upcomingCount > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 600, color: COLORS.urgent.text }}>{upcomingCount}</div><div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{t('app.upcoming')}</div></div>}
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 600 }}>{docs.length}</div><div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{t('app.total')}</div></div>

          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            aria-label={t('app.language')}
            style={{ ...btn, padding: '8px 10px' }}
          >
            {Object.entries(LOCALES).map(([code, loc]) => (
              <option key={code} value={code}>{loc.meta.name}</option>
            ))}
          </select>

          <button
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? t('app.toDark') : t('app.toLight')}
            title={theme === 'light' ? t('app.toDark') : t('app.toLight')}
            style={{ ...btn, padding: '8px 12px', fontSize: 15, lineHeight: 1 }}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}>{t('app.addDocument')}</button>
        </div>
      </div>

      {/* Add panel */}
      {showAdd && (
        <div style={{ margin: '20px 28px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{t('add.heading')}</span>
            <button onClick={resetAdd} aria-label={t('add.cancel')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: COLORS.textMuted }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: COLORS.bg, padding: 4, borderRadius: 8 }}>
            {[['manual', t('add.methodManual')], ['paste', t('add.methodPaste')], ['upload', t('add.methodUpload')]].map(([id, label]) => (
              <button key={id} onClick={() => { setMethod(id); setExtracted(null); setError(''); }}
                style={{ flex: 1, padding: '8px 4px', border: method === id ? `1px solid ${COLORS.border}` : '1px solid transparent', background: method === id ? COLORS.card : 'transparent', color: COLORS.text, borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: method === id ? 500 : 400, fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>

          {error && <div style={{ color: COLORS.overdue.text, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          {method === 'manual' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>{t('add.title')}</label>
                <input style={inp} placeholder={t('add.titlePlaceholder')} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>{t('add.category')}</label>
                <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORY_IDS.map(id => <option key={id} value={id}>{categoryLabel(t, id)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{t('add.deadline')}</label>
                <input type="date" style={inp} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>{t('add.notes')}</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder={t('add.notesPlaceholder')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                <button onClick={handleManual} disabled={loading} style={{ ...btnPrimary, flex: 1 }}>{loading ? t('add.submitting') : t('add.submit')}</button>
                <button onClick={resetAdd} style={btn}>{t('add.cancel')}</button>
              </div>
            </div>
          )}

          {method === 'paste' && !extracted && (
            <>
              <label style={lbl}>{t('add.pasteLabel')}</label>
              <textarea style={{ ...inp, minHeight: 140, resize: 'vertical', marginBottom: 16 }} placeholder={t('add.pastePlaceholder')} value={pasteText} onChange={e => setPasteText(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handlePasteExtract} disabled={loading} style={{ ...btnPrimary, flex: 1 }}>{loading ? t('add.extracting') : t('add.extract')}</button>
                <button onClick={resetAdd} style={btn}>{t('add.cancel')}</button>
              </div>
            </>
          )}

          {method === 'upload' && !extracted && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0])} />
              <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${COLORS.border}`, borderRadius: 8, padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 16, color: COLORS.textMuted, fontSize: 14 }}>
                {uploadFile
                  ? <><div style={{ fontSize: 28, marginBottom: 8 }}>📄</div><strong>{uploadFile.name}</strong><div style={{ fontSize: 12, marginTop: 4 }}>{t('add.uploadChange')}</div></>
                  : <><div style={{ fontSize: 28, marginBottom: 8 }}>📁</div><strong>{t('add.uploadPrompt')}</strong><div style={{ fontSize: 12, marginTop: 4 }}>{t('add.uploadHint')}</div></>
                }
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleUploadExtract} disabled={loading || !uploadFile} style={{ ...btnPrimary, flex: 1 }}>{loading ? t('add.reading') : t('add.extract')}</button>
                <button onClick={resetAdd} style={btn}>{t('add.cancel')}</button>
              </div>
            </>
          )}

          {extracted && (
            <>
              <div style={{ background: COLORS.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{t('add.extractedHeading')}</div>
                {[
                  [t('add.title'), extracted.title],
                  [t('add.category'), categoryLabel(t, extracted.category)],
                  [t('add.deadline'), extracted.deadline ? fmtDate(extracted.deadline) : t('add.noneDetected')],
                  [t('add.notes'), extracted.notes],
                ].map(([l, v]) => (
                  <div key={l} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 14 }}>{v}</div>
                  </div>
                ))}
                {extracted.nextSteps?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 6 }}>{t('add.nextSteps')}</div>
                    {extracted.nextSteps.map((s, i) => <div key={i} style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 4 }}>→ {s}</div>)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => addDoc(extracted)} style={{ ...btnPrimary, flex: 1 }}>{t('add.save')}</button>
                <button onClick={() => setExtracted(null)} style={btn}>{t('add.tryAgain')}</button>
                <button onClick={resetAdd} style={btn}>{t('add.cancel')}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: '14px 28px', display: 'flex', gap: 8, background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, flexWrap: 'wrap' }}>
        {['all', 'active', 'expiring', 'closed'].map(id => (
          <button key={id} onClick={() => setFilter(id)} style={{ ...btn, background: filter === id ? COLORS.accent : COLORS.card, color: filter === id ? COLORS.accentText : COLORS.textMuted, border: `1px solid ${filter === id ? COLORS.accent : COLORS.border}`, fontSize: 13 }}>{t(`filters.${id}`)}</button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div style={{ padding: '60px 28px', textAlign: 'center', color: COLORS.textMuted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
          <div style={{ fontWeight: 600, marginBottom: 8, color: COLORS.text }}>{filter === 'all' ? t('empty.titleAll') : t('empty.titleFiltered')}</div>
          <div style={{ fontSize: 14 }}>{filter === 'all' ? t('empty.bodyAll') : t('empty.bodyFiltered')}</div>
        </div>
      ) : (
        <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(doc => {
            const urgency = getUrgency(doc.deadline, doc.status);
            const u = COLORS[urgency];
            const expanded = expandedId === doc.id;
            const daysTxt = daysText(doc.deadline, doc.status);
            const isHighAlert = urgency === 'urgent' || urgency === 'overdue';

            return (
              <div key={doc.id} style={{ background: COLORS.card, border: isHighAlert ? `2px solid ${u.border}` : `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, opacity: doc.status !== 'active' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>{categoryLabel(t, doc.category)}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: u.text, background: u.bg, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{t(`urgency.${urgency}`)}</span>
                </div>

                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{doc.title}</div>

                <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>
                  📅 {fmtDate(doc.deadline)}
                  {daysTxt && <span style={{ marginLeft: 8, color: u.text, fontWeight: 500 }}>{daysTxt}</span>}
                </div>

                {doc.notes && <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 12 }}>{doc.notes}</div>}

                {doc.nextSteps?.length > 0 && (
                  <>
                    <button onClick={() => setExpandedId(expanded ? null : doc.id)} style={{ background: 'none', border: 'none', color: COLORS.upcoming.text, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: expanded ? 8 : 0, fontFamily: 'inherit' }}>
                      {expanded ? '▼' : '▶'} {t('card.nextSteps', { n: doc.nextSteps.length })}
                    </button>
                    {expanded && (
                      <div style={{ marginBottom: 12 }}>
                        {doc.nextSteps.map((step, i) => (
                          <div key={i} style={{ fontSize: 13, color: COLORS.textMuted, padding: '4px 0 4px 12px', borderLeft: `2px solid ${COLORS.border}`, marginBottom: 4, lineHeight: 1.5 }}>{step}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, marginTop: 8 }}>
                  {doc.status === 'active'
                    ? <button onClick={() => updateStatus(doc.id, 'completed')} style={{ ...btn, fontSize: 12, color: COLORS.active.text, borderColor: COLORS.active.border }}>{t('card.markComplete')}</button>
                    : <button onClick={() => updateStatus(doc.id, 'active')} style={{ ...btn, fontSize: 12 }}>{t('card.reopen')}</button>
                  }
                  <button onClick={() => deleteDoc(doc.id)} style={{ ...btn, fontSize: 12, color: COLORS.overdue.text, borderColor: COLORS.overdue.border, marginLeft: 'auto' }}>{t('card.delete')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
