const Anthropic = require('@anthropic-ai/sdk');
const { Redis } = require('@upstash/redis');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Upstash Redis client - uses env vars automatically set by Vercel integration
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Rate limiter: max 20 requests per hour per IP
const rateLimit = new Map();
const MAX_REQUESTS = 20;
const WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    rateLimit.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  rateLimit.set(ip, entry);
  return false;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-api-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Check secret token
  const secret = process.env.API_SECRET;
  if (secret && req.headers['x-api-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests — please try again later.' });
  }

  const year = parseInt(req.query.year);
  if (isNaN(year) || year < -3000 || year > 2000) {
    return res.status(400).json({ error: 'Year must be between -3000 and 2000' });
  }

  const era = year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
  const cacheKey = `events:${year}`;

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${era}`);
      return res.json({ year, era, events: cached, cached: true });
    }
  } catch (err) {
    console.log('Cache read error, continuing:', err.message);
  }

  // Cache miss — call Anthropic
  console.log(`Cache miss for ${era}, calling Anthropic...`);
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Return ONLY a valid JSON array, no markdown, no backticks, no explanation.
Generate 14 historical events from ${era}.
Each object must have these exact fields:
"title" (max 8 words, no apostrophes),
"desc" (2 sentences, no apostrophes or special characters),
"cat" (one of: political religion military culture science exploration other),
"region" (one of: Europe Middle-East East-Asia South-Asia Southeast-Asia Central-Asia Africa Americas Scandinavia Oceania),
"lat" (number),
"lng" (number),
"entities" (array of 3-5 strings),
"wikiUrl" (Wikipedia URL string).
IMPORTANT: Do not use apostrophes or single quotes anywhere in the text values.
Start your response with [ and end with ]`
      }]
    });

    const raw = message.content[0].text.trim();
    const jsonStart = raw.indexOf('[');
    const jsonEnd = raw.lastIndexOf(']') + 1;
    if (jsonStart === -1) throw new Error('No JSON array found');
    const events = JSON.parse(raw.slice(jsonStart, jsonEnd));

    // Save to cache forever — history does not change!
    try {
      await redis.set(cacheKey, events);
      console.log(`Cached ${era}`);
    } catch (err) {
      console.log('Cache write error:', err.message);
    }

    res.json({ year, era, events, cached: false });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
