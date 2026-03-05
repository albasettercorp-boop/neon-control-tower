/**
 * Command Center - Загрузка CSV и парсинг лидов
 */

import { useState } from 'react'
import { Upload, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { BackendAPI } from '../lib/api'

export function CommandCenter() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    try {
      const uploadResult = await BackendAPI.uploadCSV(file)
      setResult(uploadResult)
    } catch (error) {
      console.error('Upload error:', error)
      setResult({
        success: false,
        inserted: 0,
        total: 0,
        errors: ['Ошибка загрузки файла'],
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Command Center</h2>
        <p className="text-gray-400">Загрузка и парсинг новых лидов</p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload className="w-12 h-12 text-cyan-400" />

          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              Загрузите CSV файл с лидами
            </h3>
            <p className="text-sm text-gray-400">
              brand_name, inn, revenue_monthly, telegram, whatsapp, email
            </p>
          </div>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
          />

          <label
            htmlFor="csv-upload"
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg cursor-pointer transition-colors"
          >
            Выбрать файл
          </label>

          {file && (
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>{file.name}</span>
            </div>
          )}
        </div>
      </div>

      {file && !result && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Обработка...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Запустить парсинг</span>
            </>
          )}
        </button>
      )}

      {result && (
        <div className={`rounded-lg border p-6 ${
          result.success ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'
        }`}>
          <div className="flex items-start space-x-3">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}

            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">
                {result.success ? 'Парсинг завершён' : 'Ошибка парсинга'}
              </h4>

              <p className="text-gray-300">
                Сохранено: <span className="text-green-400 font-semibold">{result.inserted}</span> из {result.total}
              </p>

              {result.errors?.length > 0 && (
                <div className="mt-3">
                  <p className="text-red-400 font-semibold">Ошибки:</p>
                  <ul className="list-disc list-inside text-gray-400 text-sm">
                    {result.errors.slice(0, 3).map((error: string, idx: number) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
