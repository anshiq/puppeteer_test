import puppeteer, { type Browser, type Page } from "puppeteer"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { addExtra } from "puppeteer-extra"

const puppeteerExtra = addExtra(puppeteer)
puppeteerExtra.use(StealthPlugin())

export interface CrawlerConfig {
    headless?: boolean
    proxy?: string
    userAgent?: string
    viewport?: { width: number; height: number }
    timeout?: number
    waitForSelector?: string
}

export interface CrawlOptions {
    waitForSelector?: string
    waitUntil?: puppeteer.LoadEvent
    delay?: number
    extractText?: boolean
    extractHtml?: boolean
    extractLinks?: boolean
    extractImages?: boolean
    screenshot?: boolean
    extract?: () => any
}

export class ProxyRotator {
    private proxies: string[]
    private currentIndex: number

    constructor(proxies: string[]) {
        this.proxies = proxies
        this.currentIndex = 0
    }

    getNext(): string | undefined {
        if (this.proxies.length === 0) return undefined
        const proxy = this.proxies[this.currentIndex]
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length
        return proxy
    }
}

export class AdvancedPuppeteerCrawler {
    private browser: Browser | null = null
    private config: CrawlerConfig
    private isHealthy = true

    constructor(config: CrawlerConfig = {}) {
        this.config = {
            headless: true,
            timeout: 30000,
            viewport: { width: 1920, height: 1080 },
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ...config,
        }
    }

    private async launchBrowser(): Promise<Browser> {
        const args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
            "--disable-features=VizDisplayCompositor",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
        ]

        if (this.config.proxy) {
            args.push(`--proxy-server=${this.config.proxy}`)
        }

        try {
            this.browser = await puppeteerExtra.launch({
                headless: this.config.headless,
                args,
                timeout: this.config.timeout,
                ignoreDefaultArgs: ["--disable-extensions"],
                defaultViewport: null,
            })

            this.browser.on("disconnected", () => {
                this.isHealthy = false
                console.log("Browser disconnected")
            })

            return this.browser
        } catch (error: any) {
            console.error("Failed to launch browser:", error)
            throw new Error(`Browser launch failed: ${error.message}`)
        }
    }

    async createPage(): Promise<Page> {
        if (!this.browser || !this.isHealthy) {
            this.browser = await this.launchBrowser()
        }

        const page: Page = await this.browser.newPage()

        if (this.config.viewport) {
            await page.setViewport(this.config.viewport)
        }

        if (this.config.userAgent) {
            await page.setUserAgent(this.config.userAgent)
        }

        await page.setExtraHTTPHeaders({
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        })

        // Only block images, fonts, media — NOT stylesheets
        await page.setRequestInterception(true)
        page.on("request", (req) => {
            const resourceType = req.resourceType()
            if (["image", "font", "media"].includes(resourceType)) {
                req.abort()
            } else {
                req.continue()
            }
        })

        page.on("error", (err: any) => console.error("Page error:", err))
        page.on("pageerror", (err: any) => console.error("Page script error:", err))

        page.setDefaultTimeout(this.config.timeout || 30000)
        page.setDefaultNavigationTimeout(this.config.timeout || 30000)

        return page
    }

    async crawl(url: string, options: CrawlOptions = {}) {
        let page: Page | null = null
        try {
            page = await this.createPage()
            await page.goto(url, {
                waitUntil: options.waitUntil || "networkidle2",
                timeout: this.config.timeout,
            })

            if (options.waitForSelector || this.config.waitForSelector) {
                await page.waitForSelector(options.waitForSelector || this.config.waitForSelector || "").catch(() => { })
            }

            if (options.delay) {
                await page.waitForTimeout(options.delay)
            }

            const result: any = {}

            if (options.extractText !== false) {
                result.text = await page.evaluate(() => document.body.innerText)
            }

            if (options.extractHtml !== false) {
                result.html = await page.content()
            }

            if (options.extractLinks) {
                result.links = await page.evaluate(() =>
                    Array.from(document.querySelectorAll("a[href]")).map((a) => ({
                        text: a.textContent?.trim(),
                        href: (a as HTMLAnchorElement).href,
                    })),
                )
            }

            if (options.extractImages) {
                result.images = await page.evaluate(() =>
                    Array.from(document.querySelectorAll("img[src]")).map((img) => ({
                        src: (img as HTMLImageElement).src,
                        alt: img.alt,
                    })),
                )
            }

            if (options.extract && typeof options.extract === "function") {
                result.custom = await page.evaluate(options.extract)
            }

            if (options.screenshot) {
                result.screenshot = await page.screenshot({ type: "png", fullPage: true })
            }

            return result
        } catch (error) {
            console.error("Crawl error:", error)
            throw error
        } finally {
            if (page) {
                try {
                    await page.close()
                } catch (err) {
                    console.error("Error closing page:", err)
                }
            }
        }
    }

    async close(): Promise<void> {
        if (this.browser) {
            try {
                await this.browser.close()
            } catch (err) {
                console.error("Error closing browser:", err)
            } finally {
                this.browser = null
                this.isHealthy = false
            }
        }
    }

    isConnected(): boolean {
        return (this.browser?.isConnected() && this.isHealthy) || false
    }
}
