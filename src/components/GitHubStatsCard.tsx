import type { GitHubStats, ContributionWeek } from '../server/github';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Github } from 'lucide-react';

export function GitHubStatsCard({ stats }: { stats: GitHubStats }) {
  console.log('[GitHubStatsCard] stats:', JSON.stringify(stats, null, 2));
  const joinedDate = new Date(stats.createdAt);
  const rawTotal = stats.languages.reduce((sum, l) => sum + l.count, 0);
  const filtered = stats.languages.filter((l) => l.count / rawTotal > 0.01);
  const totalLangSize = filtered.reduce((sum, l) => sum + l.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base inline-flex items-center gap-2">
          <Github className="h-4 w-4" />
          <a href={`https://github.com/${stats.login}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
            @{stats.login}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(stats.bio || stats.location || stats.company) && (
          <div className="space-y-1 text-sm">
            {stats.bio && <p>{stats.bio}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              {stats.company && <span>{stats.company}</span>}
              {stats.location && <span>{stats.location}</span>}
              {stats.websiteUrl && (
                <a href={stats.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  {stats.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        )}

        {stats.socialAccounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stats.socialAccounts.map((account) => (
              <a
                key={`${account.provider}-${account.displayName}`}
                href={account.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="font-medium">{account.provider}</span>
                <span>{account.displayName}</span>
              </a>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-md border p-3 text-center">
            <div className="text-2xl font-bold">{stats.repoCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Repos</div>
          </div>
          <div className="rounded-md border p-3 text-center">
            <div className="text-2xl font-bold">{stats.followerCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div className="rounded-md border p-3 text-center">
            <div className="text-2xl font-bold">{stats.followingCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
          <div className="rounded-md border p-3 text-center">
            <div className="text-2xl font-bold">{stats.contributionCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Contributions (1y)</div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Joined GitHub on{' '}
          <strong>{joinedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
        </div>

        {filtered.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Top Languages (last 4 years)</div>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {filtered.map((lang) => (
                <div
                  key={lang.name}
                  className="h-full"
                  style={{
                    backgroundColor: lang.color,
                    width: `${(lang.count / totalLangSize) * 100}%`,
                  }}
                  title={`${lang.name}: ${((lang.count / totalLangSize) * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {filtered.map((lang) => (
                <span key={lang.name} className="inline-flex items-center gap-1 text-xs">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: lang.color }}
                  />
                  {lang.name}{' '}
                  <span className="text-muted-foreground">
                    {((lang.count / totalLangSize) * 100).toFixed(1)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* {stats.contributionWeeks.length > 0 && (
          <ContributionGraph weeks={stats.contributionWeeks} />
        )} */}
      </CardContent>
    </Card>
  );
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ContributionGraph({ weeks }: { weeks: ContributionWeek[] }) {
  const cellSize = 11;
  const cellGap = 2;
  const step = cellSize + cellGap;
  const labelHeight = 16;
  const dayLabelWidth = 28;

  const width = dayLabelWidth + weeks.length * step;
  const height = labelHeight + 7 * step;

  // Build month labels — find the first week where a new month starts
  const monthMarkers: { label: string; x: number }[] = [];
  let lastMonth = -1;
  for (let wi = 0; wi < weeks.length; wi++) {
    const firstDay = weeks[wi].contributionDays[0];
    if (!firstDay) continue;
    const month = new Date(firstDay.date).getMonth();
    if (month !== lastMonth) {
      monthMarkers.push({ label: MONTH_LABELS[month], x: dayLabelWidth + wi * step });
      lastMonth = month;
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Contributions</div>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="block">
          {/* Month labels */}
          {monthMarkers.map(({ label, x }) => (
            <text
              key={`${label}-${x}`}
              x={x}
              y={11}
              className="fill-muted-foreground"
              fontSize={10}
            >
              {label}
            </text>
          ))}

          {/* Day labels */}
          {['Mon', 'Wed', 'Fri'].map((day, i) => (
            <text
              key={day}
              x={0}
              y={labelHeight + [1, 3, 5][i] * step + cellSize - 2}
              className="fill-muted-foreground"
              fontSize={10}
            >
              {day}
            </text>
          ))}

          {/* Contribution cells */}
          {weeks.map((week, wi) =>
            week.contributionDays.map((day) => {
              const dayOfWeek = new Date(day.date).getDay();
              return (
                <rect
                  key={day.date}
                  x={dayLabelWidth + wi * step}
                  y={labelHeight + dayOfWeek * step}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  ry={2}
                  fill={day.color}
                  className="stroke-background"
                  strokeWidth={1}
                >
                  <title>{`${day.date}: ${day.contributionCount} contribution${day.contributionCount !== 1 ? 's' : ''}`}</title>
                </rect>
              );
            }),
          )}
        </svg>
      </div>
    </div>
  );
}
