export default async function handler(req, res) {
  const response = await fetch('https://www.wixapis.com/members/v1/members', {
    headers: {
      'Authorization': process.env.WIX_API_KEY,
      'wix-site-id': process.env.WIX_SITE_ID
    }
  })
  const text = await response.text()
  res.json({ status: response.status, body: text })
}
