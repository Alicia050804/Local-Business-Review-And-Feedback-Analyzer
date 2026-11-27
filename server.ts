import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

interface DemoOwnerReply {
  message: string;
  authorName: string;
  authorRole: 'Owner' | 'Manager' | 'Staff';
  authorUid?: string;
  date: string;
}

interface DemoReview {
  id: string;
  author: string;
  authorUid?: string;
  rating: number;
  date: string;
  comment: string;
  ownerReply?: DemoOwnerReply;
}

interface DemoPost {
  id: string;
  title: string;
  details: string;
  date: string;
}

interface DemoBusiness {
  id: string;
  ownerId?: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
  reviews: DemoReview[];
  specials: DemoPost[];
  events: DemoPost[];
  jobs: DemoPost[];
}

interface DemoTokenPayload {
  email: string;
  displayName: string;
  role: 'Owner' | 'Manager' | 'Staff';
  exp: number;
}

function safeClip(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function normalizeStaffRole(val: unknown): 'Owner' | 'Manager' | 'Staff' {
  if (val === 'Owner' || val === 'Manager' || val === 'Staff') return val;
  return 'Owner';
}

function sanitizeDemoBusinessList(rawList: unknown): DemoBusiness[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .slice(0, 50)
    .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === 'object')
    .map((b) => {
      const sanitizePosts = (arr: unknown): DemoPost[] =>
        Array.isArray(arr)
          ? arr
              .slice(0, 50)
              .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
              .map((p) => ({
                id: safeClip(p.id, 128, `post-${Date.now()}`),
                title: safeClip(p.title, 140, 'Update'),
                details: safeClip(p.details, 1000, 'Details'),
                date: safeClip(p.date, 64, 'This Week'),
              }))
          : [];

      const reviews: DemoReview[] = Array.isArray(b.reviews)
        ? b.reviews
            .slice(0, 200)
            .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
            .map((r) => {
              const rawReply =
                r.ownerReply && typeof r.ownerReply === 'object'
                  ? (r.ownerReply as Record<string, unknown>)
                  : null;
              const ownerReply: DemoOwnerReply | undefined =
                rawReply && typeof rawReply.message === 'string' && rawReply.message.trim()
                  ? {
                      message: safeClip(rawReply.message, 1000),
                      authorName: safeClip(rawReply.authorName, 60, 'Owner'),
                      authorRole: normalizeStaffRole(rawReply.authorRole),
                      ...(typeof rawReply.authorUid === 'string' && rawReply.authorUid
                        ? { authorUid: safeClip(rawReply.authorUid, 128) }
                        : {}),
                      date: safeClip(rawReply.date, 32, new Date().toISOString().slice(0, 10)),
                    }
                  : undefined;

              return {
                id: safeClip(r.id, 128, `rev-${Date.now()}`),
                author: safeClip(r.author, 60, 'Neighbor'),
                ...(typeof r.authorUid === 'string' && r.authorUid
                  ? { authorUid: safeClip(r.authorUid, 128) }
                  : {}),
                rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
                date: safeClip(r.date, 32, new Date().toISOString().slice(0, 10)),
                comment: safeClip(r.comment, 1000, 'Great spot!'),
                ...(ownerReply ? { ownerReply } : {}),
              };
            })
        : [];

      return {
        id: safeClip(b.id, 128, `biz-${Date.now()}`),
        ...(typeof b.ownerId === 'string' && b.ownerId
          ? { ownerId: safeClip(b.ownerId, 128) }
          : {}),
        name: safeClip(b.name, 120, 'Local Business'),
        category: safeClip(b.category, 80, 'Local Spot'),
        description: safeClip(b.description, 800, 'Neighborhood spot'),
        ...(typeof b.imageUrl === 'string' && b.imageUrl
          ? { imageUrl: safeClip(b.imageUrl, 300) }
          : {}),
        reviews,
        specials: sanitizePosts(b.specials),
        events: sanitizePosts(b.events),
        jobs: sanitizePosts(b.jobs),
      };
    });
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

  const demoStaffEmail = (
    process.env.DEMO_STAFF_EMAIL?.trim().toLowerCase() ||
    'staff-demo@localrefreshments.demo'
  );
  const envDemoPasscode = process.env.DEMO_STAFF_PASSCODE?.trim() || '';
  const generatedSandboxCode = envDemoPasscode || crypto.randomBytes(3).toString('hex').toUpperCase();
  const demoSalt = crypto.randomBytes(16).toString('hex');
  const demoPasscodeHash = crypto.scryptSync(generatedSandboxCode, demoSalt, 64);
  const demoTokenSecret =
    process.env.DEMO_SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

  function verifyDemoPasscode(candidate: string): boolean {
    const derived = crypto.scryptSync(candidate.trim(), demoSalt, 64);
    return crypto.timingSafeEqual(derived, demoPasscodeHash);
  }

  function signDemoToken(payload: DemoTokenPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', demoTokenSecret)
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${sig}`;
  }

  function verifyDemoToken(authHeader?: string): DemoTokenPayload | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const rawToken = authHeader.slice(7).trim();
    const parts = rawToken.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', demoTokenSecret)
      .update(encoded)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as DemoTokenPayload;
      if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  let demoBusinesses: DemoBusiness[] | null = null;
  let demoUpdatedAt = 0;

  app.get('/api/demo-staff/sandbox', (_req, res) => {
    res.json({
      enabled: true,
      email: demoStaffEmail,
      ...(envDemoPasscode ? { requiresConfiguredPasscode: true } : { accessCode: generatedSandboxCode }),
      displayName: 'Demo Store Owner',
      role: 'Owner',
    });
  });

  app.post('/api/demo-staff/login', (req, res) => {
    const { email, accessCode } = req.body ?? {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const candidateCode = typeof accessCode === 'string' ? accessCode.trim() : '';

    if (!normalizedEmail || !candidateCode) {
      res.status(400).json({ error: 'Staff email and access code are required.' });
      return;
    }

    if (normalizedEmail !== demoStaffEmail || !verifyDemoPasscode(candidateCode)) {
      res.status(401).json({ error: 'Invalid decoy staff email or access code.' });
      return;
    }

    const payload: DemoTokenPayload = {
      email: demoStaffEmail,
      displayName: 'Demo Store Owner',
      role: 'Owner',
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    const token = signDemoToken(payload);

    res.json({
      token,
      session: {
        token,
        email: payload.email,
        displayName: payload.displayName,
        role: payload.role,
        businessIds: ['*'],
      },
    });
  });

  app.get('/api/demo-directory', (_req, res) => {
    res.json({
      businesses: demoBusinesses,
      updatedAt: demoUpdatedAt,
    });
  });

  app.post('/api/demo-directory/reviews', (req, res) => {
    const { businessId, review, businessesSnapshot } = req.body ?? {};
    const cleanBizId = safeClip(businessId, 128);
    if (!cleanBizId || !review || typeof review !== 'object') {
      res.status(400).json({ error: 'Business ID and feedback details are required.' });
      return;
    }

    if (demoBusinesses === null && Array.isArray(businessesSnapshot)) {
      demoBusinesses = sanitizeDemoBusinessList(businessesSnapshot);
    }

    if (!demoBusinesses) {
      res.status(400).json({ error: 'Directory state is not initialized yet.' });
      return;
    }

    const revObj = review as Record<string, unknown>;
    const comment = safeClip(revObj.comment, 1000);
    const author = safeClip(revObj.author, 60);
    if (!comment || !author) {
      res.status(400).json({ error: 'Name and feedback comment are required.' });
      return;
    }

    const cleanReview: DemoReview = {
      id: safeClip(revObj.id, 128, `rev-${Date.now()}`),
      author,
      rating: Math.min(5, Math.max(1, Math.round(Number(revObj.rating) || 5))),
      date: safeClip(revObj.date, 32, new Date().toISOString().slice(0, 10)),
      comment,
    };

    demoBusinesses = demoBusinesses.map((biz) => {
      if (biz.id !== cleanBizId) return biz;
      const exists = biz.reviews.some((r) => r.id === cleanReview.id);
      if (exists) return biz;
      return { ...biz, reviews: [...biz.reviews, cleanReview] };
    });
    demoUpdatedAt = Date.now();

    res.json({ businesses: demoBusinesses, updatedAt: demoUpdatedAt });
  });

  app.post('/api/demo-directory/replies', (req, res) => {
    const staffSession = verifyDemoToken(req.headers.authorization);
    if (!staffSession) {
      res.status(401).json({ error: 'Please sign into the Staff Portal before sending a reply.' });
      return;
    }

    const { businessId, reviewId, reply, businessesSnapshot } = req.body ?? {};
    const cleanBizId = safeClip(businessId, 128);
    const cleanReviewId = safeClip(reviewId, 128);
    if (!cleanBizId || !cleanReviewId || !reply || typeof reply !== 'object') {
      res.status(400).json({ error: 'Business ID, review ID, and reply details are required.' });
      return;
    }

    if (demoBusinesses === null && Array.isArray(businessesSnapshot)) {
      demoBusinesses = sanitizeDemoBusinessList(businessesSnapshot);
    }

    if (!demoBusinesses) {
      res.status(400).json({ error: 'Directory state is not initialized yet.' });
      return;
    }

    const replyObj = reply as Record<string, unknown>;
    const message = safeClip(replyObj.message, 1000);
    if (!message) {
      res.status(400).json({ error: 'Reply message cannot be empty.' });
      return;
    }

    const cleanReply: DemoOwnerReply = {
      message,
      authorName: safeClip(replyObj.authorName, 60, staffSession.displayName),
      authorRole: normalizeStaffRole(replyObj.authorRole),
      date: safeClip(replyObj.date, 32, new Date().toISOString().slice(0, 10)),
    };

    let matched = false;
    demoBusinesses = demoBusinesses.map((biz) => {
      if (biz.id !== cleanBizId) return biz;
      return {
        ...biz,
        reviews: biz.reviews.map((rev) => {
          if (rev.id !== cleanReviewId) return rev;
          matched = true;
          return { ...rev, ownerReply: cleanReply };
        }),
      };
    });

    if (!matched) {
      res.status(404).json({ error: 'Target customer feedback was not found.' });
      return;
    }

    demoUpdatedAt = Date.now();
    res.json({ businesses: demoBusinesses, updatedAt: demoUpdatedAt });
  });

  app.post('/api/demo-directory/posts', (req, res) => {
    const staffSession = verifyDemoToken(req.headers.authorization);
    if (!staffSession) {
      res.status(401).json({ error: 'Please sign into the Staff Portal before publishing updates.' });
      return;
    }

    const { businessId, type, post, businessesSnapshot } = req.body ?? {};
    const cleanBizId = safeClip(businessId, 128);
    const cleanType = normalizePostType(type);
    if (!cleanBizId || !cleanType || !post || typeof post !== 'object') {
      res.status(400).json({ error: 'Valid business ID, post type, and post fields are required.' });
      return;
    }

    if (demoBusinesses === null && Array.isArray(businessesSnapshot)) {
      demoBusinesses = sanitizeDemoBusinessList(businessesSnapshot);
    }

    if (!demoBusinesses) {
      res.status(400).json({ error: 'Directory state is not initialized yet.' });
      return;
    }

    const postObj = post as Record<string, unknown>;
    const cleanPost: DemoPost = {
      id: safeClip(postObj.id, 128, `post-${Date.now()}`),
      title: safeClip(postObj.title, 140, 'Update'),
      details: safeClip(postObj.details, 1000, 'Details available.'),
      date: safeClip(postObj.date, 64, 'This Week'),
    };

    demoBusinesses = demoBusinesses.map((biz) =>
      biz.id === cleanBizId ? { ...biz, [cleanType]: [cleanPost, ...biz[cleanType]] } : biz
    );
    demoUpdatedAt = Date.now();
    res.json({ businesses: demoBusinesses, updatedAt: demoUpdatedAt });
  });

  app.post('/api/demo-directory/businesses', (req, res) => {
    const { business, businessesSnapshot } = req.body ?? {};
    if (!business || typeof business !== 'object') {
      res.status(400).json({ error: 'Business payload is required.' });
      return;
    }

    if (demoBusinesses === null && Array.isArray(businessesSnapshot)) {
      demoBusinesses = sanitizeDemoBusinessList(businessesSnapshot);
    }

    const [cleanBiz] = sanitizeDemoBusinessList([business]);
    if (!cleanBiz) {
      res.status(400).json({ error: 'Invalid business details.' });
      return;
    }

    const existingList = demoBusinesses ?? [];
    if (!existingList.some((b) => b.id === cleanBiz.id)) {
      demoBusinesses = [cleanBiz, ...existingList];
      demoUpdatedAt = Date.now();
    }
    res.json({ businesses: demoBusinesses, updatedAt: demoUpdatedAt });
  });

  app.post('/api/demo-directory/reset', (req, res) => {
    const staffSession = verifyDemoToken(req.headers.authorization);
    if (!staffSession) {
      res.status(401).json({ error: 'Staff sign-in required to reset shared demo data.' });
      return;
    }
    demoBusinesses = null;
    demoUpdatedAt = Date.now();
    res.json({ ok: true, updatedAt: demoUpdatedAt });
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
