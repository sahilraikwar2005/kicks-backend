import { aiConfig, aiModelDefaults } from '../config/ai.js';

const draftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'shortDescription', 'description', 'category', 'gender', 'color', 'style', 'tags', 'seoTitle', 'seoDescription', 'slug', 'altText'],
  properties: {
    name: { type: 'string' },
    shortDescription: { type: 'string' },
    description: { type: 'string' },
    category: { type: 'string' },
    gender: { type: 'string' },
    color: { type: 'string' },
    style: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    seoTitle: { type: 'string' },
    seoDescription: { type: 'string' },
    slug: { type: 'string' },
    altText: { type: 'string' },
  },
};

const configurationError = () => {
  const error = new Error('AI provider is not configured');
  error.statusCode = 503;
  return error;
};

async function requestDraft(messages) {
  if (!aiConfig.apiKey) throw configurationError();

  const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aiConfig.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: aiConfig.model,
      temperature: aiModelDefaults.temperature,
      max_tokens: aiModelDefaults.maxTokens,
      response_format: { type: 'json_schema', json_schema: { name: 'kicks_product_draft', strict: true, schema: draftSchema } },
      messages,
    }),
  });

  if (!response.ok) {
    const error = new Error(`AI provider request failed with status ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  const body = await response.json();
  try {
    return JSON.parse(body.choices[0].message.content);
  } catch {
    const error = new Error('AI provider returned invalid draft JSON');
    error.statusCode = 502;
    throw error;
  }
}

export async function generateProductDraft({ imageUrl, prompt = '' }) {
  const content = [
    { type: 'text', text: `Create a sneaker product content draft. ${prompt}` },
  ];
  if (imageUrl) content.push({ type: 'image_url', image_url: { url: imageUrl } });

  return requestDraft([
    { role: 'system', content: 'Generate only descriptive marketing metadata. Never invent price, stock, SKU, technical specifications, or brand/model facts. Return JSON only.' },
    { role: 'user', content },
  ]);
}

export async function regenerateProductField({ field, previousValue, prompt = '', imageUrl }) {
  const draft = await generateProductDraft({ imageUrl, prompt: `${prompt}\nRegenerate only the ${field} field. Existing value: ${previousValue || ''}` });
  return { field, value: draft[field] };
}
