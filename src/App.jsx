import { useState, useEffect, useRef } from "react";

const CATEGORIES = [
  { id: 'rental', label: 'Mietvertrag', en: 'Rental & Housing' },
  { id: 'registration', label: 'Anmeldung', en: 'City Registration' },
  { id: 'health', label: 'Krankenversicherung', en: 'Health Insurance' },
  { id: 'tax', label: 'Finanzamt', en: 'Tax & Finance' },
  { id: 'jobcenter', label: 'Jobcenter', en: 'Job Center' },
  { id: 'visa', label: 'Aufenthaltstitel', en: 'Visa & Residence' },
  { id: 'insurance', label: 'Versicherung', en: 'Insurance' },
  { id: 'rundfunk', label: 'Rundfunkbeitrag', en: 'Broadcasting Fee' },
  { id: 'pension', label: 'Rentenversicherung', en: 'Pension' },
  { id: 'other', label: 'Sonstiges', en: 'Other' },
];

const COLORS = {
  bg: '#f5f5f0',
  card: '#ffffff',
  border: '#e0ddd6',
  text: '#1a1a1a',
  textMuted: '#666660',
  textLight: '#999990',
  overdue: { text: '#c0392b', bg: '#fdf0ef', border: '#e74c3c' },
  urgent:  { text: '#b7590a', bg: '#fef6ee', border: '#e67e22' },
  upcoming:{ text: '#1a6fa8', bg: '#eef6fd', border: '#3498db' },
  active:  { text: '#1a7a47', bg: '#eefaf3', border: '#2ecc71' },
  ongoing: { text: '#555', bg: '#f5f5f5', border: '#ccc' },
  inactive:{ text: '#999', bg: '#f5f5f5', border: '#ddd' },
};

const getDaysLeft = (deadline) => {
  if (!deadline) return null;
  const now = new Date(); now.setHours(0,0,0,0);
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

const URGENCY_LABELS = {
  overdue: 'Overdue', urgent: 'Urgent', upcoming: 'Due soon',
  active: 'Active', ongoing: 'Ongoing', inactive: 'Closed',
};

const EXTRACT_SYS = `You are a German bureaucracy document analyzer. Return ONLY valid JSON, no other text:
{"title":"concise English title","category":"one of: rental,registration,health,tax,jobcenter,visa,insurance,rundfunk,pension,other","deadline":"YYYY-MM-DD or null","notes":"2-3 sentence summary","nextSteps":["Action 1","Action 2","Action 3"]}`;

const STEPS_SYS = `You are a German bureaucracy expert. Return ONLY a JSON array of 2-4 specific English next steps: ["Step 1","Step 2"]. No other text.`;

const callClaude = async (messages, system) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
};

const parseJson = (raw) => JSON.parse(raw.replace(/```json|```/g, '').trim());

