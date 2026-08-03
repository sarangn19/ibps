import type { QuestionResponse, StudyPlan, Test, TestHistory } from '../types';

export interface Insight {
  id: string;
  icon: 'sparkles' | 'target' | 'clock' | 'alert' | 'trending' | 'award' | 'brain';
  title: string;
  message: string;
  tone: 'positive' | 'warning' | 'info';
}

interface GroupStat {
  correct: number;
  attempted: number;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function group(rows: QuestionResponse[], key: (r: QuestionResponse) => string | undefined) {
  const map = new Map<string, GroupStat>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const g = map.get(k) || { correct: 0, attempted: 0 };
    if (r.selected_option) g.attempted += 1;
    if (r.is_correct) g.correct += 1;
    map.set(k, g);
  }
  return map;
}

const accuracyOf = (g: GroupStat) => (g.attempted ? g.correct / g.attempted : 0);

export function generateTestInsights(
  responses: QuestionResponse[],
  score: { total: number; correct: number; attempted: number; accuracy: number },
  test: Test,
  previousBest: number | null
): Insight[] {
  const insights: Insight[] = [];
  const total = responses.length;

  if (total === 0) {
    insights.push({
      id: 'empty',
      icon: 'sparkles',
      title: 'No data yet',
      message: 'Finish a test to unlock your AI insights.',
      tone: 'info',
    });
    return insights;
  }

  const acc = score.attempted ? score.correct / score.attempted : 0;

  if (acc >= 0.75) {
    insights.push({
      id: 'overall',
      icon: 'award',
      title: 'Strong performance',
      message: `You scored ${pct(acc)} accuracy on this test. Consistent at this level puts you well ahead in this section.`,
      tone: 'positive',
    });
  } else if (acc >= 0.5) {
    insights.push({
      id: 'overall',
      icon: 'trending',
      title: 'Solid effort',
      message: `Your accuracy was ${pct(acc)}. Tighten up the areas below to push toward 75%+.`,
      tone: 'info',
    });
  } else {
    insights.push({
      id: 'overall',
      icon: 'alert',
      title: 'Room to grow',
      message: `Accuracy of ${pct(acc)} suggests the concepts are not settled yet. Review the explanations below and re-practice these topics.`,
      tone: 'warning',
    });
  }

  const bySubject = group(responses, r => r.subject);
  const subjectStats = [...bySubject.entries()].filter(([, g]) => g.attempted >= 3);
  if (subjectStats.length) {
    const best = subjectStats.reduce((a, b) => (accuracyOf(a[1]) > accuracyOf(b[1]) ? a : b));
    if (accuracyOf(best[1]) >= 0.6) {
      insights.push({
        id: 'best',
        icon: 'award',
        title: `Strongest: ${best[0]}`,
        message: `${best[1].correct}/${best[1].attempted} correct (${pct(accuracyOf(best[1]))}) — this subject is a reliable score bank.`,
        tone: 'positive',
      });
    }
    const weak = subjectStats.reduce((a, b) => (accuracyOf(a[1]) < accuracyOf(b[1]) ? a : b));
    if (accuracyOf(weak[1]) < 0.6) {
      insights.push({
        id: 'weak',
        icon: 'target',
        title: `Focus on: ${weak[0]}`,
        message: `${weak[1].correct}/${weak[1].attempted} correct (${pct(accuracyOf(weak[1]))}). Spend your next practice session here before moving on.`,
        tone: 'warning',
      });
    }
  }

  const byDiff = group(responses, r => r.difficulty);
  const easy = byDiff.get('easy');
  const hard = byDiff.get('hard');
  if (easy && easy.attempted >= 3 && accuracyOf(easy) < 0.6) {
    insights.push({
      id: 'basics',
      icon: 'alert',
      title: 'Basics need attention',
      message: `You got only ${pct(accuracyOf(easy))} of easy questions right. Revisit the fundamentals of these topics first.`,
      tone: 'warning',
    });
  }
  if (easy && hard && hard.attempted >= 3 && accuracyOf(easy) >= 0.7 && accuracyOf(hard) < 0.5) {
    insights.push({
      id: 'hard',
      icon: 'brain',
      title: 'The hard questions get you',
      message: `Easy accuracy is strong (${pct(accuracyOf(easy))}) but hard questions drop to ${pct(accuracyOf(hard))}. Practicing tougher problems will stretch your score.`,
      tone: 'info',
    });
  }

  const expectedSeconds =
    Array.isArray(test.question_ids) && test.question_ids.length
      ? (test.duration_minutes * 60) / test.question_ids.length
      : 90;
  const timed = responses.filter(r => r.time_spent_seconds);
  if (timed.length >= 5) {
    const avg = timed.reduce((s, r) => s + (r.time_spent_seconds || 0), 0) / timed.length;
    if (avg > expectedSeconds * 1.3) {
      insights.push({
        id: 'time',
        icon: 'clock',
        title: 'Pacing is costing you',
        message: `You averaged ${(Math.round((avg / 60) * 10) / 10).toFixed(1)}m per question (target ~${Math.round(expectedSeconds)}s). Learn to flag questions and move on.`,
        tone: 'warning',
      });
    } else {
      const correctTimed = timed.filter(r => r.is_correct);
      const avgCorrect = correctTimed.reduce((s, r) => s + (r.time_spent_seconds || 0), 0) / Math.max(1, correctTimed.length);
      const slowWrong = timed.filter(r => !r.is_correct && r.time_spent_seconds! > avgCorrect);
      if (slowWrong.length >= 3) {
        insights.push({
          id: 'slowwrong',
          icon: 'clock',
          title: 'Time on wrong answers',
          message: `${slowWrong.length} of your misses took longer than your average correct answer. A quick re-read before answering helps avoid these.`,
          tone: 'info',
        });
      }
    }
  }

  const skipped = responses.filter(r => !r.selected_option).length;
  if (skipped / total > 0.25) {
    insights.push({
      id: 'skipped',
      icon: 'alert',
      title: 'Unattempted questions',
      message: `You left ${skipped} of ${total} questions blank. Even a reasoned guess can score on a mock — attempt them.`,
      tone: 'info',
    });
  }

  const setQuestions = responses.filter(r => r.set_id);
  if (setQuestions.length >= 3) {
    const setAttempted = setQuestions.filter(r => r.selected_option).length;
    const setCorrect = setQuestions.filter(r => r.is_correct).length;
    if (setAttempted >= 3 && setCorrect / setAttempted < 0.5) {
      const setType = (setQuestions[0].set_type || 'passage').toUpperCase();
      insights.push({
        id: 'set',
        icon: 'target',
        title: `${setType} sets are a weak spot`,
        message: `You got ${setCorrect}/${setAttempted} on passage/DI-style questions. Practice reading the shared data before the questions.`,
        tone: 'warning',
      });
    }
  }

  const wrongCount = responses.filter(r => r.selected_option && !r.is_correct).length;
  const tagged = responses.filter(r => r.error_tag).length;
  if (wrongCount > 0 && tagged === 0) {
    insights.push({
      id: 'tag',
      icon: 'sparkles',
      title: 'Make your mistakes count',
      message: 'Tag why you missed questions below — your insights get sharper the more you tag.',
      tone: 'info',
    });
  }

  if (previousBest !== null && score.total > previousBest) {
    insights.push({
      id: 'improve',
      icon: 'trending',
      title: 'New personal best',
      message: `You beat your previous best on this test (${previousBest.toFixed(1)} → ${score.total.toFixed(1)}).`,
      tone: 'positive',
    });
  } else if (previousBest !== null && score.total < previousBest * 0.8) {
    insights.push({
      id: 'decline',
      icon: 'alert',
      title: 'Below your previous best',
      message: `This attempt scored ${score.total.toFixed(1)} vs your best of ${previousBest.toFixed(1)}. Review what changed before retaking.`,
      tone: 'warning',
    });
  }

  return insights;
}

