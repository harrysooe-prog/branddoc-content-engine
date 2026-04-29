export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sourceContent, sourceTitle, feedback, previousArticle, inputType } = req.body

  const systemPrompt = `Du bist der brandDOC Content-Assistent von Harald Sturmer, Markenberater und Fractional CMO für inhabergeführte KMU im DACH-Raum (50–500 Mitarbeiter).

HARALDS STIMME & STIL:
- Direkt, neugierig-machend, orientierend — nie werblich oder generisch
- Journalistisch, leicht provokativ, evidenzbasiert
- Zielgruppe: CEOs und Inhaber, nicht Agenturen
- Keine Phrasen wie "In der heutigen Welt", "Es ist wichtig zu wissen", "Zusammenfassend"
- Keine Aufzählungen wo Fließtext besser wirkt
- Kernthese: "Viele Unternehmen sind besser als ihr Marktauftritt" — das kostet täglich Marge
- Frameworks die Harald nutzt: Binet & Field, Byron Sharp, Mark Ritson, System1/Orlando Wood
- Konkrete Proof Cases wenn passend: BT Bau (0 auf 60 Bewerbungen nach Markenarbeit), Kurhaus Schärding (Revenue per Guest fast verdoppelt)

BLOGARTIKEL-FORMAT:
- Länge: 600–900 Wörter
- Headline: provokativ, klar, kein Clickbait
- Lead: erster Satz muss sofort fesseln
- Struktur: Fließtext, max. 2–3 Zwischenüberschriften wenn nötig
- Abschluss: konkreter Handlungsimpuls oder provokante Frage
- SEO: Am Ende des Artikels, getrennt durch "---", liefere:
  SEO_TITLE: (max 60 Zeichen)
  SEO_DESCRIPTION: (max 155 Zeichen)  
  SEO_SLUG: (URL-freundlich, Deutsch, Bindestriche)
  UNSPLASH_QUERY: (2–3 englische Keywords für ein passendes Bild)

Schreibe IMMER auf Deutsch.`

  let userMessage = ''

  if (feedback && previousArticle) {
    userMessage = `Hier ist der bisherige Blogartikel:\n\n${previousArticle}\n\n---\n\nHaralds Feedback:\n${feedback}\n\nBitte überarbeite den Artikel entsprechend. Behalte was gut ist, ändere was Harald kritisiert hat.`
  } else {
    userMessage = `Schreibe einen Blogartikel für brandDOC.at basierend auf diesem ${inputType === 'url' ? 'Artikel' : inputType === 'pdf' ? 'Dokument' : 'Inhalt'}:\n\n${sourceTitle ? `Titel/Quelle: ${sourceTitle}\n\n` : ''}${sourceContent}`
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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Claude API Fehler' })
    }

    const fullText = data.content[0].text

    // Parse SEO from article
    const parts = fullText.split('---')
    const articleText = parts[0].trim()
    const seoBlock = parts[1] || ''

    const seoTitle = seoBlock.match(/SEO_TITLE:\s*(.+)/)?.[1]?.trim() || ''
    const seoDescription = seoBlock.match(/SEO_DESCRIPTION:\s*(.+)/)?.[1]?.trim() || ''
    const seoSlug = seoBlock.match(/SEO_SLUG:\s*(.+)/)?.[1]?.trim() || ''
    const unsplashQuery = seoBlock.match(/UNSPLASH_QUERY:\s*(.+)/)?.[1]?.trim() || 'business professional'

    res.json({ article: articleText, seoTitle, seoDescription, seoSlug, unsplashQuery })
  } catch (err) {
    res.status(500).json({ error: 'Generierung fehlgeschlagen: ' + err.message })
  }
}
