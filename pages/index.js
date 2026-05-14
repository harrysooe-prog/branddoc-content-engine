import { useState, useRef, useEffect, useCallback } from 'react'
import Head from 'next/head'

const STEPS = ['Input', 'Artikel', 'Stimme', 'Bild', 'Publish']

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0)
  const [inputType, setInputType] = useState('url')
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [hinweise, setHinweise] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')

  const [article, setArticle] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [seoSlug, setSeoSlug] = useState('')
  const [focusKeyword, setFocusKeyword] = useState('')
  const [unsplashQuery, setUnsplashQuery] = useState('')
  const [sourceContent, setSourceContent] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [iteration, setIteration] = useState(0)

  const [perspectives, setPerspectives] = useState(['', '', ''])
  const [selectedPerspective, setSelectedPerspective] = useState(null)
  const [editedPerspective, setEditedPerspective] = useState('')
  const [internalLinks, setInternalLinks] = useState([])
  const [selectedLinks, setSelectedLinks] = useState([])

  const [feedbackText, setFeedbackText] = useState('')

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const utteranceRef = useRef(null)

  // Voice states — one per field
  const [isRecordingHinweise, setIsRecordingHinweise] = useState(false)
  const [isRecordingText, setIsRecordingText] = useState(false)
  const [isRecordingFeedback, setIsRecordingFeedback] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef(null)

  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagesLoading, setImagesLoading] = useState(false)

  const [published, setPublished] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState('')

  const fileInputRef = useRef(null)

  useEffect(() => {
    setSpeechSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
    setVoiceSupported(typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))
  }, [])

  const speakArticle = useCallback(() => {
    if (!speechSupported || !article) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(article)
    utter.lang = 'de-DE'
    utter.rate = 1.0
    const voices = window.speechSynthesis.getVoices()
    const german = voices.find(v => v.lang.startsWith('de'))
    if (german) utter.voice = german
    utter.onstart = () => setIsSpeaking(true)
    utter.onend = () => setIsSpeaking(false)
    utter.onerror = () => setIsSpeaking(false)
    utteranceRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [article, speechSupported])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  const startVoice = useCallback((setter, setRecording) => {
    if (!voiceSupported) return
    // Stop any existing recognition
    recognitionRef.current?.stop()
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'de-DE'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      setter(transcript)
    }
    recognition.onend = () => {
      setIsRecordingHinweise(false)
      setIsRecordingText(false)
      setIsRecordingFeedback(false)
    }
    recognition.onerror = () => {
      setIsRecordingHinweise(false)
      setIsRecordingText(false)
      setIsRecordingFeedback(false)
    }
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }, [voiceSupported])

  const stopVoice = useCallback((setRecording) => {
    recognitionRef.current?.stop()
    setRecording(false)
  }, [])

  const handleGenerate = async () => {
    setError('')
    setLoading(true)
    let content = ''
    let title = ''
    let resolvedInputType = inputType

    try {
      if (inputType === 'url') {
        if (!urlInput.trim()) throw new Error('Bitte eine URL eingeben')
        setLoadingMsg('URL wird geladen…')
        const r = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput.trim() })
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        content = d.content
        title = d.title
      } else if (inputType === 'pdf') {
        if (!pdfFile) throw new Error('Bitte ein PDF hochladen')
        setLoadingMsg('PDF wird gelesen…')
        content = await extractPdfClientSide(pdfFile)
        title = pdfFile.name
      } else {
        if (!textInput.trim()) throw new Error('Bitte Text, Idee oder Thema eingeben')
        content = textInput.trim()
        title = ''
        resolvedInputType = 'direkt'
      }
      setSourceContent(content)
      setSourceTitle(title)
      setLoadingMsg('Artikel wird geschrieben…')
      await generateArticle(content, title, null, null, resolvedInputType)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  const generateArticle = async (srcContent, srcTitle, feedback, prevArticle, resolvedType) => {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceContent: srcContent || sourceContent,
        sourceTitle: srcTitle || sourceTitle,
        inputType: resolvedType || inputType,
        feedback,
        previousArticle: prevArticle,
        hinweise: hinweise.trim() || undefined
      })
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    setArticle(d.article)
    setSeoTitle(d.seoTitle)
    setSeoDescription(d.seoDescription)
    setSeoSlug(d.seoSlug)
    setFocusKeyword(d.focusKeyword || '')
    setUnsplashQuery(d.unsplashQuery)
    setPerspectives(d.perspectives || ['', '', ''])
    setInternalLinks(d.internalLinks || [])
    setSelectedPerspective(null)
    setEditedPerspective('')
    setSelectedLinks([])
    setIteration(prev => prev + 1)
    setCurrentStep(1)
  }

  const handleApplyVoice = async () => {
    if (!editedPerspective.trim() && selectedLinks.length === 0) {
      setCurrentStep(3)
      handleLoadImages()
      return
    }
    setLoading(true)
    setLoadingMsg('Deine Stimme wird eingebaut…')
    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceContent: sourceContent,
          sourceTitle: sourceTitle,
          inputType,
          feedback: `Baue folgendes Zitat von Harald an passender Stelle in den Artikel ein: "${editedPerspective}"${selectedLinks.length > 0 ? `\n\nFüge diese internen Verlinkungen als Markdown-Links ein:\n${selectedLinks.map(l => `- [${l.anchor}](${l.url})`).join('\n')}` : ''}\n\nBehalte sonst alles gleich.`,
          previousArticle: article
        })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setArticle(d.article)
      setCurrentStep(3)
      handleLoadImages()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  const handleFeedback = async () => {
    if (!feedbackText.trim()) return
    setError('')
    setLoading(true)
    setLoadingMsg('Artikel wird überarbeitet…')
    try {
      await generateArticle(null, null, feedbackText, article, inputType)
      setFeedbackText('')
      setCurrentStep(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  const handleLoadImages = async () => {
    setImagesLoading(true)
    setError('')
    try {
      const r = await fetch('/api/unsplash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: unsplashQuery, count: 9 })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setImages(d.images)
      setCurrentStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setImagesLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedImage) { setError('Bitte zuerst ein Titelbild auswählen.'); return }
    setError('')
    setLoading(true)
    setLoadingMsg('Wird auf Wix veröffentlicht…')
    try {
      const r = await fetch('/api/publish-wix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: seoTitle, article, seoTitle, seoDescription, seoSlug, focusKeyword, imageUrl: selectedImage?.url || null, imageAlt: selectedImage?.alt || null })
      })
      const rawText = await r.text()
      let d = {}
      try { d = JSON.parse(rawText) } catch (_) { throw new Error('Wix API: Ungültige Antwort — ' + rawText.slice(0, 200)) }
      if (!r.ok) throw new Error(d.error + (d.detail ? ': ' + d.detail : ''))
      setPublished(true)
      setPublishedUrl(d.postUrl || '')
      setCurrentStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  const handleReset = () => {
    setCurrentStep(0); setArticle(''); setFeedbackText(''); setImages([]); setSelectedImage(null)
    setPublished(false); setPublishedUrl(''); setIteration(0); setError('')
    setUrlInput(''); setTextInput(''); setPdfFile(null); setFocusKeyword('')
    setPerspectives(['', '', '']); setSelectedPerspective(null); setEditedPerspective('')
    setInternalLinks([]); setSelectedLinks([]); setHinweise(''); stopSpeaking()
  }

  const extractPdfClientSide = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result)
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        script.onload = async () => {
          try {
            const pdfjsLib = window.pdfjsLib
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
            const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
            let fullText = ''
            for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
              const page = await pdf.getPage(i)
              const textContent = await page.getTextContent()
              fullText += textContent.items.map(item => item.str).join(' ') + ' '
            }
            const cleaned = fullText.replace(/\s+/g, ' ').trim().slice(0, 12000)
            if (!cleaned || cleaned.length < 50) reject(new Error('PDF-Text konnte nicht extrahiert werden.'))
            else resolve(cleaned)
          } catch (err) { reject(new Error('PDF Verarbeitung fehlgeschlagen: ' + err.message)) }
        }
        script.onerror = () => reject(new Error('PDF.js konnte nicht geladen werden'))
        if (!window.pdfjsLib) document.head.appendChild(script)
        else script.onload()
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsArrayBuffer(file)
  })

  const handleFileDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') setPdfFile(file)
  }

  const toggleLink = (link) => {
    setSelectedLinks(prev => prev.find(l => l.url === link.url) ? prev.filter(l => l.url !== link.url) : [...prev, link])
  }

  const VoiceBtn = ({ isRecording, onStart, onStop, small }) => (
    voiceSupported ? (
      <button
        className={`voice-btn ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? onStop : onStart}
        title={isRecording ? 'Aufnahme stoppen' : 'Spracheingabe'}
        style={small ? { width: '38px', height: '38px', fontSize: '1rem' } : {}}
      >
        {isRecording ? '⏹' : '🎙'}
      </button>
    ) : null
  )

  return (
    <>
      <Head>
        <title>brandDOC Content Engine</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✍️</text></svg>" />
      </Head>

      <div className="app">
        <header className="header">
          <div className="header-logo">bD</div>
          <div>
            <div className="header-title">brandDOC Content Engine</div>
            <div className="header-sub">Input → Artikel → Stimme → Bild → Publish</div>
          </div>
        </header>

        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}>{s}</div>
          ))}
        </div>

        {error && <div className="status error"><span>⚠️</span> {error}</div>}
        {loading && <div className="status loading"><div className="spinner" />{loadingMsg || 'Einen Moment…'}</div>}

        {/* STEP 0: INPUT */}
        {currentStep === 0 && !loading && (
          <div className="card">

            {/* Hinweise — optional, immer sichtbar */}
            <div className="card-title"><span className="icon">💡</span> Hinweise <span style={{ fontSize: '0.75rem', fontWeight: '400', color: 'var(--text-muted)' }}>(optional)</span></div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
              Kontext, Fokus, Zielgruppe oder spezielle Wünsche für diesen Artikel.
            </div>
            <div className="feedback-row" style={{ marginBottom: '1.5rem' }}>
              <textarea
                placeholder="z.B. &quot;Schreibe aus Sicht eines österreichischen Maschinenbauers&quot; oder &quot;Betone den ROI-Aspekt&quot;…"
                value={hinweise}
                onChange={e => setHinweise(e.target.value)}
                rows={3}
              />
              <VoiceBtn
                isRecording={isRecordingHinweise}
                onStart={() => startVoice(setHinweise, setIsRecordingHinweise)}
                onStop={() => stopVoice(setIsRecordingHinweise)}
              />
            </div>

            <hr className="divider" style={{ margin: '0 0 1.5rem' }} />

            {/* Quelleingabe */}
            <div className="card-title"><span className="icon">📥</span> Content-Quelle</div>
            <div className="input-tabs">
              {[
                { id: 'url', label: '🔗 URL / Artikel' },
                { id: 'pdf', label: '📄 PDF' },
                { id: 'text', label: '💭 Direkt schreiben' }
              ].map(t => (
                <button key={t.id} className={`input-tab ${inputType === t.id ? 'active' : ''}`} onClick={() => setInputType(t.id)}>{t.label}</button>
              ))}
            </div>

            {inputType === 'url' && (
              <input type="url" placeholder="https://..." value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGenerate()} />
            )}

            {inputType === 'pdf' && (
              <div className={`upload-area ${pdfFile ? 'dragover' : ''}`} onDrop={handleFileDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} />
                {pdfFile ? <span style={{ color: 'var(--blue-light)' }}>✅ {pdfFile.name}</span> : <><div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>PDF hier hinziehen oder klicken</>}
              </div>
            )}

            {inputType === 'text' && (
              <>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Thema, Idee, eigener Text — oder direkt per Stimme einsprechen.
                </div>
                <div className="feedback-row">
                  <textarea
                    placeholder="z.B. &quot;Schreibe einen Artikel über Preispositionierung für Handwerksbetriebe&quot;…"
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    rows={5}
                  />
                  <VoiceBtn
                    isRecording={isRecordingText}
                    onStart={() => startVoice(setTextInput, setIsRecordingText)}
                    onStop={() => stopVoice(setIsRecordingText)}
                  />
                </div>
              </>
            )}

            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>✍️ Artikel generieren</button>
            </div>
          </div>
        )}

        {/* STEP 1: ARTICLE */}
        {currentStep === 1 && !published && (
          <div className="card">
            <div className="card-title">
              <span className="icon">📝</span> Artikel
              {iteration > 0 && <span className="iteration-badge" style={{ marginLeft: 'auto' }}>Version {iteration}</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>✏️ Direkt bearbeitbar</div>
            <textarea value={article} onChange={e => setArticle(e.target.value)} rows={20} style={{ resize: 'vertical' }} />
            {speechSupported && (
              <div className="tts-bar">
                <button className="tts-btn" onClick={isSpeaking ? stopSpeaking : speakArticle}>{isSpeaking ? '⏹' : '▶'}</button>
                <span className="tts-label">{isSpeaking ? 'Wird vorgelesen… klick zum Stoppen' : 'Artikel anhören'}</span>
              </div>
            )}
            <hr className="divider" />
            <div className="card-title" style={{ marginBottom: '0.75rem' }}><span className="icon">💬</span> Feedback geben</div>
            <div className="feedback-row">
              <textarea placeholder="Was soll anders werden?" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3} />
              <VoiceBtn
                isRecording={isRecordingFeedback}
                onStart={() => startVoice(setFeedbackText, setIsRecordingFeedback)}
                onStop={() => stopVoice(setIsRecordingFeedback)}
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleFeedback} disabled={loading || !feedbackText.trim()}>🔄 Neue Version</button>
              <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>✅ Passt — weiter zu Stimme</button>
              <button className="btn btn-secondary" onClick={handleReset}>↩ Von vorne</button>
            </div>
          </div>
        )}

        {/* STEP 2: DEINE STIMME */}
        {currentStep === 2 && !published && (
          <div className="card">
            <div className="card-title"><span className="icon">🎙</span> Deine Stimme</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Wähle einen Perspektiv-Vorschlag, bearbeite ihn — er wird in den Artikel eingebaut.
            </div>
            {perspectives.map((p, i) => (
              <div key={i} onClick={() => { setSelectedPerspective(i); setEditedPerspective(p) }}
                style={{ background: selectedPerspective === i ? 'rgba(2,133,206,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedPerspective === i ? 'var(--blue)' : 'var(--border)'}`, borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--blue-light)', marginBottom: '0.4rem', letterSpacing: '0.06em' }}>
                  {i === 0 ? '💬 Persönlich & direkt' : i === 1 ? '⚡ Provokant & fordernd' : '🏭 Praxis & KMU'}
                </div>
                <div style={{ fontSize: '0.88rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.85)' }}>{p || '—'}</div>
              </div>
            ))}
            {selectedPerspective !== null && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>✏️ Bearbeiten</div>
                <textarea value={editedPerspective} onChange={e => setEditedPerspective(e.target.value)} rows={4} style={{ resize: 'vertical' }} />
              </div>
            )}
            {internalLinks.length > 0 && (
              <>
                <hr className="divider" />
                <div className="card-title" style={{ marginBottom: '0.75rem' }}><span className="icon">🔗</span> Interne Verlinkungen</div>
                {internalLinks.map((link, i) => (
                  <div key={i} onClick={() => toggleLink(link)}
                    style={{ background: selectedLinks.find(l => l.url === link.url) ? 'rgba(2,133,206,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedLinks.find(l => l.url === link.url) ? 'var(--blue)' : 'var(--border)'}`, borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.5rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--white)', marginBottom: '0.2rem' }}>📄 {link.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--blue-light)' }}>Ankertext: „{link.anchor}"</div>
                  </div>
                ))}
              </>
            )}
            <div className="btn-row" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={handleApplyVoice} disabled={loading}>
                {editedPerspective.trim() || selectedLinks.length > 0 ? '✅ Einbauen & weiter zu Bild' : '⏭ Überspringen → Bild'}
              </button>
              <button className="btn btn-secondary" onClick={() => setCurrentStep(1)}>← Zurück</button>
            </div>
          </div>
        )}

        {/* STEP 3: IMAGES + SEO */}
        {currentStep === 3 && !published && (
          <div className="card">
            <div className="card-title"><span className="icon">🖼</span> Titelbild wählen</div>
            {imagesLoading && <div className="status loading"><div className="spinner" /> Bilder werden gesucht…</div>}
            {!imagesLoading && images.length > 0 && (
              <>
                <div className="image-grid">
                  {images.map(img => (
                    <div key={img.id} className={`image-option ${selectedImage?.id === img.id ? 'selected' : ''}`} onClick={() => setSelectedImage(img)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.thumb} alt={img.alt} />
                      <div className="check">✓</div>
                    </div>
                  ))}
                </div>
                {selectedImage && <div className="image-credit">Foto: <a href={selectedImage.authorUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>{selectedImage.author}</a> via Unsplash</div>}
              </>
            )}
            <hr className="divider" />
            <div className="card-title" style={{ marginBottom: '1rem' }}><span className="icon">🔍</span> SEO bearbeiten</div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>SEO Titel</div>
              <input type="text" value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="SEO Titel…" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Meta Description</div>
              <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} rows={3} placeholder="Meta Description…" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>URL Slug</div>
              <input type="text" value={seoSlug} onChange={e => setSeoSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="url-slug" style={{ fontFamily: 'monospace' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>🎯 Fokus-Keyword</div>
              <input type="text" value={focusKeyword} onChange={e => setFocusKeyword(e.target.value)} placeholder="z.B. Markenpositionierung KMU" />
            </div>
            <div style={{ background: 'white', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '0.4rem' }}>Google Vorschau</div>
              <div style={{ color: '#1a0dab', fontSize: '1rem', fontWeight: '600', marginBottom: '0.15rem', fontFamily: 'arial, sans-serif' }}>{seoTitle || 'SEO Titel…'}</div>
              <div style={{ color: '#006621', fontSize: '0.78rem', marginBottom: '0.2rem', fontFamily: 'arial, sans-serif' }}>branddoc.at › blog › {seoSlug || 'url-slug'}</div>
              <div style={{ color: '#545454', fontSize: '0.82rem', fontFamily: 'arial, sans-serif', lineHeight: '1.4' }}>{seoDescription || 'Meta Description…'}</div>
            </div>
            <div className="btn-row">
              <button className="btn btn-publish" onClick={handlePublish} disabled={loading || !selectedImage}>🚀 Jetzt auf Wix veröffentlichen</button>
            </div>
            {!selectedImage && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>Bitte zuerst ein Titelbild auswählen.</div>}
          </div>
        )}

        {/* SUCCESS */}
        {published && (
          <div className="card">
            <div className="publish-success">
              <div className="big-check">🎉</div>
              <h2>Artikel ist live!</h2>
              <p>Dein Blogartikel wurde erfolgreich auf branddoc.at veröffentlicht.</p>
              {publishedUrl && <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', marginBottom: '1rem' }}>🌐 Artikel ansehen</a>}
              <br />
              <button className="btn btn-primary" onClick={handleReset} style={{ marginTop: '0.75rem' }}>✍️ Nächsten Artikel schreiben</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
