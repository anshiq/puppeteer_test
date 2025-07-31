"use client"

import { useState } from "react"
import { ExternalLink, Download, Copy, Loader2, Palette, Eye, Code, Target } from "lucide-react"

const ThemeExtractorApp = () => {
  const [url, setUrl] = useState("")
  const [pageTheme, setPageTheme] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  // Theme properties being extracted
  const themeProperties = [
    "background-color", "background", "color", 
    "outline-color", "outline", "border-color", 
    "border", "font-family", "font-size", "font-weight", "font"
  ]

  const extractTheme = async () => {
    if (!url) {
      setError("Please enter a valid URL")
      return
    }
    setLoading(true)
    setError("")
    setPageTheme(null)

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "An unknown error occurred during extraction.")
      }

      const data = await response.json()
      setPageTheme(data)
      setActiveTab("overview")
    } catch (err) {
      setError(`Failed to extract theme: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const generateOutput = () => {
    if (!pageTheme) return ""
    return JSON.stringify(pageTheme, null, 2)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateOutput())
  }

  const downloadOutput = () => {
    const blob = new Blob([generateOutput()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "page-theme.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderThemeSection = (title, themeData, icon) => {
    if (!themeData || Object.keys(themeData).length === 0) return null

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          {icon}
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(themeData).map(([property, value]) => (
            <div key={property} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-mono font-medium text-gray-600">{property}:</span>
              <div className="flex items-center space-x-2">
                {property.includes('color') && value && (
                  <div 
                    className="w-6 h-6 rounded border border-gray-300" 
                    style={{ backgroundColor: value }}
                    title={value}
                  />
                )}
                <span className="text-sm font-mono text-gray-800 max-w-xs truncate" title={value}>
                  {value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderVariables = () => {
    if (!pageTheme?.variables || Object.keys(pageTheme.variables).length === 0) return null

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Code className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">CSS Variables</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(pageTheme.variables).map(([variable, value]) => (
            <div key={variable} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-sm font-mono font-medium text-purple-700">{variable}</span>
              <span className="text-sm font-mono text-gray-800 max-w-xs truncate" title={value}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const tabs = [
    { id: "overview", label: "Theme Overview", icon: <Palette className="w-4 h-4" /> },
    { id: "raw", label: "Raw JSON", icon: <Code className="w-4 h-4" /> }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white mb-2">Website Theme Extractor</h1>
            <p className="text-purple-100">Extract comprehensive theme information from any website using advanced zone-based analysis.</p>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                  />
                  <ExternalLink className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
                  <Target className="w-4 h-4" />
                  <span>Extraction Strategy: Hybrid Zone-Based Approach</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h5 className="text-xs font-semibold text-gray-600 mb-2">Theme Properties:</h5>
                    <div className="flex flex-wrap gap-1">
                      {themeProperties.map((prop) => (
                        <span key={prop} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-mono">
                          {prop}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-gray-600 mb-2">Analysis Zones:</h5>
                    <div className="flex flex-wrap gap-1">
                      {["Primary", "Header", "Content", "Accent", "Secondary"].map((zone) => (
                        <span key={zone} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {zone}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Extracts theme from key page zones, identifies CSS variables, and analyzes color frequency for comprehensive theme detection.
                </p>
              </div>

              <button
                onClick={extractTheme}
                disabled={loading || !url}
                className="w-full bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analyzing Website Theme...</span>
                  </>
                ) : (
                  <>
                    <Palette className="w-5 h-5" />
                    <span>Extract Theme</span>
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
            {pageTheme && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-6 h-6 text-purple-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Extracted Theme</h2>
                    {pageTheme.metadata?.title && (
                      <span className="text-sm text-gray-500">from "{pageTheme.metadata.title}"</span>
                    )}
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
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm">Download</span>
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === tab.id
                            ? "border-purple-500 text-purple-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Metadata */}
                    {pageTheme.metadata && (
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Page Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div><span className="font-medium">Title:</span> {pageTheme.metadata.title}</div>
                          <div><span className="font-medium">URL:</span> <span className="truncate">{pageTheme.metadata.url}</span></div>
                          <div><span className="font-medium">Extracted:</span> {new Date(pageTheme.metadata.extractedAt).toLocaleString()}</div>
                        </div>
                      </div>
                    )}

                    {/* Theme Sections */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {renderThemeSection("Primary Theme", pageTheme.primary, <Palette className="w-5 h-5 text-blue-600" />)}
                      {renderThemeSection("Header Theme", pageTheme.header, <Target className="w-5 h-5 text-green-600" />)}
                      {renderThemeSection("Content Theme", pageTheme.content, <Eye className="w-5 h-5 text-orange-600" />)}
                      {renderThemeSection("Accent Colors", pageTheme.accent, <Palette className="w-5 h-5 text-red-600" />)}
                      {renderThemeSection("Secondary Theme", pageTheme.secondary, <Palette className="w-5 h-5 text-gray-600" />)}
                    </div>

                    {/* CSS Variables */}
                    {renderVariables()}
                  </div>
                )}

                {activeTab === "raw" && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-white text-sm overflow-auto max-h-[600px] whitespace-pre-wrap font-mono">
                      {generateOutput()}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ThemeExtractorApp