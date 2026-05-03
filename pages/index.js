import { useState, useRef, useEffect, useCallback } from 'react'
import Head from 'next/head'

const STEPS = ['Input', 'Artikel', 'Feedback', 'Bild', 'Publish']

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0)
  const [inputType, setInputType] = useState('url')
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')

  // Article state
  const [article, setArticle] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [seoSlug, setSeoSlug] = useState('')
  const [focusKeyword, setFocusKeyword] = useState('')
  const [unsplashQuery, setUnsplashQuery] = useState('')
  const [sourceContent, setSourceContent] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [iteration, setIteration] = useState(0)

  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const utteranceRef = useRef(null)

  // Voice feedback state
  const [isRecording, setIsRecording] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef(null)

  // Image state
  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagesLoading, setImagesLoading] = useState(false)

  // Publish state
  const [published, setPublished] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState('')

  // File input ref
  const fileInputRef = useRef(null)

  useEffect(() => {
    setSpeechSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
    setVoiceSupported(typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))
  }, [])

  // --- TTS ---
  const speakArticle = useCallback(() => {
    if (!speechSupported || !article) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(article)
    utter.lang = 'de-DE'
    utter.rate = 1.0
    utter.pitch = 1.0
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

  // --- Voice feedback ---
  const startRecording = useCallback(() => {
    if (!voiceSupported) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'de-DE'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      setFeedbackText(transcript)
    }
    recognition.onend = () => setIsRecording(false)
    recognition.onerror = () => setIsRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [voiceSupported])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  // --- Step 0: Process input ---
  const handleGenerate = async () => {
    setError('')
    setLoading(true)
    let content = ''
    let title = ''
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
        if (!textInput.trim()) throw new Error('Bitte Text oder Idee eingeben')
        content = textInput.trim()
        title = ''
      }
      setSourceContent(content)
      setSourceTitle(title)
      setLoadingMsg('Artikel wird geschrieben…')
      await generateArticle(content, title, null, null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  // --- Generate / Regenerate ---
  const generateArticle = async (srcContent, srcTitle, feedback, prevArticle) => {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceContent: srcContent || sourceContent,
        sourceTitle: srcTitle || sourceTitle,
        inputType,
        feedback,
        previousArticle: prevArticle
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
    setIteration(prev => prev + 1)
    setCurrentStep(1)
  }

  // --- Feedback submit ---
  const handleFeedback = async () => {
    if (!feedbackText.trim()) return
    setError('')
    setLoading(true)
    setLoadingMsg('Artikel wird überarbeitet…')
    try {
      await generateArticle(null, null, feedbackText, article)
      setFeedbackText('')
      setCurrentStep(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  // --- Load images ---
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

  // --- Publish ---
  const handlePublish = async () => {
    if (!selectedImage) {
      setError('Bitte zuerst ein Titelbild auswählen.')
      return
    }
    setError('')
    setLoading(true)
    setLoadingMsg('Wird auf Wix veröffentlicht…')
    try {
      const r = await fetch('/api/publish-wix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: seoTitle,
          article,
          seoTitle,
          seoDescription,
          seoSlug,
          focusKeyword,
          imageUrl: selectedImage?.url || null,
          imageAlt: selectedImage?.alt || null
        })
      })
      const rawText = await r.text()
      let d = {}
      try { d = JSON.parse(rawText) } catch (_) {
        throw new Error('Wix API: Ungültige Antwort — ' + rawText.slice(0, 200))
      }
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

  // --- Reset ---
  const handleReset = () => {
    setCurrentStep(0)
    setArticle('')
    setFeedbackText('')
    setImages([])
    setSelectedImage(null)
    setPublished(false)
    setPublishedUrl('')
    setIteration(0)
    setError('')
    setUrlInput('')
    setTextInput('')
    setPdfFile(null)
    setFocusKeyword('')
    stopSpeaking()
  }

  // --- Client-side PDF extraction ---
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
            if (!cleaned || cleaned.length < 50) {
              reject(new Error('PDF-Text konnte nicht extrahiert werden.'))
            } else {
              resolve(cleaned)
            }
          } catch (err) {
            reject(new Error('PDF Verarbeitung fehlgeschlagen: ' + err.message))
          }
        }
        script.onerror = () => reject(new Error('PDF.js konnte nicht geladen werden'))
        if (!window.pdfjsLib) {
          document.head.appendChild(script)
        } else {
          script.onload()
        }
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsArrayBuffer(file)
  })

  const handleFileDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') setPdfFile(file)
  }

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
            <div className="header-sub">Input → Artikel → Feedback → Bild → Wix</div>
          </div>
        </header>

        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}>
              {s}
            </div>
          ))}
        </div>

        {error && (
          <div className="status error">
            <span>⚠️</span> {error}
          </div>
        )}

        {loading && (
          <div className="status loading">
            <div className="spinner" />
            {loadingMsg || 'Einen Moment…'}
          </div>
        )}

        {/* STEP 0: INPUT */}
        {currentStep === 0 && !loading && (
          <div className="card">
            <div className="card-title"><span className="icon">📥</span> Content-Quelle</div>
            <div className="input-tabs">
              {[
                { id: 'url', label: '🔗 URL / Artikel' },
                { id: 'pdf', label: '📄 PDF' },
                { id: 'text', label: '💭 Idee / Text' }
              ].map(t => (
                <button key={t.id} className={`input-tab ${inputType === t.id ? 'active' : ''}`} onClick={() => setInputType(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            {inputType === 'url' && (
              <input type="url" placeholder="https://..." value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGenerate()} />
            )}
            {inputType === 'pdf' && (
              <div className={`upload-area ${pdfFile ? 'dragover' : ''}`} onDrop={handleFileDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} />
                {pdfFile ? (
                  <span style={{ color: 'var(--blue-light)' }}>✅ {pdfFile.name}</span>
                ) : (
                  <><div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>PDF hier hinziehen oder klicken</>
                )}
              </div>
            )}
            {inputType === 'text' && (
              <textarea placeholder="Idee, Notiz, eigener Text…" value={textInput} onChange={e => setTextInput(e.target.value)} rows={5} />
            )}
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>✍️ Artikel generieren</button>
            </div>
          </div>
        )}

        {/* STEP 1: ARTICLE */}
        {currentStep >= 1 && !published && (
          <div className="card">
            <div className="card-title">
              <span className="icon">📝</span> Artikel
              {iteration > 0 && <span className="iteration-badge" style={{ marginLeft: 'auto' }}>Version {iteration}</span>}
            </div>
            <div className="article-display">{article}</div>
            {speechSupported && (
              <div className="tts-bar">
                <button className="tts-btn" onClick={isSpeaking ? stopSpeaking : speakArticle} title={isSpeaking ? 'Stop' : 'Vorlesen'}>
                  {isSpeaking ? '⏹' : '▶'}
                </button>
                <span className="tts-label">{isSpeaking ? 'Artikel wird vorgelesen… klick zum Stoppen' : 'Artikel anhören'}</span>
              </div>
            )}
            <hr className="divider" />
            <div className="card-title" style={{ marginBottom: '0.75rem' }}><span className="icon">💬</span> Feedback geben</div>
            <div className="feedback-row">
              <textarea placeholder="Was soll anders werden?" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3} />
              {voiceSupported && (
                <button className={`voice-btn ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Aufnahme stoppen' : 'Feedback sprechen'}>
                  {isRecording ? '⏹' : '🎙'}
                </button>
              )}
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleFeedback} disabled={loading || !feedbackText.trim()}>🔄 Neue Version</button>
              <button className="btn btn-secondary" onClick={() => { setCurrentStep(3); handleLoadImages(); }} disabled={imagesLoading}>✅ Passt — weiter zu Bild</button>
              <button className="btn btn-secondary" onClick={handleReset}>↩ Von vorne</button>
            </div>
          </div>
        )}

        {/* STEP 3: IMAGES + SEO */}
        {currentStep >= 3 && !published && (
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
                {selectedImage && (
                  <div className="image-credit">
                    Foto: <a href={selectedImage.authorUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>{selectedImage.author}</a> via Unsplash
                  </div>
                )}
              </>
            )}
            {!imagesLoading && images.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Keine Bilder gefunden.</p>
            )}

            <hr className="divider" />

            {/* SEO Editing */}
            <div className="card-title" style={{ marginBottom: '0.75rem' }}><span className="icon">🔍</span> SEO bearbeiten</div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>SEO Titel</label>
              <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Meta Description (Snippet)</label>
              <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} rows={3} style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>URL Slug</label>
              <input value={seoSlug} onChange={e => setSeoSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>🎯 Fokus-Keyword</label>
              <input
                value={focusKeyword}
                onChange={e => setFocusKeyword(e.target.value)}
                placeholder="z.B. Markenpositionierung KMU"
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Wird in den Meta-Keywords und im Snippet verwendet.
              </div>
            </div>

            {/* SEO Preview */}
            <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ color: '#1a0dab', fontSize: '1rem', fontWeight: '600', marginBottom: '0.2rem' }}>{seoTitle || '—'}</div>
              <div style={{ color: '#006621', fontSize: '0.8rem', marginBottom: '0.2rem' }}>branddoc.at/blog/{seoSlug || '—'}</div>
              <div style={{ color: '#545454', fontSize: '0.85rem' }}>{seoDescription || '—'}</div>
            </div>

            <div className="btn-row" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-publish" onClick={handlePublish} disabled={loading || !selectedImage}>
                🚀 Jetzt auf Wix veröffentlichen
              </button>
            </div>
            {!selectedImage && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                Bitte zuerst ein Titelbild auswählen.
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
              Der Artikel wird sofort live auf branddoc.at gepostet.
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {published && (
          <div className="card">
            <div className="publish-success">
              <div className="big-check">🎉</div>
              <h2>Artikel ist live!</h2>
              <p>Dein Blogartikel wurde erfolgreich auf branddoc.at veröffentlicht.</p>
              {publishedUrl && (
                <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
                  🌐 Artikel ansehen
                </a>
              )}
              <br />
              <button className="btn btn-primary" onClick={handleReset} style={{ marginTop: '0.75rem' }}>✍️ Nächsten Artikel schreiben</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