export function generateDashboardInsights(
  history: Record<number, TestHistory>,
  recommendations: { subject: string; topic: string; subtopic?: string; classification: string; available: number }[],
  studyPlan: StudyPlan | null
): Insight[] {
  const insights: Insight[] = [];
  const completed: { score: number; date: string }[] = [];
  for (const h of Object.values(history)) {
    for (const a of h.attempts) {
      if (a.status === 'completed' && a.total_score != null) {
        completed.push({ score: a.total_score, date: a.started_at });
      }
    }
  }
  completed.sort((a, b) => a.date.localeCompare(b.date));

  if (completed.length === 0) {
    insights.push({
      id: 'start',
      icon: 'sparkles',
      title: 'Your insights start with a test',
      message: 'Attempt your first mock or practice session and your personalized analysis will appear here.',
      tone: 'info',
    });
    return insights;
  }

  const totalTests = Object.keys(history).length;
  insights.push({
    id: 'progress',
    icon: 'trending',
    title: `You've completed ${completed.length} test${completed.length === 1 ? '' : 's'}`,
    message: totalTests
      ? `Across ${totalTests} available test${totalTests === 1 ? '' : 's'}. Every completed attempt refines these insights.`
      : 'Keep going — consistency beats cramming.',
    tone: totalTests && completed.length / totalTests >= 0.5 ? 'positive' : 'info',
  });

  if (studyPlan && studyPlan.avg_accuracy != null) {
    const a = studyPlan.avg_accuracy / 100;
    if (a >= 0.7) {
      insights.push({
        id: 'acc',
        icon: 'award',
        title: 'Healthy accuracy',
        message: `Your overall accuracy is ${pct(a)}. You're exam-ready on this front — protect it on the actual day.`,
        tone: 'positive',
      });
    } else if (a >= 0.5) {
      insights.push({
        id: 'acc',
        icon: 'trending',
        title: 'Good baseline accuracy',
        message: `At ${pct(a)} overall, consistent topic practice should push you past the 70% mark.`,
        tone: 'info',
      });
    } else {
      insights.push({
        id: 'acc',
        icon: 'alert',
        title: 'Accuracy is the bottleneck',
        message: `You're averaging ${pct(a)}. Slow down and review explanations before adding more volume.`,
        tone: 'warning',
      });
    }
  }

  const weakList = recommendations.filter(r => r.classification !== 'not_attempted');
  if (weakList.length > 0) {
    const rec = weakList[0];
    insights.push({
      id: 'weak',
      icon: 'target',
      title: `${weakList.length} area${weakList.length === 1 ? '' : 's'} need practice`,
      message: `Start with ${rec.subject} — ${rec.topic}${rec.subtopic ? ` (${rec.subtopic})` : ''}. ${rec.available} questions are ready now.`,
      tone: 'warning',
    });
  }

  if (completed.length >= 4) {
    const recentAvg = completed.slice(-2).reduce((s, a) => s + a.score, 0) / 2;
    const earlyAvg = completed.slice(0, 2).reduce((s, a) => s + a.score, 0) / 2;
    const diff = recentAvg - earlyAvg;
    if (diff > 0.5) {
      insights.push({
        id: 'trend',
        icon: 'trending',
        title: 'Scores trending up',
        message: `Your last two attempts averaged ${recentAvg.toFixed(1)} vs ${earlyAvg.toFixed(1)} at the start — the momentum is real.`,
        tone: 'positive',
      });
    } else if (diff < -0.5) {
      insights.push({
        id: 'trend',
        icon: 'alert',
        title: 'Scores trending down',
        message: `Recent attempts averaged ${recentAvg.toFixed(1)} vs ${earlyAvg.toFixed(1)} earlier. Reset with a focused topic session.`,
        tone: 'warning',
      });
    }
  }

  return insights;
}
