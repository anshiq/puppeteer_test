import { NextResponse } from "next/server"
import puppeteer from "puppeteer"

// Helper function to scroll the page to the bottom to trigger lazy loading
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
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

export async function POST(request: Request) {
  let browser
  try {
    const { url, properties, tags } = await request.json()

    if (!url || !properties || !tags) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()

    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    )

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 })

    // Scroll to the bottom to load all content
    await autoScroll(page)

    // Wait a moment for any final scripts to run
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const styleTree = await page.evaluate(
      (properties, tags) => {
        function walk(element) {
          if (!element || element.nodeType !== 1) return null

          const tag = element.tagName.toLowerCase()

          const children = []
          const elementsToWalk = [...element.children, ...(element.shadowRoot ? element.shadowRoot.children : [])]

          for (const child of elementsToWalk) {
            const result = walk(child)
            if (result) {
              if (Array.isArray(result)) {
                children.push(...result)
              } else {
                children.push(result)
              }
            }
          }

          const isTagIncluded = tags === "all" || tags.includes(tag)

          if (isTagIncluded) {
            const computed = window.getComputedStyle(element)
            const styles = {}
            for (const prop of properties) {
              styles[prop] = computed.getPropertyValue(prop)
            }
            return { tag, styles, children }
          }

          if (children.length > 0) {
            return children
          }

          return null
        }

        const rawTree = walk(document.body)

        if (Array.isArray(rawTree)) {
          const bodyStyles = {}
          const computedBody = window.getComputedStyle(document.body)
          if (tags === "all" || tags.includes("body")) {
            for (const prop of properties) {
              bodyStyles[prop] = computedBody.getPropertyValue(prop)
            }
          }
          return { tag: "body", styles: bodyStyles, children: rawTree }
        }
        return rawTree
      },
      properties,
      tags,
    )

    return NextResponse.json(styleTree)
  } catch (error) {
    console.error("Extraction failed:", error)
    return NextResponse.json(
      { error: "Failed to extract styles from the page.", details: error.message },
      { status: 500 },
    )
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
