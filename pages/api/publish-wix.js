export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { title, article, seoTitle, seoDescription, seoSlug, focusKeyword, saveAsDraft } = req.body

  const emptyParagraph = { type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: '' } }] }

  // Build rich content nodes
  const contentNodes = []
  const allLines = article.split('\n').filter(l => l.trim())
  const firstIsH1 = allLines[0]?.trim().startsWith('# ') && !allLines[0]?.trim().startsWith('## ')
  const lines = firstIsH1 ? allLines.slice(1) : allLines

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('### ')) {
      contentNodes.push(emptyParagraph)
      contentNodes.push({ type: 'HEADING', headingData: { level: 3 }, nodes: [{ type: 'TEXT', textData: { text: trimmed.slice(4) } }] })
      contentNodes.push(emptyParagraph)
    } else if (trimmed.startsWith('## ')) {
      contentNodes.push(emptyParagraph)
      contentNodes.push({ type: 'HEADING', headingData: { level: 2 }, nodes: [{ type: 'TEXT', textData: { text: trimmed.slice(3) } }] })
      contentNodes.push(emptyParagraph)
    } else if (trimmed.startsWith('# ')) {
      contentNodes.push(emptyParagraph)
      contentNodes.push({ type: 'HEADING', headingData: { level: 1 }, nodes: [{ type: 'TEXT', textData: { text: trimmed.slice(2) } }] })
      contentNodes.push(emptyParagraph)
    } else if (trimmed.startsWith('„') || trimmed.startsWith('"')) {
      contentNodes.push(emptyParagraph)
      contentNodes.push({
        type: 'BLOCKQUOTE',
        nodes: [{
          type: 'PARAGRAPH',
          nodes: [{
            type: 'TEXT',
            textData: {
              text: trimmed,
              decorations: [{ type: 'ITALIC' }]
            }
          }]
        }]
      })
      contentNodes.push(emptyParagraph)
    } else {
      contentNodes.push({ type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: trimmed } }] })
      contentNodes.push(emptyParagraph)
    }
  }

  // Fixed author bio
  contentNodes.push(
    emptyParagraph,
    { type: 'DIVIDER', dividerData: {} },
    emptyParagraph,
    { type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: 'Hallo, ich bin Harald Sturm 👋 Ich bin Marken-Arzt.', decorations: [{ type: 'BOLD' }] } }] },
    emptyParagraph,
    { type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: 'Marken brauchen keinen Stylisten – sie brauchen manchmal einen Arzt. Ich diagnostiziere, warum starke Unternehmen unter ihrem Wert wahrgenommen werden, und begleite sie – beratend oder als Fractional CMO – dabei, das dauerhaft zu ändern.' } }] },
    emptyParagraph,
    { type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: 'Meine These: Fast jedes Unternehmen ist besser als sein Marktauftritt. Wer seine Marke alle zwei Jahre neu erfindet, zahlt jedes Mal die Anlaufkosten – und erntet nie den Zinseszins.' } }] },
    emptyParagraph
  )

  const draftPayload = {
    draftPost: {
      title: title || seoTitle,
      memberId: '1df8a1bf-27b1-4c1d-bcd9-231133ed3297',
      slug: seoSlug,
      excerpt: seoDescription,
      richContent: { nodes: contentNodes },
      seoData: {
        title: seoTitle,
        description: seoDescription,
        tags: [
          { type: 'title', children: seoTitle },
          { type: 'meta', props: { name: 'description', content: seoDescription } },
          ...(focusKeyword ? [{ type: 'meta', props: { name: 'keywords', content: focusKeyword } }] : [])
        ]
      }
    }
  }

  try {
    const draftResponse = await fetch('https://www.wixapis.com/blog/v3/draft-posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID
      },
      body: JSON.stringify(draftPayload)
    })

    const draftText = await draftResponse.text()
    let draftData = {}
    try { draftData = JSON.parse(draftText) } catch (_) {}

    if (!draftResponse.ok) {
      return res.status(500).json({ error: 'Entwurf fehlgeschlagen', detail: draftText || `HTTP ${draftResponse.status}` })
    }

    const draftId = draftData.draftPost?.id

    if (saveAsDraft) {
      return res.json({ success: true, postId: draftId, postUrl: null })
    }

    const publishResponse = await fetch(`https://www.wixapis.com/blog/v3/draft-posts/${draftId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID
      }
    })

    const publishText = await publishResponse.text()
    let publishData = {}
    try { publishData = JSON.parse(publishText) } catch (_) {}

    if (!publishResponse.ok) {
      return res.status(500).json({ error: 'Veröffentlichen fehlgeschlagen', detail: publishText || `HTTP ${publishResponse.status}` })
    }

    res.json({ success: true, postId: publishData.post?.id, postUrl: publishData.post?.url })

  } catch (err) {
    res.status(500).json({ error: 'Publishing fehlgeschlagen: ' + err.message })
  }
}
