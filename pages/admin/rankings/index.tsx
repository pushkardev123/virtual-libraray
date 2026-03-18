import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { withAuth, useLogout } from '@/utils/withAuth';
import { generateRankingsPDF, generateForestRankingsPDF } from '@/utils/pdfGenerator';

type AdminTab = 'meet' | 'forest';

// ─── Google Meet Admin Panel ──────────────────────────────────────────────────

function MeetAdminPanel({ onUpload }: { onUpload: () => void }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statistics, setStatistics] = useState<any>(null);
  const [availableDates, setAvailableDates] = useState<any[]>([]);

  useEffect(() => {
    fetchAvailableDates();
  }, []);

  const fetchAvailableDates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rankings/list?limit=30');
      const result = await res.json();
      if (result.success) setAvailableDates(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRankings = async (date: string) => {
    if (!date) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/rankings/daily?date=${date}`);
      const result = await res.json();
      if (result.success) {
        setRankings(result.data.rankings);
        setStatistics(result.data.statistics);
      } else {
        setError(result.error || 'Failed to fetch rankings');
        setRankings([]);
        setStatistics(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch rankings');
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchRankings(date);
  };

  const handleDelete = async (date: string) => {
    if (!confirm(`Are you sure you want to delete Google Meet rankings for ${date}?`)) return;
    try {
      const res = await fetch(`/api/rankings/delete?date=${date}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        alert('Rankings deleted successfully');
        setRankings([]);
        setStatistics(null);
        setSelectedDate('');
        fetchAvailableDates();
      } else {
        alert(result.error || 'Failed to delete');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const handleDownloadPDF = () => {
    if (!selectedDate || !rankings.length || !statistics) {
      alert('Please select a date with rankings first');
      return;
    }
    try {
      generateRankingsPDF({ date: selectedDate, rankings, statistics });
    } catch (err: any) {
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  return (
    <div>
      {/* Date Selector */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {selectedDate && rankings.length > 0 && (
            <>
              <div className="flex items-end">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-800 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => handleDelete(selectedDate)}
                  className="w-full bg-red-100 text-red-700 px-6 py-3 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                >
                  Delete This Day's Data
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {[
            { label: 'Total Participants', value: statistics.totalParticipants, color: 'text-purple-700' },
            { label: 'Top Duration', value: formatDuration(statistics.topDuration), color: 'text-indigo-700' },
            { label: 'Average Duration', value: formatDuration(statistics.averageDuration), color: 'text-blue-700' },
            { label: 'Median Duration', value: formatDuration(statistics.medianDuration), color: 'text-cyan-700' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-sm text-gray-600 mb-1">{s.label}</div>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

      {loading && <AdminSpinner />}

      {/* Table */}
      {!loading && rankings.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Rankings for {selectedDate}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Rank</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Duration</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rankings.map((r: any, i: number) => (
                  <tr key={r.rank} className={`hover:bg-purple-50 transition-colors ${i < 3 ? 'bg-yellow-50' : ''}`}>
                    <td className="px-6 py-4">
                      <span className={`text-lg font-bold ${r.rank === 1 ? 'text-yellow-600' : r.rank === 2 ? 'text-gray-500' : r.rank === 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                        {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.fullName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{r.email || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-purple-700">{r.totalDurationFormatted}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{r.sessionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Uploads */}
      {availableDates.length > 0 && !selectedDate && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Uploads</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableDates.slice(0, 9).map((item: any) => (
              <button
                key={item.date}
                onClick={() => handleDateChange(item.date)}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
              >
                <div className="text-sm text-gray-600 mb-1">Date</div>
                <div className="text-lg font-bold text-gray-900 mb-2">{item.date}</div>
                <div className="text-sm text-gray-600">{item.totalParticipants} participants</div>
                {item.topRanking && (
                  <div className="text-xs text-purple-700 mt-2">🏆 {item.topRanking.fullName}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && selectedDate && rankings.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No rankings found</h3>
          <p className="text-gray-600 mb-6">No data available for {selectedDate}</p>
          <button onClick={onUpload} className="bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-800 transition-colors">
            Upload Data →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Forest Admin Panel ───────────────────────────────────────────────────────

function ForestAdminPanel({ onUpload }: { onUpload: () => void }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [availableDates, setAvailableDates] = useState<any[]>([]);

  useEffect(() => {
    fetchAvailableDates();
  }, []);

  const fetchAvailableDates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/forest-rankings/list?limit=30');
      const result = await res.json();
      if (result.success) setAvailableDates(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRankings = async (date: string) => {
    if (!date) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/forest-rankings/daily?date=${date}`);
      const result = await res.json();
      if (result.success) {
        setRankings(result.data.rankings);
        setTotalParticipants(result.data.totalParticipants);
      } else {
        setError(result.error || 'Failed to fetch rankings');
        setRankings([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch rankings');
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchRankings(date);
  };

  const handleDelete = async (date: string) => {
    if (!confirm(`Are you sure you want to delete Forest rankings for ${date}?`)) return;
    try {
      const res = await fetch(`/api/forest-rankings/delete?date=${date}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        alert('Forest rankings deleted successfully');
        setRankings([]);
        setSelectedDate('');
        fetchAvailableDates();
      } else {
        alert(result.error || 'Failed to delete');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleDownloadPDF = () => {
    if (!selectedDate || !rankings.length) {
      alert('Please select a date with rankings first');
      return;
    }
    try {
      generateForestRankingsPDF({ date: selectedDate, rankings, totalParticipants });
    } catch (err: any) {
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  return (
    <div>
      {/* Date Selector */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {selectedDate && rankings.length > 0 && (
            <>
              <div className="flex items-end">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => handleDelete(selectedDate)}
                  className="w-full bg-red-100 text-red-700 px-6 py-3 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                >
                  Delete This Day's Data
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {rankings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Participants</div>
            <div className="text-3xl font-bold text-green-700">{totalParticipants}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Top Duration</div>
            <div className="text-3xl font-bold text-emerald-700">{rankings[0]?.totalDurationFormatted || '—'}</div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

      {loading && <AdminSpinner />}

      {/* Table */}
      {!loading && rankings.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Forest Rankings for {selectedDate}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-green-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Rank</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rankings.map((r: any, i: number) => (
                  <tr key={r.rank} className={`hover:bg-green-50 transition-colors ${i < 3 ? 'bg-yellow-50' : ''}`}>
                    <td className="px-6 py-4">
                      <span className={`text-lg font-bold ${r.rank === 1 ? 'text-yellow-600' : r.rank === 2 ? 'text-gray-500' : r.rank === 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                        {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-700">{r.totalDurationFormatted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Uploads */}
      {availableDates.length > 0 && !selectedDate && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Forest Uploads</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableDates.slice(0, 9).map((item: any) => (
              <button
                key={item.date}
                onClick={() => handleDateChange(item.date)}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                <div className="text-sm text-gray-600 mb-1">Date</div>
                <div className="text-lg font-bold text-gray-900 mb-2">{item.date}</div>
                <div className="text-sm text-gray-600">{item.totalParticipants} participants</div>
                {item.topRanking && (
                  <div className="text-xs text-green-700 mt-2">🏆 {item.topRanking.name}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {availableDates.length === 0 && !loading && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-5xl mb-4">🌲</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Forest Rankings Yet</h3>
          <p className="text-gray-600 mb-6">Upload a Forest ranking sheet to get started.</p>
          <button onClick={onUpload} className="bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors">
            Upload Forest Rankings →
          </button>
        </div>
      )}

      {!loading && selectedDate && rankings.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No rankings found</h3>
          <p className="text-gray-600 mb-6">No forest data available for {selectedDate}</p>
          <button onClick={onUpload} className="bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors">
            Upload Data →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function AdminSpinner() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
      <svg className="animate-spin h-12 w-12 mx-auto text-purple-700" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AdminRankings() {
  const router = useRouter();
  const logout = useLogout();
  const [activeTab, setActiveTab] = useState<AdminTab>('meet');

  const goToUpload = (type: AdminTab) => {
    router.push(`/admin/rankings/upload?type=${type}`);
  };

  return (
    <Layout title="Admin - Rankings Dashboard">
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Rankings Dashboard</h1>
              <p className="text-slate-600">View and manage daily Virtual Library rankings</p>
            </div>
            <div className="flex items-center gap-3 mt-4 md:mt-0">
              <button
                onClick={() => goToUpload(activeTab)}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors text-white ${activeTab === 'forest' ? 'bg-green-700 hover:bg-green-800' : 'bg-purple-700 hover:bg-purple-800'}`}
              >
                Upload {activeTab === 'forest' ? 'Forest' : 'Google Meet'} File →
              </button>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="inline-flex gap-2 mb-8 bg-white rounded-2xl p-2 shadow-md">
            <button
              onClick={() => setActiveTab('meet')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'meet' ? 'bg-purple-700 text-white shadow-lg' : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
              Google Meet Rankings
            </button>
            <button
              onClick={() => setActiveTab('forest')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'forest' ? 'bg-green-700 text-white shadow-lg' : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              <span className="text-lg">🌲</span>
              Forest Rankings
            </button>
          </div>

          {/* Panels */}
          {activeTab === 'meet' ? (
            <MeetAdminPanel onUpload={() => goToUpload('meet')} />
          ) : (
            <ForestAdminPanel onUpload={() => goToUpload('forest')} />
          )}

        </div>
      </div>
    </Layout>
  );
}

export default withAuth(AdminRankings);
