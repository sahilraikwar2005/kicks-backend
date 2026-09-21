import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const MAX_TEXT = 220;
const MAX_DESCRIPTION = 1200;
const MAX_LIST_ITEMS = 10;

const cache = new Map();

const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);

// Identity fields must never carry authenticity/certification claims. An image
// can suggest a likely brand/model but can never prove genuineness.
const BANNED_IDENTITY_CLAIMS = /(100%\s*authentic|genuine|original\s+product|official(ly)?\s+(authorized|licensed|authenticated)|verified\s+authentic)/i;

const VISION_SYSTEM_PROMPT = [
  'You are an assistant that identifies sneakers from a single product photo for the KICKS admin catalog.',
  'Rules:',
  '- Identify ONLY what the image visibly supports. When evidence is weak, return null for brand/model instead of guessing.',
  '- NEVER claim authenticity, genuineness, original-official or authorized status. Identification is advisory, not certification.',
  '- Use confidence high only for clearly visible logos/text/silhouettes; medium for plausible but partial evidence; low otherwise.',
  '- Write ORIGINAL short catalog copy. Never copy retailer text verbatim.',
  '- Keep descriptions factual and observable (colors, style, use). No invented release years, prices, SKUs or sizes.',
  '- Evidence entries must be short observable facts (e.g. "visible swoosh logo on lateral side").',
].join('\n');

const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    brand: { type: ['string', 'null'] },
    model: { type: ['string', 'null'] },
    productType: { type: ['string', 'null'] },
    category: { type: ['string', 'null'] },
    gender: { type: ['string', 'null'] },
    primaryColor: { type: ['string', 'null'] },
    secondaryColors: { type: 'array', items: { type: 'string' } },
    productName: { type: ['string', 'null'] },
    shortDescription: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    suggestedColor: { type: ['string', 'null'] },
    brandConfidence: { type: 'string' },
    modelConfidence: { type: 'string' },
    categoryConfidence: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    reasoningSummary: { type: ['string', 'null'] },
  },
  required: [
    'brand',
    'model',
    'productType',
    'category',
    'gender',
    'primaryColor',
    'secondaryColors',
    'productName',
    'shortDescription',
    'description',
    'tags',
    'suggestedColor',
    'brandConfidence',
    'modelConfidence',
    'categoryConfidence',
    'evidence',
    'reasoningSummary',
  ],
  additionalProperties: false,
};

const SEARCH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    normalizedModel: { type: ['string', 'null'] },
    alternateNames: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: ['string', 'null'] },
          url: { type: ['string', 'null'] },
        },
        required: ['title', 'url'],
        additionalProperties: false,
      },
    },
    corroborated: { type: 'boolean' },
  },
  required: ['normalizedModel', 'alternateNames', 'sources', 'corroborated'],
  additionalProperties: false,
};

// Read live so tests and runtime key rotation behave predictably. dotenv
// populates process.env from .env, so server configuration keeps working.
export function getAiApiKey() {
  return String(process.env.AI_API_KEY || '').trim();
}

export function isAiConfigured() {
  return getAiApiKey().length > 0;
}

// Only images served from the KICKS Cloudinary pipeline may be analyzed.
// This blocks arbitrary-URL / SSRF-style input at the service boundary.
export function isAllowedAnalysisImageUrl(imageUrl) {
  try {
    const parsed = new URL(String(imageUrl || '').trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname.toLowerCase() !== 'res.cloudinary.com') return false;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const cloudName = String(env.cloudinaryCloudName || '').trim();
    if (cloudName) return segments[0] === cloudName;
    return parsed.pathname.includes('/kicks/');
  } catch {
    return false;
  }
}

function toCleanString(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function toCleanList(value, maxItems = MAX_LIST_ITEMS, maxLength = 60) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const items = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const cleaned = entry.trim().replace(/\s+/g, ' ').slice(0, maxLength);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    items.push(cleaned);
    if (items.length >= maxItems) break;
  }
  return items;
}

function toConfidence(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return CONFIDENCE_LEVELS.has(normalized) ? normalized : 'low';
}

