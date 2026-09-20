import OpenAI from 'openai';
import crypto from 'crypto';
import { env } from '../config/env.js';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY !== 'mock' && env.OPENAI_API_KEY.startsWith('sk-')) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    return openaiClient;
  }
  return null;
}

function stem(w: string): string {
  if (w.length <= 3) return w;
  return w
    .replace(/(ing|edly|ed|es|s|tion|ly)$/, '');
}

/**
 * Deterministic pseudo-semantic embedding generator for testing and offline development.
 * Maps tokens to reproducible vector components via feature hashing and normalizes to a unit sphere (L2 norm = 1).
 */
export function generateMockEmbedding(text: string, dimensions: number = 1536): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9_\-\s]/g, ' ').trim();
  const rawWords = normalizedText.split(/\s+/).filter(Boolean);

  if (rawWords.length === 0) {
    // Return unit vector along first dimension if empty
    vector[0] = 1.0;
    return vector;
  }

  // Include both raw words and stemmed words
  const words = rawWords.flatMap(w => [w, stem(w)]);

  // Feature hashing: select distinct pseudo-random dimensions for each word
  for (const word of words) {
    const hash = crypto.createHash('sha256').update(word).digest();
    for (let j = 0; j < 16; j++) {
      const idx = (hash.readUInt16BE(j * 2) % dimensions);
      const sign = (hash[j] & 1) === 0 ? 1 : -1;
      vector[idx] += sign * 2.0;
    }
  }

  // Character 3-grams for substring / morphologic overlap
  const cleanStr = normalizedText.replace(/\s+/g, ' ');
  for (let i = 0; i < cleanStr.length - 2; i++) {
    const tri = cleanStr.substring(i, i + 3);
    const hash = crypto.createHash('md5').update(tri).digest();
    const idx = (hash.readUInt16BE(0) % dimensions);
    const sign = (hash[2] & 1) === 0 ? 0.5 : -0.5;
    vector[idx] += sign;
  }

  // Compute L2 norm and normalize
  let sumSquares = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSquares += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    vector[0] = 1.0;
    return vector;
  }

  for (let i = 0; i < dimensions; i++) {
    vector[i] = vector[i] / norm;
  }

  return vector;
}

/**
 * Generate vector embedding for given text using OpenAI text-embedding-3-small or fallback mock.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  if (client) {
    try {
      const response = await client.embeddings.create({
        model: env.EMBEDDING_MODEL,
        input: text.slice(0, 8000), // Protect against token limits
        dimensions: env.EMBEDDING_DIMENSIONS,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.warn('⚠️ OpenAI API call failed, falling back to mock embeddings:', error);
      return generateMockEmbedding(text, env.EMBEDDING_DIMENSIONS);
    }
  }

  return generateMockEmbedding(text, env.EMBEDDING_DIMENSIONS);
}

/**
 * Batch generate vector embeddings.
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();

  if (client && texts.length > 0) {
    try {
      const response = await client.embeddings.create({
        model: env.EMBEDDING_MODEL,
        input: texts.map(t => t.slice(0, 8000)),
        dimensions: env.EMBEDDING_DIMENSIONS,
      });
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.warn('⚠️ OpenAI Batch API call failed, falling back to mock embeddings:', error);
      return texts.map(t => generateMockEmbedding(t, env.EMBEDDING_DIMENSIONS));
    }
  }

  return texts.map(t => generateMockEmbedding(t, env.EMBEDDING_DIMENSIONS));
}

/**
 * Calculate cosine similarity between two equal-length vectors:
 * dot(A, B) / (||A|| * ||B||).
 * If both vectors are unit-normalized (L2 norm = 1), this is simply dot(A, B).
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
