/* ============================================
   Leaderboard API
   ============================================ */

/** 提交分數到後端 */
export async function submitScore(
  playerId: string,
  score: number,
  difficulty: string,
  playTimeSec: number,
): Promise<void> {
  try {
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: playerId,
        score,
        difficulty,
        play_time: playTimeSec,
      }),
    });
  } catch (e) {
    console.warn('Failed to submit score:', e);
  }
}

// ── Rank helpers ──────────────────────────────

const RANK_LABELS = ['1st', '2nd', '3rd'];
const RANK_STARS = ['✦', '★', '★', '★', '★', '☆', '☆', '☆', '☆', '☆'];
const RANK_STAR_COLORS = [
  '#FFD700', // 1st — gold
  '#C0C0C0', // 2nd — silver
  '#C0C0C0', // 3rd — silver
  '#CD7F32', // 4th — bronze
  '#CD7F32', // 5th — bronze
  '#90A4AE', // 6th+ — blue-grey
];

function getRankLabel(i: number): string {
  return i < 3 ? RANK_LABELS[i] : `${i + 1}th`;
}

function getRankStar(i: number): string {
  return RANK_STARS[Math.min(i, RANK_STARS.length - 1)];
}

function getRankStarColor(i: number): string {
  return RANK_STAR_COLORS[Math.min(i, RANK_STAR_COLORS.length - 1)];
}

function getRankClass(i: number): string {
  if (i === 0) return 'lb-row rank-1';
  if (i === 1) return 'lb-row rank-2';
  if (i === 2) return 'lb-row rank-3';
  return 'lb-row';
}

// ── Render ────────────────────────────────────

/** 載入排行榜資料並渲染到 DOM */
export async function loadLeaderboard(): Promise<void> {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;

  list.innerHTML = '<div class="lb-row lb-loading">載入中...</div>';

  try {
    const res = await fetch('/api/scores');
    const data: Array<{
      player_id: string;
      score: number;
      difficulty: string;
      play_time: number;
      created_at: string;
    }> = await res.json();

    if (!data.length) {
      list.innerHTML = '<div class="lb-row lb-loading">尚無紀錄</div>';
      return;
    }

    list.innerHTML = data.map((row, i) => {
      const starColor = getRankStarColor(i);
      const star = getRankStar(i);
      const rankLabel = getRankLabel(i);
      const cls = getRankClass(i);
      const mins = Math.floor(row.play_time / 60);
      const secs = row.play_time % 60;
      const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

      return `<div class="${cls}">
        <span class="lb-rank" style="color:${starColor}">${rankLabel}</span>
        <span class="lb-star" style="color:${starColor}">${star}</span>
        <span class="lb-name" style="color:${starColor}">${escapeHtml(row.player_id)}</span>
        <span class="lb-score" style="color:${starColor}">${row.score.toLocaleString()}</span>
        <span class="lb-time">${timeStr}</span>
        <span class="lb-date">${row.created_at}</span>
      </div>`;
    }).join('');
  } catch (_) {
    list.innerHTML = '<div class="lb-row lb-loading" style="color:#ff3131">無法連線伺服器</div>';
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
