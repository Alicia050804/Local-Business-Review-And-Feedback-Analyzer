import { AnalysisState, Business } from '../types';
import heroMarketImg from '../assets/images/neighborhood_market_hero_1795541880853.jpg';
import ackerzProduceImg from '../assets/images/ackerz_produce_traditional_1795541880662.jpg';
import thubelihleeKotaImg from '../assets/images/thubelihlee_kota_chips_1795541880642.jpg';
import kaSibitaneChipsImg from '../assets/images/ka_sibitane_slap_chips_1795541880962.jpg';

export const STORAGE_KEY = 'local_refreshments_directory_v1';
export const ANALYSES_STORAGE_KEY = 'local_refreshments_analyses_v1';

export const HERO_IMAGE_URL = heroMarketImg;

export function isPortableFileMode(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

export const SEED_BUSINESSES: Business[] = [
  {
    id: 'ackerz-fruits-veg',
    name: 'Ackerz Fruits n Veg and traditional food',
    category: 'Fresh Produce & Traditional Meals',
    imageUrl: ackerzProduceImg,
    description:
      'Farm-fresh fruits, crisp vegetables, and hearty, authentic home-cooked traditional meals served daily.',
    reviews: [
      {
        id: 'r1',
        author: 'Nomsa K.',
        rating: 5,
        date: '2026-11-22',
        comment:
          'Their pap, mogodu, and fresh morogo taste just like home! The avocados and tomatoes I bought are super fresh and affordable.',
      },
      {
        id: 'r2',
        author: 'Thabo M.',
        rating: 5,
        date: '2026-11-20',
        comment:
          'Best spot in the neighborhood for both fresh veggies and a warm plate of samp and beans. Staff always greets with a smile.',
      },
      {
        id: 'r3',
        author: 'Lerato P.',
        rating: 4,
        date: '2026-11-18',
        comment:
          'Love the mango and orange packs, really sweet and juicy. Only issue is the traditional meals sell out fast after 1:30 PM.',
      },
      {
        id: 'r4',
        author: 'Sibusiso D.',
        rating: 3,
        date: '2026-11-15',
        comment:
          'Food quality is great and portions are generous, but the lunchtime queue gets quite slow when only one person is dishing up.',
      },
      {
        id: 'r5',
        author: 'Zanele N.',
        rating: 5,
        date: '2026-11-11',
        comment:
          'Clean tables, crisp spinach and cabbage every morning, and unbeatable value on the weekly fruit combo.',
      },
    ],
    specials: [
      {
        id: 'sp1',
        title: 'Fresh Family Veggie & Fruit Combo',
        details: '2kg potatoes, 1kg tomatoes, onions, spinach bunch & 6 sweet oranges — R85',
        date: 'Valid Daily This Week',
      },
      {
        id: 'sp2',
        title: 'Traditional Lunch Plate + Free Mageu',
        details: 'Pap or samp with beef stew/mogodu & chakalaka + cold drink — R65',
        date: 'Mon–Fri, 11:30 – 14:30',
      },
    ],
    events: [
      {
        id: 'ev1',
        title: 'Saturday Fresh Harvest Market Day',
        details:
          'Early morning farm-direct fruit crates, tasting table for homemade ginger beer, and family produce bundles.',
        date: 'Saturday, 07:30 – 13:00',
      },
    ],
    jobs: [
      {
        id: 'jb1',
        title: 'Kitchen & Prep Assistant',
        details:
          'Help wash/pack fresh produce and assist with morning traditional meal prep. Pay: R180/day + lunch. How to Apply: Bring CV or ask for Mam’ Ackerz at the counter before 10:00 AM.',
        date: 'Posted Nov 2026',
      },
    ],
  },
  {
    id: 'thubelihlee',
    name: 'Thubelihlee',
    category: 'Kotas & Chips',
    imageUrl: thubelihleeKotaImg,
    description: 'Loaded, freshly made local kotas and golden crispy chips with signature house sauces.',
    reviews: [
      {
        id: 'r6',
        author: 'Kagiso R.',
        rating: 5,
        date: '2026-11-23',
        comment:
          'The Full House Kota with Russian, cheese, egg, and their tangy mango-chili sauce is undefeated! Chips stay crispy all the way home.',
      },
      {
        id: 'r7',
        author: 'Buhle S.',
        rating: 5,
        date: '2026-11-21',
        comment: 'Generous fillings and super fresh bread. You definitely get your money’s worth here.',
      },
      {
        id: 'r8',
        author: 'Mpho T.',
        rating: 3,
        date: '2026-11-19',
        comment:
          'Tasty kotas and great sauces, though Friday evening orders took almost 35 minutes because there was no WhatsApp pre-order.',
      },
      {
        id: 'r9',
        author: 'Anele G.',
        rating: 4,
        date: '2026-11-14',
        comment:
          'Crispy chips and nice friendly vibe. Sometimes they run out of cheese slices late in the afternoon.',
      },
    ],
    specials: [
      {
        id: 'sp3',
        title: 'Double Trouble Kota & Cold Drink',
        details: '1x Loaded Russian & Cheese Kota + Medium Slap Chips + 330ml Cold Drink — R55',
        date: 'All Week',
      },
      {
        id: 'sp4',
        title: 'Student Chips Basket',
        details: 'Large golden chips with signature house garlic & peri-peri drizzle — R30',
        date: 'Mon–Thu, 13:00 – 16:00',
      },
    ],
    events: [
      {
        id: 'ev2',
        title: 'Friday Sunset Kota & Beats',
        details: 'Local DJ spinning Amapiano outside while you grab hot kotas and cold drinks with friends.',
        date: 'This Friday, 16:00 – 20:00',
      },
    ],
    jobs: [
      {
        id: 'jb2',
        title: 'Counter Cashier & Order Packer',
        details:
          'Friendly afternoon/weekend cashier to take orders and pack takeaways. Pay: R1,400/week. How to Apply: Drop your details at Thubelihlee window or call 072-555-0192.',
        date: 'Urgent Hire',
      },
    ],
  },
  {
    id: 'ka-sibitane',
    name: 'Ka Sibitane',
    category: 'Kotas & Chips',
    imageUrl: kaSibitaneChipsImg,
    description: 'Classic neighborhood spot famous for generous kotas, hot slap chips, and quick, friendly service.',
    reviews: [
      {
        id: 'r10',
        author: 'Dumisani L.',
        rating: 5,
        date: '2026-11-23',
        comment:
          'Ka Sibitane never disappoints! Quick service even when it is busy, and the slap chips with vinegar and spice hit the spot every time.',
      },
      {
        id: 'r11',
        author: 'Palesa M.',
        rating: 4,
        date: '2026-11-20',
        comment:
          'Very friendly crew and huge kotas! Wish they had a shaded bench outside while waiting for big group orders.',
      },
      {
        id: 'r12',
        author: 'Tshepo V.',
        rating: 5,
        date: '2026-11-17',
        comment: 'Best atchar and polony kota in the area. Always piping hot and ready in under 10 minutes.',
      },
      {
        id: 'r13',
        author: 'Karabo N.',
        rating: 3,
        date: '2026-11-12',
        comment:
          'Good food and super nice staff, just wish card machine signal was more reliable so we do not always need cash.',
      },
    ],
    specials: [
      {
        id: 'sp5',
        title: 'Sibitane Classic Kota Deal',
        details: 'Chips, polony, atchar, Vienna, egg & cheese kota — only R42',
        date: 'Daily Special',
      },
    ],
    events: [
      {
        id: 'ev3',
        title: 'Weekend Braai & Community Hangout',
        details: 'Boerewors rolls, slap chips platters, and neighborhood dominoes tournament.',
        date: 'Sunday, 12:00 – 17:00',
      },
    ],
    jobs: [
      {
        id: 'jb3',
        title: 'Bicycle / Scooter Local Delivery Helper',
        details:
          'Deliver hot kotas within 3km radius during lunch & dinner rush. Pay: R150/shift + tips. How to Apply: Speak to Bra Sibitane in person between 09:00 and 11:00.',
        date: 'Open Now',
      },
    ],
  },
];

export interface EmbeddedWorkspacePayload {
  businesses?: Business[];
  analyses?: Record<string, AnalysisState>;
}

export function readEmbeddedWorkspace(): EmbeddedWorkspacePayload | null {
  if (typeof document === 'undefined') return null;
  try {
    const el = document.getElementById('embedded-workspace-data');
    if (!el?.textContent) return null;
    const parsed = JSON.parse(el.textContent);
    if (parsed && typeof parsed === 'object') {
      return parsed as EmbeddedWorkspacePayload;
    }
  } catch (err) {
    console.warn('Unable to read embedded workspace payload:', err);
  }
  return null;
}

function hydrateSeedImages(list: Business[]): Business[] {
  return list.map((biz) => {
    const seedMatch = SEED_BUSINESSES.find((s) => s.id === biz.id);
    const currentUrl = biz.imageUrl;
    const isBrokenRelativePath =
      typeof currentUrl === 'string' && currentUrl.startsWith('/src/assets/images/');
    return {
      ...biz,
      imageUrl: isBrokenRelativePath
        ? seedMatch?.imageUrl
        : currentUrl || seedMatch?.imageUrl,
    };
  });
}

export function loadBusinesses(): Business[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return hydrateSeedImages(parsed as Business[]);
      }
    }
  } catch (err) {
    console.warn('Unable to read saved directory data:', err);
  }

  const embedded = readEmbeddedWorkspace();
  if (embedded?.businesses && Array.isArray(embedded.businesses) && embedded.businesses.length > 0) {
    const hydrated = hydrateSeedImages(embedded.businesses);
    saveBusinesses(hydrated);
    return hydrated;
  }

  const initial = structuredClone(SEED_BUSINESSES);
  saveBusinesses(initial);
  return initial;
}

