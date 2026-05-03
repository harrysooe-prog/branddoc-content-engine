export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { title, article, seoTitle, seoDescription, seoSlug, imageUrl, focusKeyword } = req.body

  const draftPayload = {
    draftPost: {
      title: title || seoTitle,
      memberId: '1df8a1bf-27b1-4c1d-bcd9-231133ed3297',
      richContent: {
        nodes: [
          {
            type: 'PARAGRAPH',
            nodes: [{ type: 'TEXT', textData: { text: article } }]
          }
        ]
      },
      seoData: {
        title: seoTitle,
        description: seoDescription,
        slug: seoSlug,
        tags: [
          ...(focusKeyword ? [{ type: 'meta', props: { name: 'keywords', content: focusKeyword } }] : [])
        ]
      },
      ...(imageUrl && {
        coverMedia: { image: { url: imageUrl } }
      })
    }
  }

  try {
    // Schritt 1: Entwurf erstellen
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
      return res.status(500).json({
        error: 'Entwurf fehlgeschlagen',
        detail: draftText || `HTTP ${draftResponse.status}`
      })
    }

    const draftId = draftData.draftPost?.id

    // Schritt 2: Entwurf direkt veröffentlichen
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
      return res.status(500).json({
        error: 'Veröffentlichen fehlgeschlagen',
        detail: publishText || `HTTP ${publishResponse.status}`
      })
    }

    res.json({
      success: true,
      postId: publishData.post?.id,
      postUrl: publishData.post?.url
    })

  } catch (err) {
    res.status(500).json({ error: 'Publishing fehlgeschlagen: ' + err.message })
  }
}
