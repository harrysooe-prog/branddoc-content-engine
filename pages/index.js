import { useState, useRef, useEffect, useCallback } from 'react'
import Head from 'next/head'

const STEPS = ['Input', 'Artikel', 'Stimme', 'Bild', 'Publish']
const MAX_IMAGES = 10
const MAX_PX = 1200
const JPEG_QUALITY = 0.75

// Rohe Browser-Fehlermeldungen (vor allem iOS Safari) in lesbares Deutsch uebersetzen
function sanitizeError(err) {
  const msg = (err && err.message) ? err.message : String(err)
  if (
    msg.includes('did not match the expected pattern') ||
    msg.includes('Invalid URL') ||
    msg.includes('Failed to construct') ||
    msg.includes('is not a valid URL')
  ) {
    return 'Die URL ist nicht gueltig. Bitte eine vollstaendige Adresse eingeben (z.B. https://beispiel.at/artikel)'
  }
  if (msg.includes('Body exceeded') || msg.includes('body size') || msg.includes('PayloadTooLarge')) {
    return 'Die Bilder sind zu gross. Bitte weniger oder kleinere Bilder auswaehlen.'
  }
  if (msg.includes('Unexpected token') || msg.includes('not valid JSON') || msg.includes('JSON')) {
    return 'Server-Fehler. Bitte erneut versuchen.'
  }
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('network')) {
    return 'Keine Verbindung. Bitte Internetverbindung pruefen und erneut versuchen.'
  }
  return msg
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0)
  const [inputType, setInputType] = useState('url')
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [imageFiles, setImageFiles] = useState([])
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
  const [publishMode, setPublishMode] = useState('live')

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const utteranceRef = useRef(null)

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
  const imageInputRef = useRef(null)

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

  // URL normalisieren — https:// ergaenzen falls fehlend.
  // Keine weitere Validierung: new URL() in iOS Safari lehnt valide URLs ab.
  // Die fetch-url API entscheidet ob die URL erreichbar ist.
  const normalizeUrl = (raw) => {
    const trimmed = raw.trim()
    if (!trimmed) throw new Error('Bitte eine URL eingeben')
    return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed
  }

  // Bild komprimieren: max 1200px, JPEG 75% — reduziert 5MB PNGs auf ~100-200KB
  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Bild konnte nicht dekodiert werden'))
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_PX || height > MAX_PX) {
          if (width >= height) { height = Math.round(height * MAX_PX / width); width = MAX_PX }
          else { width = Math.round(width * MAX_PX / height); height = MAX_PX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve({ data: canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1], mediaType: 'image/jpeg' })
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })

  const handleImageSelect = (files) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const valid = files.filter(f => validTypes.includes(f.type))
    if (valid.length < files.length) setError('Nur JPG, PNG, WEBP und GIF werden unterstuetzt.')
    setImageFiles(prev => {
      const combined = [...prev, ...valid]
      if (combined.length > MAX_IMAGES) { setError('Maximal ' + MAX_IMAGES + ' Bilder erlaubt.'); return combined.slice(0, MAX_IMAGES) }
      return combined
    })
  }

  const handleImageDrop = (e) => {
    e.preventDefault()
    handleImageSelect(Array.from(e.dataTransfer.files))
  }

  const handleGenerate = async () => {
    setError('')
    setLoading(true)
    let content = ''
    let title = ''
    let resolvedInputType = inputType

    try {
      if (inputType === 'url') {
        // normalizeUrl wirft bei ungueltigem Input bereits einen deutschen Fehler
        const url = normalizeUrl(urlInput)
        setUrlInput(url)
        setLoadingMsg('URL wird geladen...')
        let r, d
        try {
          r = await fetch('/api/fetch-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          })
          d = await r.json()
        } catch (fetchErr) {
          throw new Error(sanitizeError(fetchErr))
        }
        // API-Fehlermeldungen ebenfalls bereinigen
        if (!r.ok) throw new Error(sanitizeError({ message: d.error || 'URL konnte nicht geladen werden' }))
        content = d.content
        title = d.title

      } else if (inputType === 'pdf') {
        if (!pdfFile) throw new Error('Bitte ein PDF hochladen')
        setLoadingMsg('PDF wird gelesen...')
        content = await extractPdfClientSide(pdfFile)
        title = pdfFile.name

      } else if (inputType === 'images') {
        if (imageFiles.length === 0) throw new Error('Bitte mindestens ein Foto oder Screenshot hochladen')
        setLoadingMsg(imageFiles.length + ' Bild(er) werden komprimiert...')
        const compressed = await Promise.all(imageFiles.map(compressImage))
        content = '[' + imageFiles.length + ' Bild(er) hochgeladen]'
        title = 'Foto-/Screenshot-Analyse'
        setSourceContent(content)
        setSourceTitle(title)
        setLoadingMsg('Artikel wird aus Bildern geschrieben...')
        await generateArticle(content, title, null, null, 'images', compressed)
        return

      } else {
        if (!textInput.trim()) throw new Error('Bitte Text, Idee oder Thema eingeben')
        content = textInput.trim()
        title = ''
        resolvedInputType = 'direkt'
      }

      setSourceContent(content)
      setSourceTitle(title)
      setLoadingMsg('Artikel wird geschrieben...')
      await generateArticle(content, title, null, null, resolvedInputType)

    } catch (err) {
      // Letzter Sicherheitsnetz: alle noch nicht abgefangenen Rohfehler uebersetzen
      setError(sanitizeError(err))
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  const generateArticle = async (srcContent, srcTitle, feedback, prevArticle, resolvedType, imgs) => {
    let r, d
    try {
      r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceContent: srcContent || sourceContent,
          sourceTitle: srcTitle || sourceTitle,
          inputType: resolvedType || inputType,
          feedback,
          previousArticle: prevArticle,
          hinweise: hinweise.trim() || undefined,
          images: imgs || undefined
        })
      })
      d = await r.json()
    } catch (fetchErr) {
      throw new Error(sanitizeError(fetchErr))
    }
    if (!r.ok) throw new Error(sanitizeError({ message: d.error || 'Generierung fehlgeschlagen' }))
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

  const handleApplyVoice = () => {
    let updatedArticle = article
    if (editedPerspective.trim()) {
      const lines = article.split('\n')
      let paragraphCount = 0
      let insertIndex = lines.length
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' && i > 0 && lines[i - 1].trim() !== '') {
          paragraphCount++
          if (paragraphCount === 2) { insertIndex = i + 1; break }
        }
      }
      lines.splice(insertIndex, 0, '\n\u201e' + editedPerspective + '\u201c\n\u2014 Harald Sturm\n')
      updatedArticle = lines.join('\n')
    }
    if (selectedLinks.length > 0) {
      updatedArticle += '\n\n**Weiterfuehrende Artikel:**\n' + selectedLinks.map(l => '- [' + l.anchor + '](' + l.url + ')').join('\n')
    }
    setArticle(updatedArticle)
    setCurrentStep(3)
    handleLoadImages()
  }

  const handleFeedback = async () => {
    if (!feedbackText.trim()) return
    setError('')
    setLoading(true)
    setLoadingMsg('Artikel wird ueberarbeitet...')
    try {
      await generateArticle(null, null, feedbackText, article, inputType)
      setFeedbackText('')
      setCurrentStep(1)
    } catch (err) {
      setError(sanitizeError(err))
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
      setError(sanitizeError(err))
    } finally {
      setImagesLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedImage) { setError('Bitte zuerst ein Titelbild auswaehlen.'); return }
    setError('')
    setLoading(true)
    setLoadingMsg(publishMode === 'draft' ? 'Wird als Entwurf gespeichert...' : 'Wird auf Wix veroeffentlicht...')
    try {
      const r = await fetch('/api/publish-wix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: seoTitle, article, seoTitle, seoDescription, seoSlug, focusKeyword, imageUrl: selectedImage?.url || null, imageAlt: selectedImage?.alt || null, saveAsDraft: publishMode === 'draft' })
      })
      const rawText = await r.text()
      let d = {}
      try { d = JSON.parse(rawText) } catch (_) { throw new Error('Wix API: Ungueltige Antwort - ' + rawText.slice(0, 200)) }
      if (!r.ok) throw new Error(sanitizeError({ message: d.error + (d.detail ? ': ' + d.detail : '') }))
      setPublished(true)
      setPublishedUrl(d.postUrl || '')
      setCurrentStep(4)
    } catch (err) {
      setError(sanitizeError(err))
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
    setImageFiles([])
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
    if (file && file.type === 'application/pdf') setPdfFile(file)
  }

  const toggleLink = (link) => {
    setSelectedLinks(prev => prev.find(l => l.url === link.url) ? prev.filter(l => l.url !== link.url) : [...prev, link])
  }

  const VoiceBtn = ({ isRecording, onStart, onStop }) => (
    voiceSupported ? (
      <button
        className={isRecording ? 'voice-btn recording' : 'voice-btn'}
        onClick={isRecording ? onStop : onStart}
        title={isRecording ? 'Aufnahme stoppen' : 'Spracheingabe'}
      >
        {isRecording ? '\u23F9' : '\uD83C\uDF99'}
      </button>
    ) : null
  )

  return (
    <>
      <Head>
        <title>brandDOC Content Engine</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app">
        <header className="header">
          <div className="header-logo">bD</div>
          <div>
            <div className="header-title">brandDOC Content Engine</div>
            <div className="header-sub">Input &rarr; Artikel &rarr; Stimme &rarr; Bild &rarr; Publish</div>
          </div>
        </header>

        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={'step' + (i === currentStep ? ' active' : '') + (i < currentStep ? ' done' : '')}>{s}</div>
          ))}
        </div>

        {error && (
          <div className="status error">
            <span>&#9888;</span> {error}
          </div>
        )}
        {loading && (
          <div className="status loading">
            <div className="spinner" />
            {loadingMsg || 'Einen Moment...'}
          </div>
        )}

        {/* STEP 0: INPUT */}
        {currentStep === 0 && !loading && (
          <div className="card">
            <div className="card-title">
              <span className="icon">&#128161;</span> Hinweise
              <span style={{ fontSize: '0.75rem', fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>(optional)</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
              Kontext, Fokus, Zielgruppe oder spezielle Wuensche fuer diesen Artikel.
            </div>
            <div className="feedback-row" style={{ marginBottom: '1.5rem' }}>
              <textarea
                placeholder="z.B. Schreibe aus Sicht eines oesterreichischen Maschinenbauers oder Betone den ROI-Aspekt..."
                value={hinweise}
                onChange={e => setHinweise(e.target.value)}
                rows={3}
              />
              <VoiceBtn isRecording={isRecordingHinweise} onStart={() => startVoice(setHinweise, setIsRecordingHinweise)} onStop={() => stopVoice(setIsRecordingHinweise)} />
            </div>

            <hr className="divider" style={{ margin: '0 0 1.5rem' }} />

            <div className="card-title"><span className="icon">&#128229;</span> Content-Quelle</div>
            <div className="input-tabs">
              <button className={inputType === 'url' ? 'input-tab active' : 'input-tab'} onClick={() => setInputType('url')}>&#128279; URL / Artikel</button>
              <button className={inputType === 'pdf' ? 'input-tab active' : 'input-tab'} onClick={() => setInputType('pdf')}>&#128196; PDF</button>
              <button className={inputType === 'images' ? 'input-tab active' : 'input-tab'} onClick={() => setInputType('images')}>&#128247; Fotos / Screenshots</button>
              <button className={inputType === 'text' ? 'input-tab active' : 'input-tab'} onClick={() => setInputType('text')}>&#128173; Direkt schreiben</button>
            </div>

            {inputType === 'url' && (
              <input
                type="text"
                placeholder="https://..."
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              />
            )}

            {inputType === 'pdf' && (
              <div
                className={pdfFile ? 'upload-area dragover' : 'upload-area'}
                onDrop={handleFileDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} />
                {pdfFile
                  ? <span style={{ color: 'var(--blue-light)' }}>&#9989; {pdfFile.name}</span>
                  : <><div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128196;</div>PDF hier hinziehen oder klicken</>
                }
              </div>
            )}

            {inputType === 'images' && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                  Fotos, Screenshots, Slides oder Scans. Claude analysiert die Bilder und schreibt den Artikel daraus.
                  Bis zu {MAX_IMAGES} Bilder (JPG, PNG, WEBP). Werden automatisch komprimiert.
                </div>
                <div
                  className={imageFiles.length > 0 ? 'upload-area dragover' : 'upload-area'}
                  style={{ minHeight: '110px' }}
                  onDrop={handleImageDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => imageInputRef.current && imageInputRef.current.click()}
                >
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={e => { handleImageSelect(Array.from(e.target.files)); e.target.value = '' }}
                  />
                  {imageFiles.length === 0 ? (
                    <>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128247;</div>
                      Bilder hier hinziehen oder klicken<br />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>JPG, PNG, WEBP - max. {MAX_IMAGES} Bilder</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--blue-light)' }}>
                      &#9989; {imageFiles.length}/{MAX_IMAGES} {imageFiles.length === 1 ? 'Bild' : 'Bilder'} ausgewaehlt
                      {imageFiles.length < MAX_IMAGES && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> - klicken um weitere hinzuzufuegen</span>
                      )}
                    </span>
                  )}
                </div>
                {imageFiles.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginTop: '0.85rem' }}>
                    {imageFiles.map((file, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '4/3', border: '1px solid var(--border)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(file)} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <button
                          onClick={e => { e.stopPropagation(); setImageFiles(prev => prev.filter((_, j) => j !== i)) }}
                          title="Entfernen"
                          style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', color: 'white', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >x</button>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '3px 6px', fontSize: '0.62rem', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{file.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {inputType === 'text' && (
              <>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Thema, Idee, eigener Text oder direkt per Stimme einsprechen.
                </div>
                <div className="feedback-row">
                  <textarea
                    placeholder="z.B. Schreibe einen Artikel ueber Preispositionierung fuer Handwerksbetriebe..."
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    rows={5}
                  />
                  <VoiceBtn isRecording={isRecordingText} onStart={() => startVoice(setTextInput, setIsRecordingText)} onStop={() => stopVoice(setIsRecordingText)} />
                </div>
              </>
            )}

            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
                Artikel generieren
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: ARTICLE */}
        {currentStep === 1 && !published && (
          <div className="card">
            <div className="card-title">
              <span className="icon">&#128221;</span> Artikel
              {iteration > 0 && <span className="iteration-badge" style={{ marginLeft: 'auto' }}>Version {iteration}</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Direkt bearbeitbar</div>
            <textarea value={article} onChange={e => setArticle(e.target.value)} rows={20} style={{ resize: 'vertical' }} />
            {speechSupported && (
              <div className="tts-bar">
                <button className="tts-btn" onClick={isSpeaking ? stopSpeaking : speakArticle}>{isSpeaking ? '\u23F9' : '\u25B6'}</button>
                <span className="tts-label">{isSpeaking ? 'Wird vorgelesen... klick zum Stoppen' : 'Artikel anhoeren'}</span>
              </div>
            )}
            <hr className="divider" />
            <div className="card-title" style={{ marginBottom: '0.75rem' }}><span className="icon">&#128172;</span> Feedback geben</div>
            <div className="feedback-row">
              <textarea placeholder="Was soll anders werden?" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3} />
              <VoiceBtn isRecording={isRecordingFeedback} onStart={() => startVoice(setFeedbackText, setIsRecordingFeedback)} onStop={() => stopVoice(setIsRecordingFeedback)} />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleFeedback} disabled={loading || !feedbackText.trim()}>Neue Version</button>
              <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>Passt - weiter zu Stimme</button>
              <button className="btn btn-secondary" onClick={handleReset}>Von vorne</button>
            </div>
          </div>
        )}

        {/* STEP 2: DEINE STIMME */}
        {currentStep === 2 && !published && (
          <div className="card">
            <div className="card-title"><span className="icon">&#127897;</span> Deine Stimme</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Waehle einen Perspektiv-Vorschlag, bearbeite ihn. Er wird in den Artikel eingebaut.
            </div>
            {perspectives.map((p, i) => (
              <div
                key={i}
                onClick={() => { setSelectedPerspective(i); setEditedPerspective(p) }}
                style={{ background: selectedPerspective === i ? 'rgba(2,133,206,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (selectedPerspective === i ? 'var(--blue)' : 'var(--border)'), borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--blue-light)', marginBottom: '0.4rem', letterSpacing: '0.06em' }}>
                  {i === 0 ? 'Persoenlich & direkt' : i === 1 ? 'Provokant & fordernd' : 'Praxis & KMU'}
                </div>
                <div style={{ fontSize: '0.88rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.85)' }}>{p || '-'}</div>
              </div>
            ))}
            {selectedPerspective !== null && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Bearbeiten</div>
                <textarea value={editedPerspective} onChange={e => setEditedPerspective(e.target.value)} rows={4} style={{ resize: 'vertical' }} />
              </div>
            )}
            {inputType !== 'images' && internalLinks.length > 0 && (
              <>
                <hr className="divider" />
                <div className="card-title" style={{ marginBottom: '0.75rem' }}><span className="icon">&#128279;</span> Interne Verlinkungen</div>
                {internalLinks.map((link, i) => (
                  <div
                    key={i}
                    onClick={() => toggleLink(link)}
                    style={{ background: selectedLinks.find(l => l.url === link.url) ? 'rgba(2,133,206,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (selectedLinks.find(l => l.url === link.url) ? 'var(--blue)' : 'var(--border)'), borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.5rem', cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    <div style={{ fontSize: '0.82rem', color: 'var(--white)', marginBottom: '0.2rem' }}>&#128196; {link.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--blue-light)' }}>Ankertext: {link.anchor}</div>
                  </div>
                ))}
              </>
            )}
            <div className="btn-row" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={handleApplyVoice} disabled={loading}>
                {(editedPerspective.trim() || selectedLinks.length > 0) ? 'Einbauen und weiter zu Bild' : 'Ueberspringen - weiter zu Bild'}
              </button>
              <button className="btn btn-secondary" onClick={() => setCurrentStep(1)}>Zurueck</button>
            </div>
          </div>
        )}

        {/* STEP 3: TITELBILD + SEO */}
        {currentStep === 3 && !published && (
          <div className="card">
            <div className="card-title"><span className="icon">&#128444;</span> Titelbild waehlen</div>
            {imagesLoading && <div className="status loading"><div className="spinner" /> Bilder werden gesucht...</div>}
            {!imagesLoading && images.length > 0 && (
              <>
                <div className="image-grid">
                  {images.map(img => (
                    <div key={img.id} className={selectedImage && selectedImage.id === img.id ? 'image-option selected' : 'image-option'} onClick={() => setSelectedImage(img)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.thumb} alt={img.alt} />
                      <div className="check">&#10003;</div>
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
            <hr className="divider" />
            <div className="card-title" style={{ marginBottom: '1rem' }}><span className="icon">&#128269;</span> SEO bearbeiten</div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>SEO Titel</div>
              <input type="text" value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="SEO Titel..." />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Meta Description</div>
              <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} rows={3} placeholder="Meta Description..." />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>URL Slug</div>
              <input type="text" value={seoSlug} onChange={e => setSeoSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="url-slug" style={{ fontFamily: 'monospace' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Fokus-Keyword</div>
              <input type="text" value={focusKeyword} onChange={e => setFocusKeyword(e.target.value)} placeholder="z.B. Markenpositionierung KMU" />
            </div>
            <div style={{ background: 'white', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '0.4rem' }}>Google Vorschau</div>
              <div style={{ color: '#1a0dab', fontSize: '1rem', fontWeight: '600', marginBottom: '0.15rem', fontFamily: 'arial, sans-serif' }}>{seoTitle || 'SEO Titel...'}</div>
              <div style={{ color: '#006621', fontSize: '0.78rem', marginBottom: '0.2rem', fontFamily: 'arial, sans-serif' }}>branddoc.at &rsaquo; blog &rsaquo; {seoSlug || 'url-slug'}</div>
              <div style={{ color: '#545454', fontSize: '0.82rem', fontFamily: 'arial, sans-serif', lineHeight: '1.4' }}>{seoDescription || 'Meta Description...'}</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
              <button
                onClick={() => setPublishMode('live')}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '2px solid ' + (publishMode === 'live' ? 'var(--blue)' : 'var(--border)'), background: publishMode === 'live' ? 'rgba(2,133,206,0.15)' : 'transparent', color: publishMode === 'live' ? 'var(--white)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '0.85rem', transition: 'all 0.15s' }}
              >
                Direkt live
              </button>
              <button
                onClick={() => setPublishMode('draft')}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '2px solid ' + (publishMode === 'draft' ? 'var(--blue)' : 'var(--border)'), background: publishMode === 'draft' ? 'rgba(2,133,206,0.15)' : 'transparent', color: publishMode === 'draft' ? 'var(--white)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '0.85rem', transition: 'all 0.15s' }}
              >
                Als Entwurf
              </button>
            </div>
            <div className="btn-row">
              <button className="btn btn-publish" onClick={handlePublish} disabled={loading || !selectedImage}>
                {publishMode === 'draft' ? 'Als Entwurf speichern' : 'Jetzt auf Wix veroeffentlichen'}
              </button>
            </div>
            {!selectedImage && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>Bitte zuerst ein Titelbild auswaehlen.</div>}
          </div>
        )}

        {/* SUCCESS */}
        {published && (
          <div className="card">
            <div className="publish-success">
              <div className="big-check">&#127881;</div>
              <h2>{publishMode === 'draft' ? 'Entwurf gespeichert!' : 'Artikel ist live!'}</h2>
              <p>{publishMode === 'draft' ? 'Dein Artikel wurde als Entwurf auf Wix gespeichert.' : 'Dein Blogartikel wurde erfolgreich auf branddoc.at veroeffentlicht.'}</p>
              {publishedUrl && (
                <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
                  Artikel ansehen
                </a>
              )}
              <br />
              <button className="btn btn-primary" onClick={handleReset} style={{ marginTop: '0.75rem' }}>Naechsten Artikel schreiben</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
