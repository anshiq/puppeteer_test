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

      const rawStyleTree = await Promise.race([
        page.evaluate(() => {
          // Expanded list of properties for better coverage
          const properties = [
            'color',
            'background-color',
            'background-image',
            'background',
            'font-family',
            'font-size',
            'font-weight',
            'font-style',
            'font',
            'border-color',
            'border-width',
            'border-style',
            'border',
            'outline-color',
            'outline-width',
            'outline-style',
            'outline',
            'text-decoration-color',
            'box-shadow',
            'text-shadow'
          ]

          // More precise default value detection
          function isDefaultOrEmpty(property: string, value: string): boolean {
            if (!value || value.trim() === '') return true

            // Normalize the value
            const normalizedValue = value.trim().toLowerCase()

            // Property-specific default checks
            switch (property) {
              case 'background':
              case 'background-color':
                return normalizedValue === 'rgba(0, 0, 0, 0)' ||
                  normalizedValue === 'transparent' ||
                  normalizedValue === 'initial' ||
                  normalizedValue === 'inherit'

              case 'background-image':
                return normalizedValue === 'none' ||
                  normalizedValue === 'initial' ||
                  normalizedValue === 'inherit'

              case 'border':
              case 'border-color':
              case 'border-width':
              case 'border-style':
                return normalizedValue.includes('0px') ||
                  normalizedValue === 'none' ||
                  normalizedValue === 'initial' ||
                  normalizedValue === 'inherit'

              case 'outline':
              case 'outline-color':
              case 'outline-width':
              case 'outline-style':
                return normalizedValue.includes('0px') ||
                  normalizedValue === 'none' ||
                  normalizedValue === 'initial' ||
                  normalizedValue === 'inherit'

              case 'font':
              case 'font-family':
              case 'font-size':
              case 'font-weight':
              case 'font-style':
                return normalizedValue === 'initial' ||
                  normalizedValue === 'inherit'

              case 'box-shadow':
              case 'text-shadow':
                return normalizedValue === 'none' ||
                  normalizedValue === 'initial' ||
                  normalizedValue === 'inherit'

              default:
                return normalizedValue === 'initial' ||
                  normalizedValue === 'inherit' ||
                  normalizedValue === 'unset'
            }
          }

          // Helper function to convert colors to consistent format
          function normalizeColor(color: string): string {
            if (!color) return color

            // Create a temporary element to normalize the color
            const tempDiv = document.createElement('div')
            tempDiv.style.color = color
            document.body.appendChild(tempDiv)
            const computedColor = window.getComputedStyle(tempDiv).color
            document.body.removeChild(tempDiv)

            return computedColor || color
          }

          function walk(element: Element): any {
            if (!element || element.nodeType !== 1) return null

            const tag = element.tagName.toLowerCase()

            // Skip script and style elements
            if (tag === 'script' || tag === 'style') return null

            const children: any[] = []
            const elementsToWalk = [
              ...Array.from(element.children),
              ...(element.shadowRoot ? Array.from(element.shadowRoot.children) : []),
            ]

            for (const child of elementsToWalk) {
              const result = walk(child)
              if (result) {
                children.push(result)
              }
            }

            const computed = window.getComputedStyle(element)
            const styles: Record<string, string> = {}

            // Extract all specified properties
            for (const prop of properties) {
              try {
                let value = computed.getPropertyValue(prop)

                // Skip if default or empty
                if (isDefaultOrEmpty(prop, value)) continue

                // Normalize colors for consistency
                if (prop.includes('color') && !prop.includes('background')) {
                  value = normalizeColor(value)
                }

                styles[prop] = value
              } catch (error) {
                console.warn(`Could not read ${prop} property:`, error)
              }
            }

            // Get element's bounding box for context
            const rect = element.getBoundingClientRect()
            const isVisible = rect.width > 0 && rect.height > 0 &&
              computed.visibility !== 'hidden' &&
              computed.display !== 'none'

            // Include element ID and classes for better identification
            const elementInfo: any = { tag }

            if (element.id) elementInfo.id = element.id
            if (element.className && typeof element.className === 'string') {
              elementInfo.classes = element.className.split(' ').filter(cls => cls.trim())
            }

            // Add visibility info
            elementInfo.visible = isVisible

            // Add text content for text elements (truncated)
            if (element.textContent && element.textContent.trim()) {
              const textContent = element.textContent.trim()
              if (textContent.length > 0 && textContent.length < 100) {
                elementInfo.text = textContent
              }
            }

            // Only include styles if they exist
            if (Object.keys(styles).length > 0) {
              elementInfo.styles = styles
            }

            // Only include children if they exist
            if (children.length > 0) {
              elementInfo.children = children
            }

            // Return node if it has styles, children, or is a meaningful element
            const hasMeaningfulContent = Object.keys(styles).length > 0 ||
              children.length > 0 ||
              elementInfo.text ||
              ['img', 'svg', 'canvas', 'video', 'audio'].includes(tag)

            return hasMeaningfulContent ? elementInfo : null
          }

          return walk(document.documentElement)
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Style extraction timeout")), 15000)),
      ])

      return NextResponse.json(rawStyleTree)
    } catch (pageError) {
      console.error("Page operation error:", pageError)
      throw pageError
    }
  } catch (error) {
    console.error("Extraction failed:", error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    const isTimeoutError = errorMessage.includes("timeout") || errorMessage.includes("Navigation timeout")
    const isConnectionError = errorMessage.includes("Connection closed") || errorMessage.includes("Protocol error")

    let userFriendlyMessage = "Failed to extract styles from the page."
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