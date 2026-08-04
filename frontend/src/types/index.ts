export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'admin' | 'superadmin';
  batch_id?: number;
  exam_goal?: string | null;
  target_year?: number | null;
  prep_level?: string | null;
  daily_study_minutes?: number | null;
  onboarding_completed?: boolean;
  referral_code?: string | null;
  referred_by?: number | null;
}

export interface AccessStatus {
  allowed: boolean;
  plan: 'staff' | 'trial' | 'monthly' | 'granted_free' | 'expired';
  status: 'active' | 'trial' | 'expired';
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  ends_at: string | null;
  granted_by: number | null;
  granted_at: string | null;
  amount_per_month: number;
}

export interface StudyPlan {
  exam_goal: string;
  target_year: number;
  prep_level: string;
  daily_study_minutes: number;
  questions_per_day: number;
  avg_accuracy: number | null;
  weak_topic_count: number;
  weekly_plan: {
    day: number;
    day_name: string;
    focus_subject: string;
    topics: string[];
    questions_to_practice: number;
    activity: string;
    notes: string;
  }[];
}

export interface Question {
  id: number;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  correct_option: 'a' | 'b' | 'c' | 'd' | 'e';
  explanation?: string;
  exam_stage: 'prelims' | 'mains';
  tags?: string[];
  set_id?: number;
  set_type?: 'di' | 'rc' | 'puzzle' | 'cloze' | 'group' | 'other';
  set_title?: string;
  set_stimulus?: string;
  set_source?: string;
}

export interface QuestionSet {
  id: number;
  set_type: 'di' | 'rc' | 'puzzle' | 'cloze' | 'group' | 'other';
  title: string;
  stimulus: string;
  source?: string;
  question_count?: number;
}

export interface Test {
  id: number;
  title: string;
  type: 'sectional' | 'full_mock' | 'topic_practice';
  exam_stage: 'prelims' | 'mains';
  duration_minutes: number;
  negative_marking_ratio: number;
  batch_id?: number;
  question_ids: number[];
  questions?: Question[];
}

export interface Attempt {
  id: number;
  attempt_id?: number;
  user_id: number;
  test_id: number;
  started_at: string;
  submitted_at?: string;
  total_score?: number;
  section_scores?: Record<string, any>;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface QuestionResponse {
  id: number;
  attempt_id: number;
  question_id: number;
  selected_option?: 'a' | 'b' | 'c' | 'd' | 'e';
  is_correct?: boolean;
  time_spent_seconds?: number;
  marked_for_review: boolean;
  error_tag?: 'concept_gap' | 'silly_mistake' | 'guessed' | 'time_out';
  question_text?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  option_e?: string;
  correct_option?: 'a' | 'b' | 'c' | 'd' | 'e';
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  subject?: string;
  topic?: string;
  subtopic?: string;
  set_id?: number;
  set_type?: 'di' | 'rc' | 'puzzle' | 'cloze' | 'group' | 'other';
  set_title?: string;
  set_stimulus?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface TestHistory {
  test_id: number;
  title: string;
  type: string;
  exam_stage: string;
  attempts: Attempt[];
  last_attempt: { started_at: string; score: number } | null;
  best_score: number | null;
  best_accuracy: number | null;
}

export interface SubjectTree {
  subject: string;
  topics: TopicNode[];
}

export interface TopicNode {
  topic: string;
  subtopics: SubtopicNode[];
}

export interface SubtopicNode {
  subtopic: string;
  total: number;
  by_difficulty: Record<string, number>;
}

export interface CaArticle {
  id: number;
  title: string;
  description: string;
  category: string;
  source: string;
  source_url: string;
  link: string;
  image_url: string | null;
  pub_date: string | null;
}

export interface CaQuizQuestion {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  correct_option: 'a' | 'b' | 'c' | 'd' | 'e';
  explanation?: string;
  category: string;
  headline?: string;
  link?: string;
  pub_date?: string | null;
}

export interface CaStats {
  articles: number;
  quiz_questions: number;
  by_category: { category: string; count: number }[];
}

export interface RevisionDueTopic {
  subject: string;
  topic: string;
  subtopic: string | null;
  classification: string;
  accuracy_rolling: number | null;
  available: number;
  days_since_last_attempt: number | null;
  scope: { subject: string; topic: string; subtopic: string | null };
}

export interface DailyRevision {
  streak: number;
  today_checked: boolean;
  due_topics: RevisionDueTopic[];
}

export interface PreTestRefresher {
  in_progress: boolean;
  refresher: RevisionDueTopic[];
}
