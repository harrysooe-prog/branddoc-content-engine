export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { title, article, seoTitle, seoDescription, seoSlug } = req.body

  const postPayload = {
    draftPost: {
      title: title || seoTitle,
      memberId: '8871512c-f731-477c-9ee2-89e55354dbc7',
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
        slug: seoSlug
      }
    }
  }

  try {
    const response = await fetch('https://www.wixapis.com/blog/v3/draft-posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID
      },
      body: JSON.stringify(postPayload)
    })

    const rawText = await response.text()
    let data = {}
    try { data = JSON.parse(rawText) } catch (_) {}

    if (!response.ok) {
      return res.status(500).json({
        error: 'Wix Publishing fehlgeschlagen',
        detail: rawText || `HTTP ${response.status}`
      })
    }

    res.json({ success: true, postId: data.draftPost?.id, postUrl: data.draftPost?.url })

  } catch (err) {
    res.status(500).json({ error: 'Publishing fehlgeschlagen: ' + err.message })
  }
}
