import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { withAuth, useLogout } from '@/utils/withAuth';

type UploadType = 'meet' | 'forest';

function AdminRankingUpload() {
  const router = useRouter();
  const logout = useLogout();

  const [uploadType, setUploadType] = useState<UploadType>('meet');
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);

  // Pre-select type from query param if provided by admin dashboard
  useEffect(() => {
    if (router.query.type === 'forest') setUploadType('forest');
    else if (router.query.type === 'meet') setUploadType('meet');
  }, [router.query.type]);

  const acceptedFormats = uploadType === 'forest'
    ? '.xlsx,.xls'
    : '.pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

  const handleTypeChange = (type: UploadType) => {
    setUploadType(type);
    setFile(null);
    setError('');
    setSuccess('');
    setPreviewData(null);
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const name = selectedFile.name.toLowerCase();

      if (uploadType === 'forest') {
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
          setError('Please select an XLSX file for Forest Rankings');
          return;
        }
      } else {
        if (!name.endsWith('.pdf') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
          setError('Please select a PDF or XLSX file');
          return;
        }
      }

      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !date) {
      setError('Please select both a file and date');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', date);

    const endpoint = uploadType === 'forest'
      ? '/api/forest-rankings/upload'
      : '/api/rankings/upload';

    try {
      const response = await fetch(endpoint, { method: 'POST', body: formData });
      const result = await response.json();

      if (result.success) {
        const count = result.data.totalParticipants;
        setSuccess(`Successfully uploaded! Total participants: ${count}`);
        setPreviewData(result.data);
        setFile(null);
        setDate('');
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const isForest = uploadType === 'forest';
  const accentRing = isForest ? 'focus:ring-green-500' : 'focus:ring-purple-500';
  const accentBtn = isForest
    ? 'bg-green-700 hover:bg-green-800 disabled:bg-gray-300'
    : 'bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300';
  const accentTabActive = isForest ? 'bg-green-700 text-white shadow' : 'bg-purple-700 text-white shadow';

  return (
    <Layout title="Admin - Upload Rankings">
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-6">

          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex-1" />
              <button
                type="button"
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Upload Ranking Data</h1>
              <p className="text-slate-600">Choose a ranking type and upload the corresponding file</p>
            </div>
          </div>

          {/* Type Selector */}
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Ranking Type</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('meet')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all text-sm sm:text-base ${
                  uploadType === 'meet' ? 'bg-purple-700 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
                Google Meet Rankings
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('forest')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all text-sm sm:text-base ${
                  uploadType === 'forest' ? 'bg-green-700 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
                }`}
              >
                <span className="text-lg">🌲</span>
                Forest Rankings
              </button>
            </div>

            {/* Info banner */}
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${isForest ? 'bg-green-50 text-green-800' : 'bg-purple-50 text-purple-800'}`}>
              {isForest ? (
                <>
                  <strong>Forest Rankings:</strong> Upload an XLSX sheet with columns{' '}
                  <code className="bg-green-100 px-1 rounded">Rank</code>,{' '}
                  <code className="bg-green-100 px-1 rounded">Name</code>,{' '}
                  <code className="bg-green-100 px-1 rounded">Time</code>{' '}
                  (e.g. "15h 30m"). The sheet rankings are used as-is.
                </>
              ) : (
                <>
                  <strong>Google Meet Rankings:</strong> Upload a Google Meet attendance report (PDF or XLSX).
                  Rankings are automatically computed from participant durations.
                </>
              )}
            </div>
          </div>

          {/* Upload Form */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <form onSubmit={handleUpload} className="space-y-6">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 ${accentRing} focus:border-transparent`}
                  required
                />
              </div>

              {/* File */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File {isForest ? '(XLSX)' : '(PDF or XLSX)'}
                </label>
                <input
                  id="fileInput"
                  type="file"
                  accept={acceptedFormats}
                  onChange={handleFileChange}
                  className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 ${accentRing} focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold ${
                    isForest ? 'file:bg-green-50 file:text-green-700 hover:file:bg-green-100' : 'file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100'
                  }`}
                  required
                />
                {file && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">{success}</div>
              )}

              <button
                type="submit"
                disabled={loading || !file || !date}
                className={`w-full ${accentBtn} text-white py-3 px-6 rounded-lg font-semibold disabled:cursor-not-allowed transition-colors`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  'Upload & Process'
                )}
              </button>
            </form>
          </div>

          {/* Preview */}
          {previewData && (
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Top 20 Preview</h2>

              {/* Mobile card view */}
              <div className="block sm:hidden space-y-2 mb-4">
                {(previewData.preview || previewData.rankings || []).map((r: any) => (
                  <div key={r.rank} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-base font-bold flex-shrink-0 ${
                        r.rank === 1 ? 'text-yellow-600' : r.rank === 2 ? 'text-gray-500' : r.rank === 3 ? 'text-orange-600' : 'text-gray-700'
                      }`}>
                        {r.rank <= 3 ? (r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉') : `#${r.rank}`}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">{r.name || r.fullName}</span>
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ml-2 ${isForest ? 'text-green-700' : 'text-purple-700'}`}>
                      {r.totalDurationFormatted}
                    </span>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className={isForest ? 'bg-green-50' : 'bg-purple-50'}>
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Duration</th>
                      {!isForest && (
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sessions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(previewData.preview || previewData.rankings || []).map((r: any) => (
                      <tr key={r.rank} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">#{r.rank}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{r.name || r.fullName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.totalDurationFormatted}</td>
                        {!isForest && (
                          <td className="px-4 py-3 text-sm text-gray-600">{r.sessionCount}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => router.push('/admin/rankings')}
                  className={`w-full ${accentBtn} text-white py-3 px-6 rounded-lg font-semibold transition-colors`}
                >
                  View Full Rankings →
                </button>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/admin/rankings')}
              className="text-purple-700 hover:text-purple-800 font-medium"
            >
              ← Back to Rankings
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(AdminRankingUpload);
