import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ReviewInput {
  author: string;
  rating: number;
  comment: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeTimeframe(val: unknown): 'Quick Win' | 'This Week' | 'Monthly Goal' {
  if (val === 'Quick Win' || val === 'This Week' || val === 'Monthly Goal') {
    return val;
  }
  return 'This Week';
}

function normalizePostType(val: unknown): 'specials' | 'events' | 'jobs' | undefined {
  if (val === 'specials' || val === 'events' || val === 'jobs') {
    return val;
  }
  return undefined;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  let portableBuildPromise: Promise<void> | null = null;
  const portableHtmlPath = path.resolve(__dirname, 'dist-portable', 'local-refreshments.html');

  async function ensurePortableHtmlTemplate(): Promise<string> {
    if (!fs.existsSync(portableHtmlPath)) {
      if (!portableBuildPromise) {
        portableBuildPromise = execFileAsync(
          process.execPath,
          [path.resolve(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.portable.config.ts'],
          { cwd: __dirname }
        )
          .then(() => undefined)
          .finally(() => {
            portableBuildPromise = null;
          });
      }
      await portableBuildPromise;
    }
    return fs.readFileSync(portableHtmlPath, 'utf-8');
  }

  app.post('/api/analyze-feedback', async (req, res) => {
    try {
      const { businessName, category, reviews } = req.body ?? {};

      if (typeof businessName !== 'string' || !businessName.trim()) {
        res.status(400).json({ error: 'Business name is required.' });
        return;
      }

      if (!Array.isArray(reviews) || reviews.length === 0) {
        res.status(400).json({ error: 'At least one customer review is required for analysis.' });
        return;
      }

      const sanitizedReviews: ReviewInput[] = reviews
        .slice(0, 50)
        .filter(
          (r): r is ReviewInput =>
            Boolean(r) &&
            typeof r.comment === 'string' &&
            r.comment.trim().length > 0 &&
            typeof r.rating === 'number'
        )
        .map((r) => ({
          author:
            typeof r.author === 'string' && r.author.trim()
              ? r.author.trim().slice(0, 60)
              : 'Neighbor',
          rating: Math.min(5, Math.max(1, Math.round(r.rating))),
          comment: r.comment.trim().slice(0, 800),
        }));

      if (sanitizedReviews.length === 0) {
        res.status(400).json({ error: 'No valid review comments were provided.' });
        return;
      }

      const ai = getGeminiClient();

      const reviewsText = sanitizedReviews
        .map((r, idx) => `${idx + 1}. [${r.rating}/5] ${r.author}: "${r.comment}"`)
        .join('\n');

      const safeCategory =
        typeof category === 'string' && category.trim()
          ? category.trim().slice(0, 80)
          : 'Local Business';

      const prompt = `Analyze these customer reviews for the local neighborhood business "${businessName
        .trim()
        .slice(0, 120)}" (${safeCategory}).

Reviews:
${reviewsText}

Return a JSON object with:
1. "summary": 1-2 concise sentences summarizing overall customer sentiment about the service and products.
2. "loves": 2 to 4 items describing what customers love most about the service/products. Each item has:
   - "point": short, clear headline (e.g. "Warm, welcoming service")
   - "evidence": specific supporting detail grounded in the reviews (e.g. "Mentioned by multiple regulars who praise smiling staff and fast 10-minute service.")
3. "unhappy": 1 to 3 constructive items describing what customers are unhappy about or where friction occurs (if complaints are mild, capture small watchouts mentioned). Each item has:
   - "point": short, clear headline (e.g. "Slow lunchtime queues")
   - "impact": concise explanation of how this affects customers based on the reviews.
4. "actions": 2 to 3 practical, realistic steps the business owner can take right away to improve their service based directly on those reviews. Each item has:
   - "action": specific owner action step
   - "expectedOutcome": measurable or visible improvement for customers
   - "timeframe": exactly one of "Quick Win", "This Week", or "Monthly Goal"
   - "suggestedPostType": optional, one of "specials", "events", or "jobs" if posting an update on their board helps execute the improvement
   - "suggestedPostTitle": optional short title for that community board post
   - "suggestedPostDetails": optional details for that community board post`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a practical neighborhood small-business advisor. Keep insights specific to the provided reviews, accurate, warm, constructive, and immediately actionable.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              loves: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    point: { type: Type.STRING },
                    evidence: { type: Type.STRING },
                  },
                  required: ['point', 'evidence'],
                },
              },
              unhappy: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    point: { type: Type.STRING },
                    impact: { type: Type.STRING },
                  },
                  required: ['point', 'impact'],
                },
              },
              actions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING },
                    expectedOutcome: { type: Type.STRING },
                    timeframe: { type: Type.STRING },
                    suggestedPostType: { type: Type.STRING },
                    suggestedPostTitle: { type: Type.STRING },
                    suggestedPostDetails: { type: Type.STRING },
                  },
                  required: ['action', 'expectedOutcome', 'timeframe'],
                },
              },
            },
            required: ['summary', 'loves', 'unhappy', 'actions'],
          },
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Received an empty response from Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        summary?: unknown;
        loves?: unknown[];
        unhappy?: unknown[];
        actions?: unknown[];
      };

      const summary =
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : '';

      const loves = Array.isArray(parsed.loves)
        ? parsed.loves
            .map((item) => {
              if (typeof item === 'string' && item.trim()) {
                return { point: item.trim(), evidence: '' };
              }
              if (item && typeof item === 'object') {
                const obj = item as { point?: unknown; evidence?: unknown };
                if (typeof obj.point === 'string' && obj.point.trim()) {
                  return {
                    point: obj.point.trim(),
                    evidence: typeof obj.evidence === 'string' ? obj.evidence.trim() : '',
                  };
                }
              }
              return null;
            })
            .filter((x): x is { point: string; evidence: string } => x !== null)
        : [];

      const unhappy = Array.isArray(parsed.unhappy)
        ? parsed.unhappy
            .map((item) => {
              if (typeof item === 'string' && item.trim()) {
                return { point: item.trim(), impact: '' };
              }
              if (item && typeof item === 'object') {
                const obj = item as { point?: unknown; impact?: unknown };
                if (typeof obj.point === 'string' && obj.point.trim()) {
                  return {
                    point: obj.point.trim(),
                    impact: typeof obj.impact === 'string' ? obj.impact.trim() : '',
                  };
                }
              }
              return null;
            })
            .filter((x): x is { point: string; impact: string } => x !== null)
        : [];

      const actions = Array.isArray(parsed.actions)
        ? parsed.actions
            .map((item) => {
              if (typeof item === 'string' && item.trim()) {
                return {
                  action: item.trim(),
                  expectedOutcome: '',
                  timeframe: 'This Week' as const,
                };
              }
              if (item && typeof item === 'object') {
                const obj = item as {
                  action?: unknown;
                  expectedOutcome?: unknown;
                  timeframe?: unknown;
                  suggestedPostType?: unknown;
                  suggestedPostTitle?: unknown;
                  suggestedPostDetails?: unknown;
                };
                if (typeof obj.action === 'string' && obj.action.trim()) {
                  const postType = normalizePostType(obj.suggestedPostType);
                  const postTitle =
                    typeof obj.suggestedPostTitle === 'string' && obj.suggestedPostTitle.trim()
                      ? obj.suggestedPostTitle.trim()
                      : undefined;
                  const postDetails =
                    typeof obj.suggestedPostDetails === 'string' && obj.suggestedPostDetails.trim()
                      ? obj.suggestedPostDetails.trim()
                      : undefined;

                  return {
                    action: obj.action.trim(),
                    expectedOutcome:
                      typeof obj.expectedOutcome === 'string' ? obj.expectedOutcome.trim() : '',
                    timeframe: normalizeTimeframe(obj.timeframe),
                    ...(postType && postTitle && postDetails
                      ? {
                          suggestedPostType: postType,
                          suggestedPostTitle: postTitle,
                          suggestedPostDetails: postDetails,
                        }
                      : {}),
                  };
                }
              }
              return null;
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
        : [];

      res.json({ summary, loves, unhappy, actions });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected server error';
      if (message === 'MISSING_API_KEY') {
        res.status(503).json({
          error: 'Gemini API key is not configured yet. Add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      if (message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')) {
        res.status(401).json({
          error: 'The configured Gemini API key was rejected. Please verify GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
        res.status(429).json({
          error: 'Gemini API rate limit reached. Please wait a moment and try again.',
        });
        return;
      }

      console.error('Error analyzing feedback:', err);
      res.status(500).json({
        error: 'Unable to complete Gemini feedback analysis right now. Please try again shortly.',
      });
    }
  });

  app.post('/api/export-html', async (req, res) => {
    try {
      const templateHtml = await ensurePortableHtmlTemplate();
      const { businesses, analyses } = req.body ?? {};
      const payload = {
        businesses: Array.isArray(businesses) ? businesses : [],
        analyses: analyses && typeof analyses === 'object' ? analyses : {},
      };
      const safeJson = JSON.stringify(payload).replace(/<\/script/gi, '<\\/script');

      const finalHtml = templateHtml.replace(
        /<script\s+id=["']embedded-workspace-data["'][^>]*>[\s\S]*?<\/script>/i,
        () => `<script id="embedded-workspace-data" type="application/json">${safeJson}</script>`
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="local-refreshments-portable.html"'
      );
      res.send(finalHtml);
    } catch (err) {
      console.error('Error building portable HTML export:', err);
      res.status(500).json({
        error: 'Unable to package portable HTML file right now. Please try again.',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
