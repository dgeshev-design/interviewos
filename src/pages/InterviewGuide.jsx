import { useState, useRef } from 'react'
import { useQuestions } from '@/hooks/useQuestions'
import { useSessions } from '@/hooks/useSessions'
import { useParticipants } from '@/hooks/useParticipants'
import { useApp } from '@/context/AppContext'
import { aiSuggest, aiSummarise, aiGenerateQuestions } from '@/lib/api'
import QuestionCard from '@/components/QuestionCard'
import Modal from '@/components/Modal'
import Icon from '@/components/Icon'
import { supabase } from '@/lib/supabase'

const LEVEL_COLORS = { L1: 'badge-purple', L2: 'badge-blue', L3: 'badge-amber' }

export default function InterviewGuide() {
  const { workspace } = useApp()
  const { questions, loading: qLoading, add: addQ, remove: removeQ, bulkInsert } = useQuestions()
  const { participants } = useParticipants()
  const { session, startSession, updateNotes, toggleDone, saveSummary } = useSessions()

  const [selectedPid, setSelectedPid] = useState('')
  const [activeQid, setActiveQid]     = useState(null)
  const [aiMsg, setAiMsg]             = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [summary, setSummary]         = useState('')
  const [sumLoading, setSumLoading]   = useState(false)
  const [showAddQ, setShowAddQ]       = useState(false)
  const [newQ, setNewQ]               = useState({ level: 'L1', body: '' })

  // Brief upload state
  const [showBrief, setShowBrief]     = useState(false)
  const [briefText, setBriefText]     = useState('')
  const [briefFile, setBriefFile]     = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [generatedQs, setGeneratedQs] = useState([])
  const fileRef = useRef()

  const participant = participants.find(p => p.id === selectedPid)

  // Start/resume session when participant is selected
  const handleSelectParticipant = async (pid) => {
    setSelectedPid(pid)
    if (pid) await startSession(pid)
  }

  // AI: suggest follow-ups for a question
  const handleAISuggest = async (q) => {
    setAiLoading(true); setAiMsg('')
    const notes = questions.map(q => `[${q.level}] ${q.body}: ${session?.notes?.[q.id] || ''}`).join('\n')
    const { text } = await aiSuggest({ questionText: q.body, notes, participantName: participant?.name || 'the participant' })
    setAiMsg(text || 'No suggestions returned.')
    setAiLoading(false)
  }

  // AI: summarise all notes
  const handleSummarise = async () => {
    setSumLoading(true); setSummary('')
    const qs = questions.map(q => ({ level: q.level, body: q.body, note: session?.notes?.[q.id] || '' }))
    const { text } = await aiSummarise({ questions: qs, participantName: participant?.name || 'the participant' })
    setSummary(text || '')
    if (session) await saveSummary(session.id, text)
    setSumLoading(false)
  }

  // Note update: debounced via session hook
  const handleNoteChange = async (questionId, value) => {
    if (!session) return
    await updateNotes(session.id, questionId, value)
  }

  const handleToggleDone = async (qid) => {
    if (!session) return
    await toggleDone(session.id, qid)
  }

  // Brief: parse uploaded file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBriefFile(file)
    setBriefLoading(true)

    let text = ''
    if (file.type === 'text/plain') {
      text = await file.text()
    } else if (file.name.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      text = result.value
    } else if (file.type === 'application/pdf') {
      // PDF: read as text using basic extraction
      text = `[PDF uploaded: ${file.name}. Text extraction requires server-side processing. Paste the content manually below or use a .docx/.txt file for best results.]`
    } else {
      text = await file.text()
    }

    setBriefText(text)
    setBriefLoading(false)
  }

  // Brief: generate questions from AI
  const handleGenerateFromBrief = async () => {
    if (!briefText.trim()) return
    setBriefLoading(true)
    const { questions: qs } = await aiGenerateQuestions({ briefText })
    setGeneratedQs(qs || [])
    setBriefLoading(false)
  }

  // Brief: apply generated questions
  const handleApplyQuestions = async () => {
    if (!generatedQs.length) return
    await bulkInsert(generatedQs)

    // Save brief record to Supabase
    await supabase.from('briefs').insert({
      workspace_id:  workspace.id,
      filename:      briefFile?.name || 'pasted-text',
      raw_text:      briefText,
      generated_qs:  generatedQs,
      applied:       true,
    })

    setGeneratedQs([])
    setBriefText('')
    setBriefFile(null)
    setShowBrief(false)
  }

  const doneIds = new Set(session?.done_questions || [])
  const doneCount = questions.filter(q => doneIds.has(q.id)).length
  const progress = questions.length ? Math.round((doneCount / questions.length) * 100) : 0

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Interview guide</h1>
          <p>Waterfall method — L1 → L2 → L3. Live notes, AI assistance.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowBrief(true)}>
            <Icon name="upload" size={14} /> Upload brief
          </button>
          <button className="btn btn-ghost" onClick={() => setShowAddQ(true)}>
            <Icon name="plus" size={14} /> Add question
          </button>
          <button className="btn btn-primary" onClick={handleSummarise} disabled={sumLoading || !session}>
            <Icon name="sparkle" size={14} /> {sumLoading ? 'Summarising…' : 'Summarise session'}
          </button>
        </div>
      </div>

      {/* Participant selector + progress */}
      <div className="flex items-center gap-4 mt-2 mb-6">
        <select
          value={selectedPid}
          onChange={e => handleSelectParticipant(e.target.value)}
          style={{ width: 240 }}
        >
          <option value="">Select participant…</option>
          {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="text-sm muted">{doneCount}/{questions.length} covered</div>
        <div className="progress-bar flex-1">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-sm muted">{progress}%</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Question list */}
        <div className="flex-col gap-3">
          {qLoading && <p className="muted">Loading questions…</p>}
          {!qLoading && questions.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 48 }}>
              No questions yet. Add manually or upload a research brief.
            </div>
          )}
          {questions.map(q => (
            <QuestionCard
              key={q.id}
              question={q}
              note={session?.notes?.[q.id] || ''}
              isDone={doneIds.has(q.id)}
              isActive={activeQid === q.id}
              onFocus={() => setActiveQid(q.id)}
              onNoteChange={val => handleNoteChange(q.id, val)}
              onToggleDone={() => handleToggleDone(q.id)}
              onAISuggest={() => { setActiveQid(q.id); handleAISuggest(q) }}
            />
          ))}
        </div>

        {/* Right panel: AI + summary + level guide */}
        <div className="flex-col gap-4">
          {/* AI suggestions */}
          <div className="ai-panel">
            <div className="flex items-center gap-2">
              <Icon name="sparkle" size={14} color="var(--accent-light)" />
              <h3 style={{ color: 'var(--accent-light)' }}>AI assistant</h3>
            </div>
            {aiLoading && (
              <div className="flex items-center gap-2 mt-2" style={{ color: 'var(--accent-light)', fontSize: 12.5 }}>
                <div className="dot-pulse"><span /><span /><span /></div>
                Thinking…
              </div>
            )}
            {aiMsg && <div className="ai-msg">{aiMsg}</div>}
            {!aiLoading && !aiMsg && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>
                Click "AI follow-ups" on any question to get real-time suggestions based on your notes.
              </p>
            )}
          </div>

          {/* Session summary */}
          {(summary || sumLoading) && (
            <div className="ai-panel" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
              <div className="flex items-center gap-2">
                <Icon name="sparkle" size={14} color="var(--green)" />
                <h3 style={{ color: 'var(--green)' }}>Session summary</h3>
              </div>
              {sumLoading
                ? <div className="flex items-center gap-2 mt-2" style={{ color: 'var(--green)', fontSize: 12.5 }}><div className="dot-pulse"><span /><span /><span /></div> Generating…</div>
                : <div className="ai-msg">{summary}</div>
              }
            </div>
          )}

          {/* Level reference */}
          <div className="card-sm">
            <h3 style={{ marginBottom: 10, fontSize: 12.5 }}>Waterfall levels</h3>
            {[
              { level: 'L1', desc: 'Vague opener — let them speak freely' },
              { level: 'L2', desc: 'Pivot on keywords — explore the "why"' },
              { level: 'L3', desc: 'A vs B scenarios — surface dealbreakers' },
            ].map(({ level, desc }) => (
              <div key={level} className="flex items-center gap-2 mt-2">
                <span className={`badge ${LEVEL_COLORS[level]}`} style={{ minWidth: 28 }}>{level}</span>
                <span className="text-sm muted">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add question modal */}
      {showAddQ && (
        <Modal title="Add question" onClose={() => setShowAddQ(false)}>
          <div className="flex-col gap-3">
            <div className="field">
              <label>Level</label>
              <select value={newQ.level} onChange={e => setNewQ(q => ({ ...q, level: e.target.value }))}>
                <option value="L1">L1 — Context (vague opener)</option>
                <option value="L2">L2 — Pivot (follow the keywords)</option>
                <option value="L3">L3 — Bait (A vs B scenarios)</option>
              </select>
            </div>
            <div className="field">
              <label>Question text</label>
              <textarea
                value={newQ.body}
                onChange={e => setNewQ(q => ({ ...q, body: e.target.value }))}
                placeholder="Write your question…"
                style={{ minHeight: 100 }}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowAddQ(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => { await addQ(newQ); setNewQ({ level: 'L1', body: '' }); setShowAddQ(false) }} disabled={!newQ.body}>
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
        </Modal>
      )}

      {/* Brief upload modal */}
      {showBrief && (
        <Modal title="Upload research brief" onClose={() => { setShowBrief(false); setGeneratedQs([]) }} maxWidth={640}>
          <div className="flex-col gap-4">
            <p className="text-sm muted">Upload a DOCX or TXT file, or paste your brief text. The AI will generate Waterfall-formatted questions from it.</p>

            {/* File upload */}
            <div
              className="card-sm flex-col items-center gap-2"
              style={{ textAlign: 'center', cursor: 'pointer', borderStyle: 'dashed', padding: 28 }}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={22} color="var(--text-tertiary)" />
              <div className="text-sm muted">{briefFile ? briefFile.name : 'Click to upload DOCX or TXT'}</div>
              <input ref={fileRef} type="file" accept=".docx,.txt,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
            </div>

            <div className="flex items-center gap-3">
              <hr style={{ flex: 1 }} />
              <span className="text-xs muted">or paste text</span>
              <hr style={{ flex: 1 }} />
            </div>

            <div className="field">
              <label>Brief content</label>
              <textarea
                value={briefText}
                onChange={e => setBriefText(e.target.value)}
                placeholder="Paste your research objectives, context, or brief here…"
                style={{ minHeight: 140 }}
              />
            </div>

            {/* Generated questions preview */}
            {generatedQs.length > 0 && (
              <div className="card-sm flex-col gap-2">
                <h3 style={{ marginBottom: 8 }}>Generated questions ({generatedQs.length})</h3>
                {generatedQs.map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`badge ${LEVEL_COLORS[q.level]}`}>{q.level}</span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{q.body}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => { setShowBrief(false); setGeneratedQs([]) }}>Cancel</button>
            {generatedQs.length === 0 ? (
              <button className="btn btn-primary" onClick={handleGenerateFromBrief} disabled={!briefText.trim() || briefLoading}>
                <Icon name="sparkle" size={14} /> {briefLoading ? 'Generating…' : 'Generate questions'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleApplyQuestions}>
                <Icon name="check" size={14} /> Apply {generatedQs.length} questions
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
