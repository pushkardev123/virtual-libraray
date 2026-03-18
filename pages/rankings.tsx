import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MeetRanking {
  rank: number;
  fullName: string;
  firstName: string;
  lastName: string;
  email?: string;
  totalDuration: number;
  totalDurationFormatted: string;
  sessionCount: number;
}

interface MeetRankingData {
  date: string;
  rankings: MeetRanking[];
  totalParticipants: number;
  computedAt: string;
}

interface ForestRankingEntry {
  rank: number;
  name: string;
  totalDuration: number;
  totalDurationFormatted: string;
}

interface ForestRankingData {
  date: string;
  rankings: ForestRankingEntry[];
  totalParticipants: number;
  uploadedAt: string;
}

type Tab = 'meet' | 'forest';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateLabel(date: string) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (date === today) return "Today's Ranking";
  if (date === yesterday) return "Yesterday's Ranking";
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function getDateButtonLabel(date: string) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return date;
}

// ─── Podium ──────────────────────────────────────────────────────────────────

function Podium({
  first,
  second,
  third,
  theme,
}: {
  first: { name: string; time: string };
  second: { name: string; time: string };
  third: { name: string; time: string };
  theme: 'meet' | 'forest';
}) {
  const accent = theme === 'forest' ? 'text-green-700' : 'text-purple-700';
  const accent2 = theme === 'forest' ? 'text-green-800' : 'text-purple-800';

  return (
    <div className="mb-6 sm:mb-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-10 text-center">
        🏆 Top 3 Champions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mb-6 sm:mb-8 mt-6 sm:mt-8">
        {/* 2nd Place */}
        <div className="flex flex-col items-center justify-end order-2 md:order-1 mt-8 md:mt-0">
          <div className="bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-2xl w-full border-4 border-slate-400">
            <div className="text-4xl sm:text-6xl mb-2 sm:mb-3">🥈</div>
            <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-slate-700 mb-2">2nd Place</div>
            <div className="font-bold text-base sm:text-xl text-gray-900 mb-2 sm:mb-3 min-h-[2.5rem] sm:min-h-[3rem] flex items-center justify-center px-2">
              {second.name}
            </div>
            <div className={`text-xl sm:text-3xl font-bold bg-white/50 rounded-xl py-2 ${accent}`}>
              {second.time}
            </div>
          </div>
        </div>

        {/* 1st Place */}
        <div className="flex flex-col items-center justify-end order-1 md:order-2">
          <div className="bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 rounded-2xl sm:rounded-3xl p-8 sm:p-10 text-center shadow-2xl w-full border-4 border-yellow-600 transform md:scale-105">
            <div className="text-5xl sm:text-7xl mb-2 sm:mb-3">🥇</div>
            <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-yellow-900 mb-2">1st Place</div>
            <div className="font-bold text-lg sm:text-2xl text-gray-900 mb-3 sm:mb-4 min-h-[2.5rem] sm:min-h-[3rem] flex items-center justify-center px-2">
              {first.name}
            </div>
            <div className={`text-2xl sm:text-4xl font-bold bg-white/50 rounded-xl py-2 sm:py-3 ${accent2}`}>
              {first.time}
            </div>
          </div>
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center justify-end order-3 mt-8 md:mt-0">
          <div className="bg-gradient-to-br from-orange-300 to-orange-400 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-2xl w-full border-4 border-orange-500">
            <div className="text-4xl sm:text-6xl mb-2 sm:mb-3">🥉</div>
            <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-orange-900 mb-2">3rd Place</div>
            <div className="font-bold text-base sm:text-xl text-gray-900 mb-2 sm:mb-3 min-h-[2.5rem] sm:min-h-[3rem] flex items-center justify-center px-2">
              {third.name}
            </div>
            <div className={`text-xl sm:text-3xl font-bold bg-white/50 rounded-xl py-2 ${accent}`}>
              {third.time}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ label = 'Loading rankings...' }: { label?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
      <svg className="animate-spin h-12 w-12 mx-auto text-purple-700" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p className="mt-4 text-gray-600">{label}</p>
    </div>
  );
}

// ─── Google Meet Rankings Panel ───────────────────────────────────────────────

