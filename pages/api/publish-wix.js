export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { title, article, seoTitle, seoDescription, seoSlug, imageUrl, imageAlt } = req.body

  // Convert plain text article to basic HTML
  const lines = article.split('\n').filter(l => l.trim())
  let htmlContent = ''
  for (const line of lines) {
    if (line.startsWith('# ')) {
      htmlContent += `<h1>${line.slice(2)}</h1>\n`
    } else if (line.startsWith('## ')) {
      htmlContent += `<h2>${line.slice(3)}</h2>\n`
    } else if (line.startsWith('### ')) {
      htmlContent += `<h3>${line.slice(4)}</h3>\n`
    } else {
      htmlContent += `<p>${line}</p>\n`
    }
  }

  const postPayload = {
    post: {
      title: title || seoTitle,
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
      },
      ...(imageUrl && {
        media: {
          custom: imageUrl,
          isCustomCoverImage: true
        }
      })
    }
  }

 try {
    const response = await fetch('https://www.wixapis.com/blog/v3/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.WIX_API_KEY,
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

    res.json({ success: true, postId: data.post?.id, postUrl: data.post?.url })
  } catch (err) {
    res.status(500).json({ error: 'Publishing fehlgeschlagen: ' + err.message })
  }
