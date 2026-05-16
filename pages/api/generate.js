const EXISTING_ARTICLES = [
  {
    title: 'Category Entry Points: Der Moment, in dem Ihre Marke entweder präsent ist – oder nicht',
    url: 'https://www.branddoc.at/post/category-entry-points-der-moment-in-dem-ihre-marke-entweder-präsent-ist-oder-nicht',
    topics: 'Category Entry Points, mentale Verfügbarkeit, Byron Sharp, Markenpräsenz'
  },
  {
    title: 'Budweiser WM-Kampagne: Fans statt Produkt im Fokus',
    url: 'https://www.branddoc.at/post/budweiser-wm-kampagne-fans-statt-produkt-im-fokus',
    topics: 'emotionale Markenkommunikation, Storytelling, Kampagne'
  },
  {
    title: 'Was KMU von Budweisers WM-Kampagne 2026 lernen können',
    url: 'https://www.branddoc.at/post/was-kmu-von-budweisers-wm-kampagne-2026-lernen-können',
    topics: 'KMU Markenarbeit, emotionale Werbung, Budweiser'
  },
  {
    title: 'Marke gehört in die Geschäftsführung — nicht ins Marketing',
    url: 'https://www.branddoc.at/post/marke-gehört-in-die-geschäftsführung-nicht-ins-marketing',
    topics: 'Markenstrategie, Führung, Chefsache, Positionierung'
  }
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { sourceContent, sourceTitle, feedback, previousArticle, inputType, hinweise, images } = req.body

  const articleList = EXISTING_ARTICLES.map(a => `- "${a.title}" (${a.url}) — Themen: ${a.topics}`).join('\n')

  const systemPrompt = `Du bist der brandDOC Content-Assistent von Harald Sturm, Markenberater und Fractional CMO für inhabergeführte KMU im DACH-Raum (50–500 Mitarbeiter).

HARALDS STIMME & STIL:
- Direkt, neugierig-machend, orientierend — nie werblich oder generisch
- Journalistisch, leicht provokativ, evidenzbasiert
- Zielgruppe: CEOs und Inhaber, nicht Agenturen
- Keine Phrasen wie "In der heutigen Welt", "Es ist wichtig zu wissen", "Zusammenfassend"
- Keine Aufzählungen wo Fließtext besser wirkt
- Kernthese: "Viele Unternehmen sind besser als ihr Marktauftritt" — das kostet täglich Marge
- Frameworks: Binet & Field, Byron Sharp, Mark Ritson, System1/Orlando Wood
- Proof Cases: BT Bau (0 auf 60 Bewerbungen nach Markenarbeit), Kurhaus Schärding (Revenue per Guest fast verdoppelt)

INHALTSTREUE:
- Bleibe eng am Quellinhalt. Übernimm alle zentralen Fakten, Zahlen, Zitate und Argumente.
- Erfinde KEINE neuen Fakten oder Zahlen die nicht in der Quelle stehen.
- Adaption in Haralds Stimme — nicht Neuerfindung des Inhalts.
- Bei Direktartikeln (ohne Quelle): schreibe aus Haralds Expertise heraus, konkret und praxisnah.
- Bei Bildern/Screenshots: Analysiere alle sichtbaren Inhalte sorgfältig (Text, Grafiken, Daten, Kontext) und nutze diese als Grundlage.

PERSPEKTIVE & FRAMING:
- Jeder Artikel braucht eine klare Haltung — nicht nur Analyse, sondern Meinung.
- Mindestens ein Moment der zeigt was der CEO verliert wenn er nichts ändert.
- Framing: Perspektivenwechsel statt "was du lernen kannst".

BLOGARTIKEL-FORMAT:
- Länge: 600–900 Wörter
- Headline: provokativ, klar, kein Clickbait — als H1 (# Headline)
- Lead: erster Satz muss sofort fesseln
- Struktur: Fließtext, max. 2–3 Zwischenüberschriften (## Überschrift)
- Abschluss: Loss-Framing — was verliert der CEO wenn er nichts ändert?
- Schreibe IMMER auf Deutsch.

AM ENDE des Artikels, getrennt durch "---", liefere EXAKT dieses Format:

SEO_TITLE: (max 60 Zeichen)
SEO_DESCRIPTION: (max 155 Zeichen)
SEO_SLUG: (URL-freundlich, Deutsch, Bindestriche)
UNSPLASH_QUERY: (2–3 englische Keywords)
FOCUS_KEYWORD: (1–3 deutsche Keywords)
PERSPECTIVE_1: (2-3 Sätze — Haralds direkte persönliche Meinung, Ich-Form)
PERSPECTIVE_2: (2-3 Sätze — provokant, CEO direkt angesprochen, Du-Form)
PERSPECTIVE_3: (2-3 Sätze — konkreter KMU-Praxisbezug, Beobachtung aus der Beratung)
INTERNAL_LINK_1: TITLE|URL|ANKERTEXT
INTERNAL_LINK_2: TITLE|URL|ANKERTEXT

Bestehende Artikel auf branddoc.at:
${articleList}`

  // --- Build the user message (string or multipart array) ---
  let messageContent

  if (feedback && previousArticle) {
    // Feedback / revision iteration — always text-only
    messageContent = `Hier ist der bisherige Blogartikel:\n\n${previousArticle}\n\n---\n\nHaralds Feedback:\n${feedback}\n\nBitte überarbeite den Artikel entsprechend. Behalte was gut ist, ändere was Harald kritisiert hat.`

  } else if (inputType === 'images' && Array.isArray(images) && images.length > 0) {
    // ── NEW: Vision / Screenshot path ──────────────────────────────────────
    // Validate images: each entry must have { data: string, mediaType: string }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const validImages = images.filter(
      img => img && typeof img.data === 'string' && img.data.length > 0 && allowedTypes.includes(img.mediaType)
    )

    if (validImages.length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Bilder übergeben (erlaubt: JPG, PNG, WEBP, GIF).' })
    }

    // Build multipart content: images first, instruction text last
    messageContent = [
      ...validImages.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType,
          data: img.data
        }
      })),
      {
        type: 'text',
        text: [
          `Analysiere ${validImages.length === 1 ? 'dieses Bild' : `diese ${validImages.length} Bilder`} sorgfältig —`,
          'lies alle sichtbaren Texte, erkenne Grafiken, Daten, Diagramme und Kontext.',
          'Schreibe dann einen Blogartikel für brandDOC.at, der den Inhalt der Bilder als Grundlage nutzt.',
          hinweise ? `\n\nZusätzliche Hinweise von Harald: ${hinweise}` : ''
        ].join(' ')
      }
    ]
    // ── End Vision path ────────────────────────────────────────────────────

  } else if (inputType === 'direkt') {
    messageContent = `Schreibe einen Blogartikel für brandDOC.at basierend auf diesem Thema/Prompt:\n\n${sourceContent}${hinweise ? `\n\nZusätzliche Hinweise von Harald:\n${hinweise}` : ''}`

  } else {
    messageContent = `Schreibe einen Blogartikel für brandDOC.at basierend auf diesem ${inputType === 'url' ? 'Artikel' : 'Dokument'}.

WICHTIG: Bleibe eng an den Fakten, Zahlen, Zitaten und Argumenten der Quelle. Adaptiere in Haralds Stimme — erfinde nichts dazu.
${hinweise ? `\nZusätzliche Hinweise von Harald: ${hinweise}` : ''}

${sourceTitle ? `Titel/Quelle: ${sourceTitle}\n\n` : ''}Quellinhalt:
${sourceContent}`
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            // messageContent is either a plain string or an array of content blocks (vision)
            content: messageContent
          }
        ]
      })
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Claude API Fehler' })
    }

    const fullText = data.content[0].text
    const parts = fullText.split('---')
    const articleText = parts[0].trim()
    const seoBlock = parts[1] || ''

    const seoTitle = seoBlock.match(/SEO_TITLE:\s*(.+)/)?.[1]?.trim() || ''
    const seoDescription = seoBlock.match(/SEO_DESCRIPTION:\s*(.+)/)?.[1]?.trim() || ''
    const seoSlug = seoBlock.match(/SEO_SLUG:\s*(.+)/)?.[1]?.trim() || ''
    const unsplashQuery = seoBlock.match(/UNSPLASH_QUERY:\s*(.+)/)?.[1]?.trim() || 'business professional'
    const focusKeyword = seoBlock.match(/FOCUS_KEYWORD:\s*(.+)/)?.[1]?.trim() || ''
    const perspective1 = seoBlock.match(/PERSPECTIVE_1:\s*(.+)/)?.[1]?.trim() || ''
    const perspective2 = seoBlock.match(/PERSPECTIVE_2:\s*(.+)/)?.[1]?.trim() || ''
    const perspective3 = seoBlock.match(/PERSPECTIVE_3:\s*(.+)/)?.[1]?.trim() || ''

    const internalLinks = []
    const link1Match = seoBlock.match(/INTERNAL_LINK_1:\s*(.+)/)
    const link2Match = seoBlock.match(/INTERNAL_LINK_2:\s*(.+)/)
    for (const match of [link1Match, link2Match]) {
      if (match) {
        const p = match[1].split('|')
        if (p.length === 3) internalLinks.push({ title: p[0].trim(), url: p[1].trim(), anchor: p[2].trim() })
      }
    }

    res.json({ article: articleText, seoTitle, seoDescription, seoSlug, unsplashQuery, focusKeyword, perspectives: [perspective1, perspective2, perspective3].filter(Boolean), internalLinks })
  } catch (err) {
    res.status(500).json({ error: 'Generierung fehlgeschlagen: ' + err.message })
  }
}
