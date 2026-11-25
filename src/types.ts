export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
}

export interface CommunityPost {
  id: string;
  title: string;
  details: string;
  date: string;
}

export type PostCategoryKey = 'specials' | 'events' | 'jobs';

export interface Business {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
  reviews: Review[];
  specials: CommunityPost[];
  events: CommunityPost[];
  jobs: CommunityPost[];
}

export interface HighlightItem extends CommunityPost {
  type: PostCategoryKey;
  bizId: string;
  bizName: string;
}

export type HighlightFilter = 'all' | PostCategoryKey;
export type ProfileTab = 'reviews' | 'updates' | 'owner';

export interface LoveInsight {
  point: string;
  evidence: string;
}

export interface UnhappyInsight {
  point: string;
  impact: string;
}

export interface ActionInsight {
  action: string;
  expectedOutcome: string;
  timeframe: 'Quick Win' | 'This Week' | 'Monthly Goal';
  suggestedPostType?: PostCategoryKey;
  suggestedPostTitle?: string;
  suggestedPostDetails?: string;
}

export interface FeedbackAnalysis {
  summary: string;
  loves: LoveInsight[];
  unhappy: UnhappyInsight[];
  actions: ActionInsight[];
}

export interface AnalysisState {
  signature: string;
  loading: boolean;
  error?: string;
  data: FeedbackAnalysis | null;
}

export interface OwnerDraft {
  type: PostCategoryKey;
  title: string;
  details: string;
  date: string;
}
