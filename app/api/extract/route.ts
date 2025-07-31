import { NextResponse } from "next/server"
import { AdvancedPuppeteerCrawler, ProxyRotator } from "./class"

// Helper function to scroll the page to the bottom to trigger lazy loading
async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0
      const distance = 100
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
  })
}

// Optional: Configure proxy rotation if you have proxies
const PROXIES: string[] = [
  // Add your proxy servers here if available
  // 'http://proxy1:port',
  // 'http://proxy2:port',
]

export async function POST(request: Request) {
  let crawler: AdvancedPuppeteerCrawler | null = null
  let page: any = null

  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL provided" }, { status: 400 })
    }

    // Initialize proxy rotator if proxies are available
    const proxyRotator = PROXIES.length > 0 ? new ProxyRotator(PROXIES) : null
    const proxy = proxyRotator?.getNext()

    // Create a new crawler instance for each request (avoid singleton issues)
    crawler = new AdvancedPuppeteerCrawler({
      headless: true,
      proxy: proxy,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      timeout: 45000,
      waitForSelector: "body",
    })

    // Create page with retry logic
    let retries = 2
    while (retries > 0) {
      try {
        page = await crawler.createPage()
        break
      } catch (error) {
        console.error(`Page creation failed (${retries} retries left):`, error)
        retries--
        if (retries === 0) throw error

        if (crawler) {
          await crawler.close().catch(() => { })
          crawler = new AdvancedPuppeteerCrawler({
            headless: true,
            proxy: proxy,
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport: { width: 1920, height: 1080 },
            timeout: 45000,
            waitForSelector: "body",
          })
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    if (!page) {
      throw new Error("Failed to create page after retries")
    }

    try {
      await Promise.race([
        page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Navigation timeout")), 35000)),
      ])

      await page.waitForSelector("body", { timeout: 5000 }).catch(() => {
        console.log("Body selector timeout, continuing anyway")
      })

      await autoScroll(page).catch((error) => {
        console.log("Auto-scroll failed:", error.message)
      })

      await new Promise((resolve) => setTimeout(resolve, 1000))

      const pageTheme = await Promise.race([
        page.evaluate(() => {
          // Theme extraction properties we care about (including dimensions)
          const themeProperties = [
            'background-color',
            'background',
            'color',
            'outline-color',
            'outline',
            'border-color',
            'border',
            'font-family',
            'font-size',
            'font-weight',
            'font',
            'width',
            'height'
          ]

          // Helper function to check if a value is meaningful (not default)
          function isMeaningfulValue(property: string, value: string): boolean {
            if (!value || value.trim() === '') return false

            const normalizedValue = value.trim().toLowerCase()

            switch (property) {
              case 'background':
              case 'background-color':
                return normalizedValue !== 'rgba(0, 0, 0, 0)' &&
                  normalizedValue !== 'transparent' &&
                  normalizedValue !== 'initial' &&
                  normalizedValue !== 'inherit'

              case 'border':
              case 'border-color':
                return !normalizedValue.includes('0px') &&
                  normalizedValue !== 'none' &&
                  normalizedValue !== 'initial' &&
                  normalizedValue !== 'inherit'

              case 'outline':
              case 'outline-color':
                return !normalizedValue.includes('0px') &&
                  normalizedValue !== 'none' &&
                  normalizedValue !== 'initial' &&
                  normalizedValue !== 'inherit'

              case 'width':
              case 'height':
                return normalizedValue !== 'auto' &&
                  normalizedValue !== '0px' &&
                  normalizedValue !== 'initial' &&
                  normalizedValue !== 'inherit'

              default:
                return normalizedValue !== 'initial' &&
                  normalizedValue !== 'inherit' &&
                  normalizedValue !== 'unset'
            }
          }

          // Helper function to normalize colors
          function normalizeColor(color: string): string {
            if (!color) return color
            const tempDiv = document.createElement('div')
            tempDiv.style.color = color
            document.body.appendChild(tempDiv)
            const computedColor = window.getComputedStyle(tempDiv).color
            document.body.removeChild(tempDiv)
            return computedColor || color
          }

          // Helper function to get element dimensions and visibility info
          function getElementDimensions(element: Element): any {
            const rect = element.getBoundingClientRect()
            const computed = window.getComputedStyle(element)

            return {
              boundingBox: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                x: Math.round(rect.x),
                y: Math.round(rect.y)
              },
              computedSize: {
                width: computed.width,
                height: computed.height
              },
              visible: rect.width > 0 && rect.height > 0 &&
                computed.visibility !== 'hidden' &&
                computed.display !== 'none'
            }
          }

          // Extract styles from specific elements with dimension data
          function extractFromElements(selectors: string[]): Record<string, any> {
            const styles: Record<string, any> = {}
            const dimensions: any[] = []

            for (const selector of selectors) {
              try {
                const elements = document.querySelectorAll(selector)
                elements.forEach(element => {
                  const computed = window.getComputedStyle(element)
                  const dimensionData = getElementDimensions(element)

                  // Only process visible elements
                  if (dimensionData.visible) {
                    dimensions.push({
                      selector: selector,
                      tag: element.tagName.toLowerCase(),
                      id: element.id || null,
                      classes: element.className ? element.className.split(' ').filter(c => c.trim()) : [],
                      ...dimensionData
                    })
                  }

                  themeProperties.forEach(prop => {
                    try {
                      let value = computed.getPropertyValue(prop)

                      if (isMeaningfulValue(prop, value)) {
                        if (prop.includes('color') && !prop.includes('background')) {
                          value = normalizeColor(value)
                        }

                        if (!styles[prop]) styles[prop] = []
                        if (!styles[prop].includes(value)) {
                          styles[prop].push(value)
                        }
                      }
                    } catch (error) {
                      // Skip errors for individual properties
                    }
                  })
                })
              } catch (error) {
                // Skip errors for individual selectors
              }
            }

            // Return styles with most common values and dimension data
            const result: Record<string, any> = { dimensions }
            Object.keys(styles).forEach(prop => {
              if (styles[prop].length > 0) {
                result[prop] = styles[prop][0] // Take first (most common) value
              }
            })

            return result
          }

          // Extract most frequent colors and dimensions from all elements
          function extractMostFrequentData(): Record<string, any> {
            const colorFreq: Record<string, number> = {}
            const backgroundFreq: Record<string, number> = {}
            const fontFreq: Record<string, number> = {}
            const sizeData: any[] = []

            // Sample a subset of elements for performance
            const allElements = document.querySelectorAll('*')
            const sampleSize = Math.min(200, allElements.length)
            const step = Math.max(1, Math.floor(allElements.length / sampleSize))

            for (let i = 0; i < allElements.length; i += step) {
              const element = allElements[i]
              const computed = window.getComputedStyle(element)
              const dimensionData = getElementDimensions(element)

              // Collect size data for visible elements
              if (dimensionData.visible && dimensionData.boundingBox.width > 10 && dimensionData.boundingBox.height > 10) {
                sizeData.push({
                  tag: element.tagName.toLowerCase(),
                  ...dimensionData
                })
              }

              // Count colors
              const color = computed.color
              if (isMeaningfulValue('color', color)) {
                const normalizedColor = normalizeColor(color)
                colorFreq[normalizedColor] = (colorFreq[normalizedColor] || 0) + 1
              }

              // Count backgrounds
              const background = computed.backgroundColor
              if (isMeaningfulValue('background-color', background)) {
                backgroundFreq[background] = (backgroundFreq[background] || 0) + 1
              }

              // Count fonts
              const font = computed.fontFamily
              if (isMeaningfulValue('font-family', font)) {
                fontFreq[font] = (fontFreq[font] || 0) + 1
              }
            }

            // Get most frequent values
            const getMostFrequent = (freq: Record<string, number>) => {
              const sorted = Object.entries(freq).sort(([, a], [, b]) => b - a)
              return sorted.length > 0 ? sorted[0][0] : null
            }

            const result: Record<string, any> = {
              sampleElements: sizeData.slice(0, 20) // Top 20 largest visible elements
            }
            const mostFrequentColor = getMostFrequent(colorFreq)
            const mostFrequentBackground = getMostFrequent(backgroundFreq)
            const mostFrequentFont = getMostFrequent(fontFreq)

            if (mostFrequentColor) result.color = mostFrequentColor
            if (mostFrequentBackground) result['background-color'] = mostFrequentBackground
            if (mostFrequentFont) result['font-family'] = mostFrequentFont

            return result
          }

          // Extract CSS custom properties (CSS variables)
          function extractCSSVariables(): Record<string, string> {
            const variables: Record<string, string> = {}

            try {
              const rootStyles = window.getComputedStyle(document.documentElement)
              const rootStylesText = rootStyles.cssText || ''

              // Look for CSS custom properties
              const varMatches = rootStylesText.match(/--[^:;]+:[^;]+/g) || []
              varMatches.forEach(match => {
                const [prop, value] = match.split(':').map(s => s.trim())
                if (prop && value) {
                  variables[prop] = value
                }
              })

              // Also check style sheets
              Array.from(document.styleSheets).forEach(sheet => {
                try {
                  Array.from(sheet.cssRules || []).forEach(rule => {
                    if (rule.selectorText === ':root' && rule.style) {
                      for (let i = 0; i < rule.style.length; i++) {
                        const prop = rule.style[i]
                        if (prop.startsWith('--')) {
                          variables[prop] = rule.style.getPropertyValue(prop)
                        }
                      }
                    }
                  })
                } catch (e) {
                  // Skip CORS-protected stylesheets
                }
              })
            } catch (error) {
              // Skip errors
            }

            return variables
          }

          // Get viewport information
          function getViewportInfo(): any {
            return {
              width: window.innerWidth,
              height: window.innerHeight,
              devicePixelRatio: window.devicePixelRatio,
              scrollWidth: document.documentElement.scrollWidth,
              scrollHeight: document.documentElement.scrollHeight
            }
          }

          // Main theme extraction
          const theme = {
            primary: extractFromElements(['body', 'html']),
            header: extractFromElements(['header', 'nav', '.header', '.navbar', '.nav']),
            content: extractFromElements(['main', 'article', '.content', '.main', 'section']),
            accent: extractFromElements(['a', 'button', '.btn', '.button', 'input[type="submit"]']),
            secondary: extractMostFrequentData(),
            variables: extractCSSVariables(),
            viewport: getViewportInfo(),
            metadata: {
              title: document.title,
              url: window.location.href,
              extractedAt: new Date().toISOString(),
              userAgent: navigator.userAgent
            }
          }

          return theme
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Theme extraction timeout")), 15000)),
      ])

      return NextResponse.json(pageTheme)
    } catch (pageError) {
      console.error("Page operation error:", pageError)
      throw pageError
    }
  } catch (error) {
    console.error("Theme extraction failed:", error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    const isTimeoutError = errorMessage.includes("timeout") || errorMessage.includes("Navigation timeout")
    const isConnectionError = errorMessage.includes("Connection closed") || errorMessage.includes("Protocol error")

    let userFriendlyMessage = "Failed to extract theme from the page."
    if (isTimeoutError) {
      userFriendlyMessage = "The website took too long to respond. Please try again."
    } else if (isConnectionError) {
      userFriendlyMessage = "Connection to the website was lost. Please try again."
    }

    return NextResponse.json(
      {
        error: userFriendlyMessage,
        details: errorMessage,
        type: isTimeoutError ? "timeout" : isConnectionError ? "connection" : "unknown",
      },
      { status: 500 },
    )
  } finally {
    if (page) {
      try {
        await page.close()
      } catch (error) {
        console.error("Error closing page:", error)
      }
    }

    if (crawler) {
      try {
        await crawler.close()
      } catch (error) {
        console.error("Error closing crawler:", error)
      }
    }
  }
}