function hasBannedClaim(value) {
  return typeof value === 'string' && BANNED_IDENTITY_CLAIMS.test(value);
}

function toSourceList(value) {
  if (!Array.isArray(value)) return [];
  const items = [];
  for (const entry of value) {
    const title = toCleanString(entry?.title, 120);
    const url = toCleanString(entry?.url, 500);
    if (!title || !url) continue;
    let parsed = null;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:') continue;
    items.push({ title, url });
    if (items.length >= 4) break;
  }
  return items;
}

export function slugifyProductName(value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || '';
}

// Strict allowlist sanitizer: AI output is assistive data, never trusted blindly.
export function sanitizeAnalysis(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  let brand = toCleanString(source.brand, 60);
  let model = toCleanString(source.model, 80);
  const productType = toCleanString(source.productType, 40);
  const category = toCleanString(source.category, 40);
  const genderRaw = toCleanString(source.gender, 12);
  const gender = ['MEN', 'WOMEN', 'UNISEX', 'KIDS'].includes(String(genderRaw || '').toUpperCase())
    ? String(genderRaw).toUpperCase()
    : null;
  const primaryColor = toCleanString(source.primaryColor, 40);
  const secondaryColors = toCleanList(source.secondaryColors, 5, 40);
  let productName = toCleanString(source.productName, 120);
  const shortDescription = toCleanString(source.shortDescription, 220);
  const description = toCleanString(source.description, MAX_DESCRIPTION);
  const tags = toCleanList(source.tags, MAX_LIST_ITEMS, 40);
  const suggestedColor = toCleanString(source.suggestedColor, 40);
  const confidence = {
    brand: toConfidence(source.brandConfidence),
    model: toConfidence(source.modelConfidence),
    category: toConfidence(source.categoryConfidence),
  };
  const evidence = toCleanList(source.evidence, 6, 120);
  const reasoningSummary = toCleanString(source.reasoningSummary, 280);

  // Drop any identity value that smuggles an authenticity/certification claim.
  if (hasBannedClaim(brand)) brand = null;
  if (hasBannedClaim(model)) model = null;
  if (hasBannedClaim(productName)) productName = null;
  if (!brand) confidence.brand = 'low';
  if (!model) confidence.model = 'low';

  const slugSource = productName || [brand, model].filter(Boolean).join(' ');
  const slug = slugifyProductName(slugSource);

  const needsReview = !brand
    || !model
    || confidence.brand !== 'high'
    || confidence.model !== 'high'
    || confidence.category !== 'high';

  return {
    brand,
    model,
    productType,
    category,
    gender,
    primaryColor,
    secondaryColors,
    productName,
    shortDescription,
    description,
    tags,
    slug,
    suggestedColor,
    referencePrice: null,
    confidence,
    needsReview,
    reasoningSummary,
    evidence,
    sources: [],
    webVerified: false,
  };
}

function extractOutputText(body) {
  if (typeof body?.output_text === 'string' && body.output_text.trim()) return body.output_text;
  const blocks = Array.isArray(body?.output) ? body.output : [];
  for (const block of blocks) {
    if (block?.type !== 'message' || !Array.isArray(block?.content)) continue;
    for (const part of block.content) {
      if ((part?.type === 'output_text' || part?.type === 'input_text') && typeof part?.text === 'string' && part.text.trim()) {
        return part.text;
      }
    }
  }
  return '';
}

function aiError(status, message) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

