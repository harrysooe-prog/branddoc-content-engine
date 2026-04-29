export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.status(400).json({ error: 'PDF wird jetzt direkt im Browser verarbeitet. Bitte Seite neu laden.' })
}