export default function App() {
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem('buerokratik-v1');
      if (saved) setDocs(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('buerokratik-v1', JSON.stringify(docs));
  }, [docs]);

  const cat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[9];

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
    if (!form.title.trim()) { setError('Please enter a title.'); return; }
    setLoading(true); setError('');
    try {
      const raw = await callClaude(
        [{ role: 'user', content: `Category: ${cat(form.category).en}\nTitle: ${form.title}\nNotes: ${form.notes || 'none'}` }],
        STEPS_SYS
      );
      addDoc({ ...form, nextSteps: parseJson(raw) });
    } catch { addDoc({ ...form, nextSteps: [] }); }
  };

  const handlePasteExtract = async () => {
    if (!pasteText.trim()) { setError('Please paste some text.'); return; }
    setLoading(true); setError('');
    try { setExtracted(parseJson(await callClaude([{ role: 'user', content: pasteText }], EXTRACT_SYS))); }
    catch { setError('Could not extract. Please try again.'); }
    setLoading(false);
  };

  const handleUploadExtract = async () => {
    if (!uploadFile) { setError('Please select a file.'); return; }
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
    } catch { setError('Could not read file. Please try again.'); }
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
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No deadline';
  const daysText = (deadline, status) => {
    if (status !== 'active' || !deadline) return null;
    const d = getDaysLeft(deadline);
    if (d < 0) return `${Math.abs(d)}d overdue`;
    if (d === 0) return 'Due today';
    return `${d}d left`;
  };

  const btn = { padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' };
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'system-ui, sans-serif', color: COLORS.text }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${COLORS.border}`, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Bürokratik</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>German bureaucracy tracker</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {urgentCount > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 600, color: COLORS.overdue.text }}>{urgentCount}</div><div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>urgent</div></div>}
          {upcomingCount > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 600, color: COLORS.urgent.text }}>{upcomingCount}</div><div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>upcoming</div></div>}
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 600 }}>{docs.length}</div><div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>total</div></div>
          <button onClick={() => setShowAdd(!showAdd)} style={{ ...btn, background: '#1a1a1a', color: '#fff', border: 'none', fontWeight: 500 }}>+ Add document</button>
        </div>
      </div>

      {/* Add panel */}
      {showAdd && (
        <div style={{ margin: '20px 28px', background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Add document</span>
            <button onClick={resetAdd} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: COLORS.textMuted }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: COLORS.bg, padding: 4, borderRadius: 8 }}>
            {[['manual', 'Manual'], ['paste', 'Paste text'], ['upload', 'Upload file']].map(([id, label]) => (
              <button key={id} onClick={() => { setMethod(id); setExtracted(null); setError(''); }}
                style={{ flex: 1, padding: '8px 4px', border: method === id ? `1px solid ${COLORS.border}` : 'none', background: method === id ? '#fff' : 'transparent', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: method === id ? 500 : 400, fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>

          {error && <div style={{ color: COLORS.overdue.text, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          {method === 'manual' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>Title</label>
                <input style={inp} placeholder="e.g. Health insurance renewal" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>Category</label>
                <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.en} ({c.label})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>Deadline (optional)</label>
                <input type="date" style={inp} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>Notes (optional)</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder="Any relevant details..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                <button onClick={handleManual} disabled={loading} style={{ ...btn, flex: 1, background: '#1a1a1a', color: '#fff', border: 'none', fontWeight: 500 }}>{loading ? 'Generating next steps...' : 'Add document'}</button>
                <button onClick={resetAdd} style={btn}>Cancel</button>
              </div>
            </div>
          )}

          {method === 'paste' && !extracted && (
            <>
              <label style={{ display: 'block', fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>Paste document text</label>
              <textarea style={{ ...inp, minHeight: 140, resize: 'vertical', marginBottom: 16 }} placeholder="Paste text from your German letter, email, or document..." value={pasteText} onChange={e => setPasteText(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handlePasteExtract} disabled={loading} style={{ ...btn, flex: 1, background: '#1a1a1a', color: '#fff', border: 'none', fontWeight: 500 }}>{loading ? 'Analysing...' : 'Extract information'}</button>
                <button onClick={resetAdd} style={btn}>Cancel</button>
              </div>
            </>
          )}

          {method === 'upload' && !extracted && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0])} />
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #ccc', borderRadius: 8, padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 16, color: COLORS.textMuted, fontSize: 14 }}>
                {uploadFile
                  ? <><div style={{ fontSize: 28, marginBottom: 8 }}>📄</div><strong>{uploadFile.name}</strong><div style={{ fontSize: 12, marginTop: 4 }}>Click to change</div></>
                  : <><div style={{ fontSize: 28, marginBottom: 8 }}>📁</div><strong>Click to upload</strong><div style={{ fontSize: 12, marginTop: 4 }}>PDF or image (JPG, PNG)</div></>
                }
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleUploadExtract} disabled={loading || !uploadFile} style={{ ...btn, flex: 1, background: '#1a1a1a', color: '#fff', border: 'none', fontWeight: 500 }}>{loading ? 'Reading document...' : 'Extract information'}</button>
                <button onClick={resetAdd} style={btn}>Cancel</button>
              </div>
            </>
          )}

          {extracted && (
            <>
              <div style={{ background: COLORS.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Extracted information</div>
                {[['Title', extracted.title], ['Category', cat(extracted.category).en + ' (' + cat(extracted.category).label + ')'], ['Deadline', extracted.deadline ? fmtDate(extracted.deadline) : 'None detected'], ['Notes', extracted.notes]].map(([l, v]) => (
                  <div key={l} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 14 }}>{v}</div>
                  </div>
                ))}
                {extracted.nextSteps?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 6 }}>Next steps</div>
                    {extracted.nextSteps.map((s, i) => <div key={i} style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 4 }}>→ {s}</div>)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => addDoc(extracted)} style={{ ...btn, flex: 1, background: '#1a1a1a', color: '#fff', border: 'none', fontWeight: 500 }}>✓ Save document</button>
                <button onClick={() => setExtracted(null)} style={btn}>Try again</button>
                <button onClick={resetAdd} style={btn}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: '14px 28px', display: 'flex', gap: 8, background: '#fff', borderBottom: `1px solid ${COLORS.border}` }}>
        {[['all', 'All'], ['active', 'Active'], ['expiring', 'Expiring soon'], ['closed', 'Closed']].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ ...btn, background: filter === id ? '#1a1a1a' : '#fff', color: filter === id ? '#fff' : COLORS.textMuted, border: `1px solid ${filter === id ? '#1a1a1a' : COLORS.border}`, fontSize: 13 }}>{label}</button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div style={{ padding: '60px 28px', textAlign: 'center', color: COLORS.textMuted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: 8, color: COLORS.text }}>{filter === 'all' ? 'No documents yet' : `No ${filter} documents`}</div>
          <div style={{ fontSize: 14 }}>{filter === 'all' ? 'Add your first document to get started.' : 'Switch to "All" to see everything.'}</div>
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
              <div key={doc.id} style={{ background: '#fff', border: isHighAlert ? `2px solid ${u.border}` : `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, opacity: doc.status !== 'active' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>{cat(doc.category).en}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: u.text, background: u.bg, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{URGENCY_LABELS[urgency]}</span>
                </div>

                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{doc.title}</div>

                <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>
                  📅 {fmtDate(doc.deadline)}
                  {daysTxt && <span style={{ marginLeft: 8, color: u.text, fontWeight: 500 }}>{daysTxt}</span>}
                </div>

                {doc.notes && <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 12 }}>{doc.notes}</div>}

                {doc.nextSteps?.length > 0 && (
                  <>
                    <button onClick={() => setExpandedId(expanded ? null : doc.id)} style={{ background: 'none', border: 'none', color: '#1a6fa8', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: expanded ? 8 : 0, fontFamily: 'inherit' }}>
                      {expanded ? '▼' : '▶'} Next steps ({doc.nextSteps.length})
                    </button>
                    {expanded && (
                      <div style={{ marginBottom: 12 }}>
                        {doc.nextSteps.map((step, i) => (
                          <div key={i} style={{ fontSize: 13, color: COLORS.textMuted, padding: '4px 0 4px 12px', borderLeft: '2px solid #eee', marginBottom: 4, lineHeight: 1.5 }}>{step}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, marginTop: 8 }}>
                  {doc.status === 'active'
                    ? <button onClick={() => updateStatus(doc.id, 'completed')} style={{ ...btn, fontSize: 12, color: COLORS.active.text, borderColor: COLORS.active.border }}>✓ Mark complete</button>
                    : <button onClick={() => updateStatus(doc.id, 'active')} style={{ ...btn, fontSize: 12 }}>Reopen</button>
                  }
                  <button onClick={() => deleteDoc(doc.id)} style={{ ...btn, fontSize: 12, color: COLORS.overdue.text, borderColor: COLORS.overdue.border, marginLeft: 'auto' }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
