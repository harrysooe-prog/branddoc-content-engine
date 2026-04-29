import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL fehlt' })

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; brandDOC/1.0)' },
      timeout: 10000
    })
    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove noise
    $('script, style, nav, footer, header, aside, .ad, .ads, .advertisement').remove()

    // Try article first, then main, then body
    const content =
      $('article').text() ||
      $('main').text() ||
      $('body').text()

    const title = $('title').text() || $('h1').first().text() || ''
    const cleaned = content.replace(/\s+/g, ' ').trim().slice(0, 12000)

    res.json({ title, content: cleaned })
  } catch (err) {
    res.status(500).json({ error: 'URL konnte nicht geladen werden: ' + err.message })
  }
}