async function callResponsesApi({ apiKey, body, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      throw aiError(502, 'AI provider rejected the request. Please try again later.');
    }
    if (response.status === 429) {
      throw aiError(429, 'AI analysis is busy right now. Please try again in a moment.');
    }
    if (!response.ok) {
      throw aiError(502, 'AI analysis failed. Please try again.');
    }
    return payload;
  } catch (error) {
    if (error?.statusCode) throw error;
    if (error?.name === 'AbortError') throw aiError(504, 'AI analysis timed out. Please try again.');
    throw aiError(502, 'AI analysis failed. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeImageWithVision({ apiKey, model, imageUrl, timeoutMs }) {
  const payload = await callResponsesApi({
    apiKey,
    timeoutMs,
    body: {
      model,
      store: false,
      max_output_tokens: 1500,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: VISION_SYSTEM_PROMPT }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Analyze this sneaker product photo and return the structured product analysis.' },
            { type: 'input_image', image_url: imageUrl },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'product_analysis',
          strict: true,
          schema: ANALYSIS_JSON_SCHEMA,
        },
      },
    },
  });
  const text = extractOutputText(payload);
  if (!text) throw aiError(502, 'AI analysis failed. Please try again.');
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw aiError(502, 'AI analysis failed. Please try again.');
  }
  return parsed;
}

// Optional corroboration pass. Any failure degrades gracefully to vision-only;
// search output is evidence, never proof of authenticity.
async function corroborateWithWebSearch({ apiKey, model, analysis, timeoutMs }) {
  const query = [analysis.brand, analysis.model, analysis.primaryColor].filter(Boolean).join(' ');
  const payload = await callResponsesApi({
    apiKey,
    timeoutMs,
    body: {
      model,
      store: false,
      max_output_tokens: 800,
      tools: [{ type: 'web_search' }],
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Corroborate this sneaker identification using web search: "${query}". `
                + 'Return normalized model naming, alternate names, and up to 3 reputable product/brand source links. '
                + 'Do not judge authenticity. Respond with the structured result only.',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'product_corroboration',
          strict: true,
          schema: SEARCH_JSON_SCHEMA,
        },
      },
    },
  });
  const text = extractOutputText(payload);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function cacheKeyFor(imageUrl) {
  return crypto.createHash('sha256').update(String(imageUrl)).digest('hex');
}

function readCache(imageUrl) {
  const entry = cache.get(cacheKeyFor(imageUrl));
  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(cacheKeyFor(imageUrl));
    return null;
  }
  return { ...entry.result, cached: true };
}

function writeCache(imageUrl, result) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(cacheKeyFor(imageUrl), { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function analyzeProductImage({ imageUrl }) {
  const url = String(imageUrl || '').trim();
  if (!isAllowedAnalysisImageUrl(url)) {
    throw aiError(400, 'Only images uploaded through the KICKS media pipeline can be analyzed.');
  }
  const apiKey = getAiApiKey();
  if (!apiKey) {
    throw aiError(503, 'AI product analysis is not configured. Please try again later.');
  }

  const cached = readCache(url);
  if (cached) return cached;

  const model = String(env.aiModel || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  const timeoutMs = Math.max(15000, Number(env.aiTimeoutMs) || 60000);

  const raw = await analyzeImageWithVision({ apiKey, model, imageUrl: url, timeoutMs });
  const analysis = sanitizeAnalysis(raw);

  if (analysis.brand && analysis.model && env.aiEnableWebSearch) {
    try {
      const corroboration = await corroborateWithWebSearch({ apiKey, model, analysis, timeoutMs });
      if (corroboration && typeof corroboration === 'object') {
        const sources = toSourceList(corroboration.sources);
        const alternateNames = toCleanList(corroboration.alternateNames, 4, 80);
        const normalizedModel = toCleanString(corroboration.normalizedModel, 80);
        if (normalizedModel && !hasBannedClaim(normalizedModel)) {
          if (normalizedModel.toLowerCase() !== String(analysis.model).toLowerCase() && !alternateNames.some((name) => name.toLowerCase() === String(analysis.model).toLowerCase())) {
            alternateNames.unshift(analysis.model);
          }
          analysis.model = normalizedModel;
        }
        if (alternateNames.length > 0) analysis.alternateNames = alternateNames.slice(0, 4);
        analysis.sources = sources;
        analysis.webVerified = corroboration.corroborated === true && sources.length > 0;
      }
    } catch {
      analysis.webVerified = false;
    }
  }

  // needsReview stays as computed by the sanitizer (missing identity or anything
  // below high confidence). webVerified is reported separately so the admin can
  // see whether independent corroboration was available.
  writeCache(url, analysis);
  return { ...analysis, cached: false };
}
