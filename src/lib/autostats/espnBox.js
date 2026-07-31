// Shared engine for sports whose official stats API blocks browser CORS
// (NBA, WNBA, NHL). ESPN's public site API (already used for schedules) does
// allow CORS, so we scan recent days of scoreboards for completed games and
// pull player box scores from those. Heavier than a single bulk file, but
// runs from a static site with no backend.
import { fetchAllJson } from './common.js';

function dateStr(d) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }

export async function fetchEspnRows(sportConfig, days, parseBoxscore) {
  const now = new Date();
  const dateUrls = Array.from({ length: Math.max(1, days) }, (_, i) =>
    `https://site.api.espn.com/apis/site/v2/sports/${sportConfig.espnPath}/scoreboard?dates=${dateStr(new Date(now.getTime() - i * 86400000))}&limit=200`);
  const boards = await fetchAllJson(dateUrls, 6);
  const ids = new Set();
  boards.forEach(b => (b.events || []).forEach(e => { if (e.status?.type?.completed) ids.add(e.id); }));
  const gameIds = [...ids];
  if (!gameIds.length) throw new Error('No completed games found in the selected window');

  const summaryUrls = gameIds.map(id => `https://site.api.espn.com/apis/site/v2/sports/${sportConfig.espnPath}/summary?event=${id}`);
  const summaries = await fetchAllJson(summaryUrls, 6);
  const rows = [];
  summaries.forEach(sum => { try { parseBoxscore(sum, rows); } catch { /* skip malformed box score */ } });
  if (!rows.length) throw new Error('No player rows parsed from box scores');
  return { rows, source: `ESPN box scores (${gameIds.length} games)` };
}
