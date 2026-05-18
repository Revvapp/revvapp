// Revv Reach — reel rendering service
// All API calls go through this file. To go live:
//   1. Set up Firebase Cloud Functions (Blaze plan)
//   2. Add your Shotstack or Creatomate API key to Cloud Function env vars
//   3. Uncomment the httpsCallable block below and delete the mock

// import { getFunctions, httpsCallable } from 'firebase/functions';

export type ReelTemplate =
  | 'transformation'  // split-reveal: before | after
  | 'slideshow'       // sequential fade: before → after
  | 'showcase'        // REVV branded intro + photos + outro
  | 'highlights';     // quick cuts through all after photos

export type ReelMusic =
  | 'luxury'       // smooth, aspirational
  | 'energetic'    // upbeat, fast
  | 'satisfying'   // calming, ASMR-feel
  | 'hype';        // high energy

export type ReelParams = {
  bookingId: string;
  template: ReelTemplate;
  afterPhotos: string[];
  beforePhotos: string[];
  hook: string;
  caption: string;
  hashtags: string;
  music: ReelMusic;
  detailerName: string;
  service: string;
  vehicleLabel: string;
};

export type ReelResult = {
  status: 'ready' | 'pending' | 'mock';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  renderId: string | null;
};

export async function renderReel(params: ReelParams): Promise<ReelResult> {
  // ─── LIVE (uncomment when API keys are configured) ───────────────────────────
  // const functions = getFunctions();
  // const fn = httpsCallable<ReelParams, ReelResult>(functions, 'renderReel');
  // const result = await fn(params);
  // return result.data;
  // ─────────────────────────────────────────────────────────────────────────────

  // ─── MOCK — simulates the render pipeline ────────────────────────────────────
  await new Promise<void>((resolve) => setTimeout(resolve, 4500));
  return {
    status: 'mock',
    videoUrl: null,
    thumbnailUrl: params.afterPhotos[0] ?? null,
    renderId: `mock-${Date.now()}`,
  };
  // ─────────────────────────────────────────────────────────────────────────────
}

// AI content generation — replace with Claude API call via Firebase Function
export type ContentParams = {
  service: string;
  vehicleLabel: string;
  tone: 'bold' | 'refined' | 'relatable';
};

export type GeneratedContent = {
  hook: string;
  caption: string;
  hashtags: string;
};

export async function generateContent(params: ContentParams): Promise<GeneratedContent> {
  // ─── LIVE (uncomment when Claude API Firebase Function is configured) ─────────
  // const functions = getFunctions();
  // const fn = httpsCallable<ContentParams, GeneratedContent>(functions, 'generateReachContent');
  // const result = await fn(params);
  // return result.data;
  // ─────────────────────────────────────────────────────────────────────────────

  // ─── MOCK — template-based generation ───────────────────────────────────────
  await new Promise<void>((resolve) => setTimeout(resolve, 1200));

  const s = params.service.toLowerCase();
  const v = params.vehicleLabel;

  const hooks: Record<ContentParams['tone'], string> = {
    bold:      `Wait until you see this ${v}… 🔥`,
    refined:   `This is what a proper ${s} looks like.`,
    relatable: `POV: Your car hasn't been detailed in months 😬`,
  };

  const captions: Record<ContentParams['tone'], string> = {
    bold: `No shortcuts. No excuses.\n\n${params.service.toUpperCase()} on a ${v} — this is the REVV standard. Every panel treated like it matters, because it does.\n\n📲 Book your detail → link in bio`,
    refined: `A flawless ${params.service} on a ${v}. The difference is in the details — and the details are everything.\n\nProfessional detailing, protected by REVV. Book via link in bio.`,
    relatable: `This ${v} came in looking like it hadn't seen a wash in years… and left looking brand new.\n\n${params.service} done right. Who's next? 👇\n\nBook via the link in bio.`,
  };

  const hashtagSets: Record<ContentParams['tone'], string> = {
    bold:     '#CarDetailing #REVV #DetailLife #BestDetailer #AutoDetailing #CarCare #DetailShop',
    refined:  '#CarDetailing #REVV #LuxuryDetailing #AutoDetail #ProfessionalDetailing #CarCare',
    relatable:'#CarDetailing #REVV #CarTransformation #BeforeAndAfter #DetailLife #CarLovers #CleanCar',
  };

  return {
    hook:     hooks[params.tone],
    caption:  captions[params.tone],
    hashtags: hashtagSets[params.tone],
  };
  // ─────────────────────────────────────────────────────────────────────────────
}
