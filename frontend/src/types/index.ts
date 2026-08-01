export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'admin';
  batch_id?: number;
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
