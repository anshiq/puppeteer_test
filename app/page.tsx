"use client"

import { useState, useRef } from "react"
import { ChevronDown, ChevronRight, ExternalLink, Download, Copy, Loader2 } from "lucide-react"

const CSSExtractorApp = () => {
  const [url, setUrl] = useState("")
  const [selectedProps, setSelectedProps] = useState(["color", "background", "fontSize"])
  // Changed the default state to a selection of custom tags
  const [selectedTags, setSelectedTags] = useState(["div", "span", "p", "h1", "h2", "a", "button", "img"])
  const [customTags, setCustomTags] = useState("")
  const [styleTree, setStyleTree] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const previousTagsRef = useRef([])

  // Available CSS properties
  const availableProperties = [
    "color",
    "background",
    "backgroundColor",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "padding",
    "margin",
    "border",
    "borderRadius",
    "width",
    "height",
    "display",
    "position",
    "top",
    "left",
    "right",
    "bottom",
    "zIndex",
    "opacity",
    "transform",
    "textAlign",
    "lineHeight",
    "letterSpacing",
    "textDecoration",
    "boxShadow",
    "flexDirection",
    "justifyContent",
    "alignItems",
    "gridTemplateColumns",
  ]

  // Common HTML tags
  const commonTags = [
    "div",
    "span",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "a",
    "img",
    "button",
    "input",
    "form",
    "header",
    "footer",
    "nav",
    "main",
    "section",
    "article",
    "aside",
    "ul",
    "ol",
    "li",
    "table",
    "tr",
    "td",
    "th",
    "video",
    "audio",
  ]

  const handlePropertyChange = (property) => {
    setSelectedProps((prev) => (prev.includes(property) ? prev.filter((p) => p !== property) : [...prev, property]))
  }

  const handleTagChange = (tag) => {
    if (tag === "all") {
      setSelectedTags((prev) => {
        if (prev.includes("all")) {
          // Unchecking 'all'. Revert to the previous selection.
          // If the previous selection was empty, provide a default list.
          return previousTagsRef.current.length > 0
            ? previousTagsRef.current
            : ["div", "span", "p", "h1", "h2", "a", "button", "img"]
        } else {
          // Checking 'all'. Store the current selection before switching.
          previousTagsRef.current = prev
          return ["all"]
        }
      })
    } else {
      setSelectedTags((prev) => {
        // When a specific tag is changed, ensure 'all' is not in the list.
        const newTags = prev.filter((t) => t !== "all")
        if (newTags.includes(tag)) {
          // Uncheck the tag
          return newTags.filter((t) => t !== tag)
        } else {
          // Check the tag
          return [...newTags, tag]
        }
      })
    }
  }

  const handleCustomTagsChange = (e) => {
    setCustomTags(e.target.value)
  }

  const addCustomTags = () => {
    if (customTags.trim()) {
      const newTags = customTags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
      setSelectedTags((prev) => {
        // Remove "all" when adding custom tags
        const filtered = prev.filter((t) => t !== "all")
        const uniqueNewTags = newTags.filter((tag) => !filtered.includes(tag))
        return [...filtered, ...uniqueNewTags]
      })
      setCustomTags("")
    }
  }

  const getEffectiveTags = () => {
    // If 'all' is selected, the API expects the string 'all'
    if (selectedTags.length === 1 && selectedTags[0] === "all") {
      return "all"
    }
    // Otherwise, return the array of selected tags
    return selectedTags
  }

  const extractStyles = async () => {
    if (!url) {
      setError("Please enter a valid URL")
      return
    }
    setLoading(true)
    setError("")
    setStyleTree(null) // Clear previous results

    try {
      const tagsToExtract = getEffectiveTags()

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          properties: selectedProps,
          tags: tagsToExtract,
        }),
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

  const TreeNode = ({ node, depth = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(depth < 2)
    const indent = depth * 20
    const hasChildren = node.children && node.children.length > 0

    return (
      <div className="font-mono text-sm">
        <div
          className="flex items-center py-1 hover:bg-gray-50 rounded cursor-pointer"
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 mr-1 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1 text-gray-500" />
            )
          ) : (
            <div className="w-5" />
          )}
          <span className="text-blue-600 font-semibold">&lt;{node.tag}&gt;</span>
          <div className="ml-3 flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(node.styles).map(([prop, value]) => (
              <span key={prop} className="text-gray-600">
                {prop}: <span className="text-green-600">{value}</span>
              </span>
            ))}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child, index) => (
              <TreeNode key={index} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const generateOutput = () => {
    if (!styleTree) return ""
    const printTree = (node, depth = 0) => {
      const indent = "  ".repeat(depth)
      const { tag, styles, children } = node
      const styleStr = Object.entries(styles)
        .map(([prop, value]) => `${prop}: ${value}`)
        .join(", ")
      let output = `${indent}<${tag}> - ${styleStr}\n`
      if (children) {
        children.forEach((child) => {
          output += printTree(child, depth + 1)
        })
      }
      return output
    }
    return printTree(styleTree)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateOutput())
  }

  const downloadOutput = () => {
    const blob = new Blob([generateOutput()], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "style-tree.txt"
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
            <p className="text-blue-100">Extract and visualize CSS styles from any website</p>
          </div>

          <div className="p-8">
            {/* Input Section */}
            <div className="mb-8">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  HTML Tags to Extract ({selectedTags.includes("all") ? "All tags" : `${selectedTags.length} selected`})
                </label>
                {/* All Tags Option */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes("all")}
                      onChange={() => handleTagChange("all")}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-blue-700">Extract All HTML Tags</span>
                  </label>
                  <p className="text-xs text-blue-600 mt-1 ml-6">
                    {selectedTags.includes("all")
                      ? "Extracting styles from all HTML elements"
                      : "Or, select specific tags below"}
                  </p>
                </div>

                {/* Show tag selection options when "all" is not selected */}
                {!selectedTags.includes("all") && (
                  <>
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Common HTML Tags</h4>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {commonTags.map((tag) => (
                          <label
                            key={tag}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTags.includes(tag)}
                              onChange={() => handleTagChange(tag)}
                              className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700 font-mono">{tag}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Custom Tags Input */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Custom Tags</h4>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={customTags}
                          onChange={handleCustomTagsChange}
                          placeholder="canvas, svg, custom-element (comma separated)"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onKeyPress={(e) => e.key === "Enter" && addCustomTags()}
                        />
                        <button
                          onClick={addCustomTags}
                          className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Selected Custom Tags */}
                    {selectedTags.some((tag) => !commonTags.includes(tag)) && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-600 mb-2">Selected Custom Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedTags
                            .filter((tag) => !commonTags.includes(tag))
                            .map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full"
                              >
                                {tag}
                                <button
                                  onClick={() => handleTagChange(tag)}
                                  className="ml-1 text-purple-500 hover:text-purple-700"
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

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

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  CSS Properties to Extract ({selectedProps.length} selected)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {availableProperties.map((prop) => (
                    <label
                      key={prop}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProps.includes(prop)}
                        onChange={() => handlePropertyChange(prop)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-mono">{prop}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={extractStyles}
                disabled={
                  loading ||
                  !url ||
                  selectedProps.length === 0 ||
                  (selectedTags.length === 0 && !selectedTags.includes("all"))
                }
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Extracting Styles...</span>
                  </>
                ) : (
                  <span>Extract Styles</span>
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
                  <h2 className="text-2xl font-bold text-gray-800">Extracted Style Tree</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-sm">Copy</span>
                    </button>
                    <button
                      onClick={downloadOutput}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm">Download</span>
                    </button>
                  </div>
                </div>

                {/* Visual Tree */}
                <div className="bg-gray-50 rounded-lg p-6 border">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Visual Tree Structure</h3>
                  <div className="max-h-96 overflow-auto">
                    <TreeNode node={styleTree} />
                  </div>
                </div>

                {/* Text Output */}
                <div className="bg-gray-900 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Text Output</h3>
                  <pre className="text-green-400 text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                    {generateOutput()}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Note */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 text-sm">
            <strong>Note:</strong> This is a frontend demo. In a production environment, you would need a backend
            service running a browser automation tool like Puppeteer to actually extract styles from websites due to
            CORS restrictions.
          </p>
        </div>
      </div>
    </div>
  )
}

export default CSSExtractorApp
