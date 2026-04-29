export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { query } = req.body
  if (!query) return res.status(400).json({ error: 'Query fehlt' })

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6&orientation=landscape&content_filter=high`,
      {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Unsplash Fehler' })
    }

    const images = (data.results || []).slice(0, 3).map(img => ({
      id: img.id,
      url: img.urls.regular,
      thumb: img.urls.thumb,
      downloadUrl: img.links.download_location,
      author: img.user.name,
      authorUrl: img.user.links.html,
      alt: img.alt_description || query
    }))

    res.json({ images })
  } catch (err) {
    res.status(500).json({ error: 'Bilder konnten nicht geladen werden: ' + err.message })
  }
}