function MeetRankingsPanel() {
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [rankingData, setRankingData] = useState<MeetRankingData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(100);

  useEffect(() => {
    fetchDates();
  }, []);

  const fetchDates = async () => {
    setInitialLoading(true);
    try {
      const res = await fetch('/api/rankings/list?limit=30');
      const result = await res.json();
      if (result.success && result.data.length > 0) {
        setAvailableDates(result.data);
        const most = result.data[0].date;
        setSelectedDate(most);
        await fetchRankings(most, true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchRankings = async (date: string, isInitial = false) => {
    if (!date) return;
    if (!isInitial) setRankingsLoading(true);
    try {
      const res = await fetch(`/api/rankings/daily?date=${date}&limit=500`);
      const result = await res.json();
      if (result.success) setRankingData(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isInitial) setRankingsLoading(false);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchRankings(date);
    setSearchQuery('');
    setDisplayLimit(100);
  };

  const allFiltered = rankingData?.rankings.filter(r =>
    (r.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (r.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  ) || [];

  const filtered = searchQuery ? allFiltered : allFiltered.slice(0, displayLimit);
  const hasMore = !searchQuery && allFiltered.length > displayLimit;

  if (initialLoading) return <Spinner />;

  return (
    <div>
      {/* Date Selector */}
      {availableDates.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Select Date</h2>
          <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
            {availableDates.map((item) => {
              const isSelected = item.date === selectedDate;
              return (
                <button
                  key={item.date}
                  onClick={() => handleDateChange(item.date)}
                  className={`flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all ${
                    isSelected
                      ? 'bg-purple-700 text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  <div className="text-xs sm:text-sm">{getDateButtonLabel(item.date)}</div>
                  <div className="text-[10px] sm:text-xs opacity-75 mt-1">{item.totalParticipants} members</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rankingsLoading && <Spinner label="Loading rankings..." />}

      {/* Podium */}
      {!rankingsLoading && rankingData && rankingData.rankings.length >= 3 && !searchQuery && (
        <Podium
          theme="meet"
          first={{ name: rankingData.rankings[0].fullName, time: rankingData.rankings[0].totalDurationFormatted }}
          second={{ name: rankingData.rankings[1].fullName, time: rankingData.rankings[1].totalDurationFormatted }}
          third={{ name: rankingData.rankings[2].fullName, time: rankingData.rankings[2].totalDurationFormatted }}
        />
      )}

      {/* Table */}
      {!rankingsLoading && filtered.length > 0 && (
        <RankingsTable
          date={selectedDate}
          rows={filtered}
          allCount={allFiltered.length}
          displayLimit={displayLimit}
          searchQuery={searchQuery}
          hasMore={hasMore}
          onSearch={setSearchQuery}
          onLoadMore={() => setDisplayLimit(p => p + 100)}
          nameKey="fullName"
          theme="meet"
        />
      )}

      {/* No data */}
      {!rankingsLoading && availableDates.length === 0 && (
        <NoData message="Rankings will appear here once data is uploaded." />
      )}

      {!rankingsLoading && filtered.length === 0 && rankingData && (
        <EmptySearch query={searchQuery} onClear={() => setSearchQuery('')} />
      )}
    </div>
  );
}

// ─── Forest Rankings Panel ────────────────────────────────────────────────────

function ForestRankingsPanel() {
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [rankingData, setRankingData] = useState<ForestRankingData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(100);

  useEffect(() => {
    fetchDates();
  }, []);

  const fetchDates = async () => {
    setInitialLoading(true);
    try {
      const res = await fetch('/api/forest-rankings/list?limit=30');
      const result = await res.json();
      if (result.success && result.data.length > 0) {
        setAvailableDates(result.data);
        const most = result.data[0].date;
        setSelectedDate(most);
        await fetchRankings(most, true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchRankings = async (date: string, isInitial = false) => {
    if (!date) return;
    if (!isInitial) setRankingsLoading(true);
    try {
      const res = await fetch(`/api/forest-rankings/daily?date=${date}`);
      const result = await res.json();
      if (result.success) setRankingData(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isInitial) setRankingsLoading(false);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchRankings(date);
    setSearchQuery('');
    setDisplayLimit(100);
  };

  const allFiltered = rankingData?.rankings.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filtered = searchQuery ? allFiltered : allFiltered.slice(0, displayLimit);
  const hasMore = !searchQuery && allFiltered.length > displayLimit;

  if (initialLoading) return <Spinner />;

  return (
    <div>
      {/* Date Selector */}
      {availableDates.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Select Date</h2>
          <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
            {availableDates.map((item) => {
              const isSelected = item.date === selectedDate;
              return (
                <button
                  key={item.date}
                  onClick={() => handleDateChange(item.date)}
                  className={`flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all ${
                    isSelected
                      ? 'bg-green-700 text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  <div className="text-xs sm:text-sm">{getDateButtonLabel(item.date)}</div>
                  <div className="text-[10px] sm:text-xs opacity-75 mt-1">{item.totalParticipants} members</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rankingsLoading && <Spinner label="Loading rankings..." />}

      {/* Podium */}
      {!rankingsLoading && rankingData && rankingData.rankings.length >= 3 && !searchQuery && (
        <Podium
          theme="forest"
          first={{ name: rankingData.rankings[0].name, time: rankingData.rankings[0].totalDurationFormatted }}
          second={{ name: rankingData.rankings[1].name, time: rankingData.rankings[1].totalDurationFormatted }}
          third={{ name: rankingData.rankings[2].name, time: rankingData.rankings[2].totalDurationFormatted }}
        />
      )}

      {/* Table */}
      {!rankingsLoading && filtered.length > 0 && (
        <RankingsTable
          date={selectedDate}
          rows={filtered}
          allCount={allFiltered.length}
          displayLimit={displayLimit}
          searchQuery={searchQuery}
          hasMore={hasMore}
          onSearch={setSearchQuery}
          onLoadMore={() => setDisplayLimit(p => p + 100)}
          nameKey="name"
          theme="forest"
        />
      )}

      {/* No data */}
      {!rankingsLoading && availableDates.length === 0 && (
        <NoData message="Forest rankings will appear here once data is uploaded by admin." />
      )}

      {!rankingsLoading && filtered.length === 0 && rankingData && (
        <EmptySearch query={searchQuery} onClear={() => setSearchQuery('')} />
      )}
    </div>
  );
}

// ─── Shared Table Component ───────────────────────────────────────────────────

function RankingsTable({
  date,
  rows,
  allCount,
  displayLimit,
  searchQuery,
  hasMore,
  onSearch,
  onLoadMore,
  nameKey,
  theme,
}: {
  date: string;
  rows: any[];
  allCount: number;
  displayLimit: number;
  searchQuery: string;
  hasMore: boolean;
  onSearch: (q: string) => void;
  onLoadMore: () => void;
  nameKey: string;
  theme: 'meet' | 'forest';
}) {
  const accentBg = theme === 'forest' ? 'bg-green-700' : 'bg-purple-700';
  const accentHoverBg = theme === 'forest' ? 'hover:bg-green-800' : 'hover:bg-purple-800';
  const accentText = theme === 'forest' ? 'text-green-700' : 'text-purple-700';
  const rowHover = theme === 'forest' ? 'hover:bg-green-50' : 'hover:bg-purple-50';
  const theadBg = theme === 'forest' ? 'bg-green-50' : 'bg-purple-50';
  const clockColor = theme === 'forest' ? 'text-green-600' : 'text-purple-600';

  return (
    <>
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900">
                {getDateLabel(date)}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {searchQuery
                  ? `Showing ${rows.length} result${rows.length !== 1 ? 's' : ''}`
                  : hasMore
                    ? `Showing ${rows.length} of ${allCount} members`
                    : `Showing all ${rows.length} member${rows.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 sm:gap-3 bg-gray-50 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 flex-1 md:max-w-md">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-xs sm:text-sm"
              />
              {searchQuery && (
                <button onClick={() => onSearch('')} className="text-gray-400 hover:text-gray-600 text-[10px] sm:text-xs font-medium">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden">
          {rows.map((r: any) => (
            <div key={r.rank} className={`p-4 border-b border-gray-200 ${r.rank <= 3 && !searchQuery ? 'bg-yellow-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`text-2xl font-bold flex-shrink-0 ${r.rank === 1 ? 'text-yellow-600' : r.rank === 2 ? 'text-gray-500' : r.rank === 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                    {r.rank <= 3 && !searchQuery ? (r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉') : `#${r.rank}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base text-gray-900 truncate">{r[nameKey]}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <svg className={`w-4 h-4 ${clockColor} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`text-sm font-semibold ${accentText}`}>{r.totalDurationFormatted}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className={theadBg}>
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Rank</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Study Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r: any) => (
                <tr key={r.rank} className={`${rowHover} transition-colors ${r.rank <= 3 && !searchQuery ? 'bg-yellow-50' : ''}`}>
                  <td className="px-6 py-4">
                    <span className={`text-lg font-bold ${r.rank === 1 ? 'text-yellow-600' : r.rank === 2 ? 'text-gray-500' : r.rank === 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                      {r.rank <= 3 && !searchQuery ? (r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉') : `#${r.rank}`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-base text-gray-900">{r[nameKey]}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <svg className={`w-5 h-5 ${clockColor} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`text-lg font-semibold ${accentText}`}>{r.totalDurationFormatted}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={onLoadMore}
            className={`${accentBg} ${accentHoverBg} text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200`}
          >
            Load More ({allCount - displayLimit} remaining)
          </button>
        </div>
      )}
    </>
  );
}

// ─── Empty / No-data helpers ──────────────────────────────────────────────────

function NoData({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No rankings yet</h3>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

function EmptySearch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No results found</h3>
      <p className="text-gray-600 mb-6">{query ? `No members found matching "${query}"` : 'No rankings available'}</p>
      {query && (
        <button onClick={onClear} className="bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-800 transition-colors">
          Clear Search
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicRankings() {
  const [activeTab, setActiveTab] = useState<Tab>('meet');

  return (
    <Layout title="Virtual Library Rankings" description="Daily study time rankings for Virtual Library members">
      {/* Hero */}
      <section
        className="relative w-full flex items-center justify-center overflow-hidden bg-[#6b21a8] pt-20 sm:pt-24 pb-6 sm:pb-8"
        style={{ backgroundImage: "url('/img/banner-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#6b21a8]/95 via-[#6b21a8]/90 to-[#6b21a8]/80" />
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 text-center text-white">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-3 sm:mb-4">Daily Rankings</h1>
          <p className="text-base sm:text-lg md:text-xl text-slate-200 max-w-3xl mx-auto px-4 mb-6 sm:mb-8">
            Celebrating top performers dedicated to consistent study
          </p>
          <div className="flex items-center justify-center mt-4 sm:mt-6">
            <div className="bg-gradient-to-r from-white/20 via-white/15 to-white/20 backdrop-blur-md px-10 sm:px-14 py-6 sm:py-8 rounded-3xl border border-white/40 shadow-2xl">
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center">Want to join this club? 🚀</p>
              <p className="text-sm sm:text-base md:text-lg text-purple-100 text-center mt-3 font-medium">
                Study together, compete friendly, and rise to the top
              </p>
              <div className="flex justify-center mt-5 sm:mt-6">
                <a
                  href="/neet-pg"
                  className="bg-white hover:bg-gray-100 text-purple-700 font-bold text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  Join Virtual Library
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          {/* Tab Switcher */}
          <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 bg-white rounded-2xl p-2 shadow-md w-full sm:w-auto sm:inline-flex">
            <button
              onClick={() => setActiveTab('meet')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-5 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold transition-all duration-200 text-sm sm:text-base ${
                activeTab === 'meet'
                  ? 'bg-purple-700 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
              <span>Google Meet</span>
            </button>

            <button
              onClick={() => setActiveTab('forest')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-5 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold transition-all duration-200 text-sm sm:text-base ${
                activeTab === 'forest'
                  ? 'bg-green-700 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              <span className="text-base sm:text-lg">🌲</span>
              <span>Forest</span>
            </button>
          </div>

          {/* Panel */}
          {activeTab === 'meet' ? <MeetRankingsPanel /> : <ForestRankingsPanel />}

        </div>
      </div>
    </Layout>
  );
}
