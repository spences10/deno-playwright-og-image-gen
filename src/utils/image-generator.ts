import { Browser, chromium } from "playwright";
import { image_generation_options } from "../types/og-params";

export class image_generator {
	private browser: Browser | null = null;
	private is_initializing = false;

	private async get_browser(): Promise<Browser> {
		if (this.browser && this.browser.isConnected()) {
			return this.browser;
		}

		if (this.is_initializing) {
			// Wait for initialization to complete
			while (this.is_initializing) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			if (this.browser && this.browser.isConnected()) {
				return this.browser;
			}
		}

		this.is_initializing = true;

		try {
			const launch_options: any = {
				headless: true,
				args: [
					"--no-sandbox",
					"--disable-setuid-sandbox",
					"--disable-dev-shm-usage",
					"--disable-gpu",
					"--disable-software-rasterizer",
					"--disable-background-timer-throttling",
					"--disable-backgrounding-occluded-windows",
					"--disable-renderer-backgrounding",
					"--disable-features=TranslateUI",
					"--disable-ipc-flooding-protection",
					"--disable-web-security",
					"--disable-features=VizDisplayCompositor",
					"--disable-extensions",
					"--no-first-run",
					"--no-default-browser-check",
					"--no-zygote",
					"--single-process",
					"--memory-pressure-off",
					"--max_old_space_size=4096",
				],
			};

			console.log("Launching Playwright Chromium browser...");
			this.browser = await chromium.launch(launch_options);

			// Handle browser disconnect with restart
			this.browser.on("disconnected", () => {
				console.log("Browser disconnected, clearing reference");
				this.browser = null;
			});

			return this.browser;
		} finally {
			this.is_initializing = false;
		}
	}

	public async generate_image(
		html_content: string,
		options: image_generation_options = {
			width: 1200,
			height: 630,
			device_scale_factor: 2,
			format: "png",
		}
	): Promise<Buffer> {
		let retries = 2;
		let lastError: Error;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const browser = await this.get_browser();
				const page = await browser.newPage();

				try {
					await page.setViewportSize({
						width: options.width,
						height: options.height,
					});

					// Set content and wait for fonts and images to load
					await page.setContent(html_content, {
						waitUntil: "networkidle",
					});

					// Wait a bit more for fonts to render properly
					await new Promise((resolve) => setTimeout(resolve, 1000));

					// Take screenshot
					const screenshot = await page.screenshot({
						type: options.format,
						quality:
							options.format === "jpeg" ? options.quality || 90 : undefined,
						fullPage: false,
						clip: {
							x: 0,
							y: 0,
							width: options.width,
							height: options.height,
						},
					});

					return screenshot;
				} finally {
					await page.close().catch(() => {}); // Ignore close errors
				}
			} catch (error) {
				lastError = error as Error;
				console.error(`Image generation attempt ${attempt + 1} failed:`, error);

				// Clear browser reference to force restart on next attempt
				if (this.browser) {
					await this.browser.close().catch(() => {});
					this.browser = null;
				}

				if (attempt === retries) {
					throw lastError;
				}

				// Wait before retry
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		throw lastError!;
	}

	public async close(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}

	// Graceful shutdown handler
	public setup_shutdown_handlers(): void {
		const shutdown = async () => {
			console.log("Shutting down browser...");
			await this.close();
			process.exit(0);
		};

		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);
		process.on("uncaughtException", async (error) => {
			console.error("Uncaught exception:", error);
			await this.close();
			process.exit(1);
		});
	}
}