export function saveBusinesses(businesses: Business[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(businesses));
  } catch (err) {
    console.warn('Unable to persist directory data:', err);
  }
}

export function loadCachedAnalyses(): Record<string, AnalysisState> {
  try {
    const raw = localStorage.getItem(ANALYSES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, AnalysisState>;
      }
    }
  } catch (err) {
    console.warn('Unable to read cached analyses:', err);
  }

  const embedded = readEmbeddedWorkspace();
  if (embedded?.analyses && typeof embedded.analyses === 'object') {
    saveCachedAnalyses(embedded.analyses);
    return embedded.analyses;
  }

  return {};
}

export function saveCachedAnalyses(analyses: Record<string, AnalysisState>): void {
  try {
    const clean: Record<string, AnalysisState> = {};
    for (const [key, value] of Object.entries(analyses)) {
      if (value?.data && !value.loading) {
        clean[key] = value;
      }
    }
    localStorage.setItem(ANALYSES_STORAGE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('Unable to persist cached analyses:', err);
  }
}

export function getAverageRating(biz: Business): number {
  if (!biz.reviews || biz.reviews.length === 0) return 0;
  const total = biz.reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0);
  return total / biz.reviews.length;
}

export function getReviewSignature(biz: Business): string {
  return (biz.reviews || []).map((r) => `${r.id}:${r.rating}:${r.comment}`).join('|');
}
