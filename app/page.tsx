"use client"

import { useState } from "react"
import { ExternalLink, Download, Copy, Loader2, Filter } from "lucide-react"

const CSSExtractorApp = () => {
  const [url, setUrl] = useState("")
  const [styleTree, setStyleTree] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Properties are now fixed
  const propertiesToExtract = ["background", "backgroundColor"]

  const extractStyles = async () => {
    if (!url) {
      setError("Please enter a valid URL")
      return
    }
    setLoading(true)
    setError("")
    setStyleTree(null)

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }), // Only send URL
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "An unknown error occurred during extraction.")
      }

      const data = await response.json()
      setStyleTree(data)
    } catch (err) {
      setError(`Failed to extract styles: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const generateOutput = () => {
    if (!styleTree) return ""
    return JSON.stringify(styleTree, null, 2) // Prettified JSON
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateOutput())
  }

  const downloadOutput = () => {
    const blob = new Blob([generateOutput()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "style-tree.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white mb-2">CSS Style Extractor</h1>
            <p className="text-blue-100">Extract raw CSS styles from any website.</p>
          </div>

          <div className="p-8">
            {/* Input Section */}
            <div className="mb-8">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Website URL</label>
                <div className="relative">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  />
                  <ExternalLink className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Properties Being Extracted:</h4>
                <div className="flex flex-wrap gap-2">
                  {propertiesToExtract.map((prop) => (
                    <span key={prop} className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full font-mono">
                      {prop}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Extraction starts from the `&lt;html&gt;` tag and includes all elements. No deduplication is applied.
                </p>
              </div>

              <button
                onClick={extractStyles}
                disabled={loading || !url}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Extracting Styles...</span>
                  </>
                ) : (
                  <>
                    <Filter className="w-5 h-5" />
                    <span>Extract Raw Styles</span>
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Results Section */}
            {styleTree && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Raw Style Tree (JSON)</h2>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-sm">Copy JSON</span>
                    </button>
                    <button
                      onClick={downloadOutput}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm">Download JSON</span>
                    </button>
                  </div>
                </div>

                {/* JSON Output */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-white text-sm overflow-auto max-h-[600px] whitespace-pre-wrap font-mono">
                    {generateOutput()}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CSSExtractorApp
