import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { og_params } from "./types/og-params";
import { image_generator } from "./utils/image-generator";
import { template_renderer } from "./utils/template-renderer";

const app = new Hono();
const template_renderer_instance = new template_renderer();
const image_generator_instance = new image_generator();

// Setup graceful shutdown
image_generator_instance.setup_shutdown_handlers();

// Hybrid cache setup
const CACHE_DIR = join(process.cwd(), "cache");
const CACHE_TTL = Number(process.env.DEFAULT_CACHE_TTL) || 86400; // 24 hours in seconds
const HTTP_CACHE_TTL = Number(process.env.HTTP_CACHE_TTL) || 86400; // 24 hours for browsers/CDNs
const MAX_RAM_CACHE_SIZE = Number(process.env.IMAGE_CACHE_MAX_SIZE) || 100;

// RAM cache (hot - most recently accessed)
interface RamCacheEntry {
	buffer: Buffer;
	timestamp: number;
}

const ram_cache = new Map<string, RamCacheEntry>();

// Ensure cache directory exists
async function ensure_cache_dir() {
	try {
		await fs.access(CACHE_DIR);
	} catch {
		await fs.mkdir(CACHE_DIR, { recursive: true });
	}
}

// Initialize cache directory
ensure_cache_dir().catch(console.error);

// Cache cleanup function
function cleanup_cache() {
	const now = Date.now();

	// Clean up RAM cache - remove expired entries
	for (const [key, entry] of ram_cache.entries()) {
		if (now - entry.timestamp > CACHE_TTL * 1000) {
			ram_cache.delete(key);
		}
	}

	// If RAM cache still too big, remove oldest entries
	if (ram_cache.size > MAX_RAM_CACHE_SIZE) {
		const entries = Array.from(ram_cache.entries()).sort(
			([, a], [, b]) => a.timestamp - b.timestamp
		);

		const to_remove = entries.slice(0, ram_cache.size - MAX_RAM_CACHE_SIZE);
		for (const [key] of to_remove) {
			ram_cache.delete(key);
		}
	}
}

// Run cache cleanup every 2 hours
setInterval(cleanup_cache, 2 * 60 * 60 * 1000);

// Hybrid cache functions
async function get_from_disk_cache(cache_key: string): Promise<Buffer | null> {
	try {
		const file_path = join(
			CACHE_DIR,
			`${cache_key.replace(/[^a-zA-Z0-9\-_]/g, "_")}.png`
		);
		const stats = await fs.stat(file_path);

		// Check if file is expired
		const age = Date.now() - stats.mtime.getTime();
		if (age > CACHE_TTL * 1000) {
			await fs.unlink(file_path).catch(() => {}); // Clean up expired file
			return null;
		}

		return await fs.readFile(file_path);
	} catch {
		return null;
	}
}

async function save_to_disk_cache(
	cache_key: string,
	buffer: Buffer
): Promise<void> {
	try {
		const file_path = join(
			CACHE_DIR,
			`${cache_key.replace(/[^a-zA-Z0-9\-_]/g, "_")}.png`
		);
		await fs.writeFile(file_path, buffer);
	} catch (error) {
		console.error("Failed to save to disk cache:", error);
	}
}

async function get_cached_image(
	cache_key: string
): Promise<{ buffer: Buffer; source: "ram" | "disk" } | null> {
	// Check RAM cache first (fastest)
	const ram_entry = ram_cache.get(cache_key);
	if (ram_entry) {
		const age = Date.now() - ram_entry.timestamp;
		if (age < CACHE_TTL * 1000) {
			return { buffer: ram_entry.buffer, source: "ram" };
		} else {
			ram_cache.delete(cache_key);
		}
	}

	// Check disk cache (warm)
	const disk_buffer = await get_from_disk_cache(cache_key);
	if (disk_buffer) {
		// Promote to RAM cache
		ram_cache.set(cache_key, {
			buffer: disk_buffer,
			timestamp: Date.now(),
		});
		return { buffer: disk_buffer, source: "disk" };
	}

	return null;
}

async function cache_image(cache_key: string, buffer: Buffer): Promise<void> {
	const timestamp = Date.now();

	// Save to RAM cache
	ram_cache.set(cache_key, { buffer, timestamp });

	// Save to disk cache (async, don't wait)
	save_to_disk_cache(cache_key, buffer).catch(console.error);
}

// Middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
	"*",
	cors({
		origin:
			process.env.NODE_ENV === "production"
				? process.env.ALLOWED_ORIGINS?.split(",") || [
						"https://scottspence.com",
						"https://www.scottspence.com",
				  ]
				: "*",
		allowMethods: ["GET"],
		allowHeaders: ["Content-Type"],
	})
);

// Simple rate limiting for production (can be enhanced later)
if (process.env.NODE_ENV === "production") {
	const request_counts = new Map<
		string,
		{ count: number; reset_time: number }
	>();

	app.use("*", async (c: Context, next) => {
		const client_ip =
			c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
		const now = Date.now();
		const window_ms = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000; // 1 minute
		const max_requests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 60; // 60 requests per minute

		const client_data = request_counts.get(client_ip);

		if (!client_data || now > client_data.reset_time) {
			request_counts.set(client_ip, { count: 1, reset_time: now + window_ms });
			return next();
		}

		if (client_data.count >= max_requests) {
			return c.json(
				{
					error: "Too many requests",
					retry_after: Math.ceil((client_data.reset_time - now) / 1000),
				},
				429
			);
		}

		client_data.count++;
		return next();
	});
}

function validate_og_params(query: Record<string, string | undefined>): {
	valid: boolean;
	params?: og_params;
	error?: string;
} {
	const { title, author, website, theme } = query;

	if (!title || typeof title !== "string" || title.trim().length === 0) {
		return {
			valid: false,
			error: "Title is required and must be a non-empty string",
		};
	}

	if (title.length > 200) {
		return { valid: false, error: "Title must be 200 characters or less" };
	}

	if (author && (typeof author !== "string" || author.length > 100)) {
		return {
			valid: false,
			error: "Author must be a string of 100 characters or less",
		};
	}

	if (website && (typeof website !== "string" || website.length > 100)) {
		return {
			valid: false,
			error: "Website must be a string of 100 characters or less",
		};
	}

	if (theme && !["light", "dark"].includes(theme)) {
		return { valid: false, error: 'Theme must be either "light" or "dark"' };
	}

	return {
		valid: true,
		params: {
			title: title.trim(),
			author: author?.trim() || "Anonymous",
			website: website?.trim() || "example.com",
			theme: (theme as "light" | "dark") || "light",
		},
	};
}

// Routes
app.get("/", async (c: Context) => {
	try {
		const protocol =
			c.req.header("x-forwarded-proto") ||
			(c.req.url.startsWith("https") ? "https" : "http");
		const host = c.req.header("host") || `localhost:3000`;
		const base_url = `${protocol}://${host}`;
		const og_image_url = `${base_url}/og?title=Coolify%20OG%20Image%20Generator&author=Coolify&website=coolify.io&theme=light`;

		const template_path = join(process.cwd(), "src/templates/index.html");
		let html = await fs.readFile(template_path, "utf-8");

		html = html
			.replace(/{{OG_IMAGE_URL}}/g, og_image_url)
			.replace(/{{BASE_URL}}/g, base_url);

		c.header("Content-Type", "text/html; charset=utf-8");
		return c.html(html);
	} catch (error) {
		console.error("Error loading index template:", error);
		return c.json({ error: "Could not load page" }, 500);
	}
});

// Preview endpoint for testing the design
app.get("/preview", async (c: Context) => {
	try {
		const query = c.req.query();
		const title = query.title || "";
		const author = query.author || "";
		const website = query.website || "";
		const theme = (query.theme as "light" | "dark") || "light";

		// Render HTML template for preview
		const html_content = template_renderer_instance.render_template("default", {
			title,
			author,
			website,
			theme,
		});

		c.header("Content-Type", "text/html; charset=utf-8");
		return c.html(html_content);
	} catch (error) {
		console.error("Error generating preview:", error);
		return c.json({ error: "Could not generate preview" }, 500);
	}
});

app.get("/og", async (c: Context) => {
	const start_time = Date.now();
	try {
		// Get query parameters
		const query = c.req.query();

		// Validate parameters
		const validation = validate_og_params(query);
		if (!validation.valid) {
			return c.json({ error: validation.error }, 400);
		}

		const params = validation.params!;

		// Generate cache key
		const cache_key = `${params.title}-${params.author}-${params.website}-${params.theme}`;

		// Check hybrid cache (RAM -> Disk -> Generate)
		const cached_result = await get_cached_image(cache_key);

		if (cached_result) {
			// Set cache headers
			c.header(
				"Cache-Control",
				`public, max-age=${HTTP_CACHE_TTL}, s-maxage=${HTTP_CACHE_TTL}`
			);
			c.header("Content-Type", "image/png");
			c.header("Content-Length", cached_result.buffer.length.toString());
			c.header("X-Cache-Key", cache_key);
			c.header("X-Cache-Status", `HIT-${cached_result.source.toUpperCase()}`);
			c.header("ETag", `"${cache_key.replace(/[^a-zA-Z0-9]/g, "")}"`);

			const response_time = Date.now() - start_time;
			console.log(
				`✅ Cache hit (${cached_result.source}): ${cache_key} - ${response_time}ms`
			);
			return c.body(cached_result.buffer);
		}

		// Set cache headers
		c.header(
			"Cache-Control",
			`public, max-age=${HTTP_CACHE_TTL}, s-maxage=${HTTP_CACHE_TTL}`
		);
		c.header("Content-Type", "image/png");
		c.header("X-Cache-Key", cache_key);
		c.header("X-Cache-Status", "MISS");
		c.header("ETag", `"${cache_key.replace(/[^a-zA-Z0-9]/g, "")}"`);
		c.header("Last-Modified", new Date().toUTCString());

		// Render HTML template
		const html_content = template_renderer_instance.render_template("default", {
			title: params.title,
			author: params.author || "Anonymous",
			website: params.website || "example.com",
			theme: params.theme || "light",
		});

		// Generate image
		const image_buffer = await image_generator_instance.generate_image(
			html_content,
			{
				width: 1200,
				height: 630,
				device_scale_factor: 2,
				format: "png",
			}
		);

		// Cache the generated image (both RAM and disk)
		await cache_image(cache_key, image_buffer);

		const response_time = Date.now() - start_time;
		console.log(`🔄 Generated fresh: ${cache_key} - ${response_time}ms`);
		return c.body(image_buffer);
	} catch (error) {
		console.error("Error generating OG image:", error);
		return c.json(
			{
				error: "Internal server error while generating image",
				message:
					process.env.NODE_ENV === "development"
						? (error as Error).message
						: undefined,
			},
			500
		);
	}
});

// Health check endpoint
app.get("/health", (c: Context) => {
	return c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		service: "og-image-generator",
		cache: {
			ram_entries: ram_cache.size,
			max_ram_size: MAX_RAM_CACHE_SIZE,
		},
	});
});

// Auth middleware for cache management
const require_auth = async (c: Context, next: Function) => {
	const token = c.req.header("Authorization");
	if (!token || token !== `Bearer ${process.env.ADMIN_TOKEN}`) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	return await next();
};

// Cache management endpoints
app.delete("/cache", require_auth, async (c: Context) => {
	const ram_cleared = ram_cache.size;
	ram_cache.clear();

	// Clear disk cache
	let disk_cleared = 0;
	try {
		const files = await fs.readdir(CACHE_DIR);
		const png_files = files.filter((f) => f.endsWith(".png"));
		await Promise.all(png_files.map((f) => fs.unlink(join(CACHE_DIR, f))));
		disk_cleared = png_files.length;
	} catch (error) {
		console.error("Error clearing disk cache:", error);
	}

	return c.json({
		message: "Cache cleared successfully",
		ram_cleared_entries: ram_cleared,
		disk_cleared_entries: disk_cleared,
	});
});

app.delete("/cache/:key", require_auth, async (c: Context) => {
	const key = c.req.param("key");
	const decoded_key = decodeURIComponent(key);

	// Delete from RAM
	const ram_deleted = ram_cache.delete(decoded_key);

	// Delete from disk
	let disk_deleted = false;
	try {
		const file_path = join(
			CACHE_DIR,
			`${decoded_key.replace(/[^a-zA-Z0-9\-_]/g, "_")}.png`
		);
		await fs.unlink(file_path);
		disk_deleted = true;
	} catch {
		// File might not exist
	}

	return c.json({
		message:
			ram_deleted || disk_deleted
				? "Cache entry deleted"
				: "Cache entry not found",
		key: key,
		ram_deleted,
		disk_deleted,
	});
});

app.get("/cache", async (c: Context) => {
	const ram_entries = Array.from(ram_cache.keys());

	// Get disk entries
	let disk_entries: string[] = [];
	try {
		const files = await fs.readdir(CACHE_DIR);
		disk_entries = files
			.filter((f) => f.endsWith(".png"))
			.map((f) => f.replace(".png", ""));
	} catch {
		// Directory might not exist yet
	}

	return c.json({
		ram_cache: {
			entries: ram_entries.length,
			max_size: MAX_RAM_CACHE_SIZE,
			keys: ram_entries,
		},
		disk_cache: {
			entries: disk_entries.length,
			keys: disk_entries,
		},
	});
});

// Start server
const port = Number(process.env.PORT) || 3000;

// For Node.js, we need to use the serve function
import { serve } from "@hono/node-server";

// Pre-warm cache with popular posts
async function pre_warm_cache() {
	try {
		console.log("🔥 Pre-warming cache with popular posts...");

		// Fetch popular posts from scottspence.com
		const response = await fetch(
			"https://scottspence.com/api/fetch-popular-posts"
		);
		if (!response.ok) {
			console.log("❌ Failed to fetch popular posts, skipping pre-warm");
			return;
		}

		const popular_posts = (await response.json()) as {
			daily?: any[];
			monthly?: any[];
			yearly?: any[];
		};
		const all_posts = [
			...(popular_posts.daily || []).slice(0, 5),
			...(popular_posts.monthly || []).slice(0, 5),
			...(popular_posts.yearly || []).slice(0, 5),
		];

		// Convert popular posts to OG image params
		const images_to_warm = all_posts.map((post: any) => ({
			title: post.title,
			author: "Scott Spence",
			website: "scottspence.com",
			theme: "light",
		}));

		for (const params of images_to_warm) {
			const cache_key = `${params.title}-${params.author}-${params.website}-${params.theme}`;
			const cached = await get_cached_image(cache_key);
			if (cached && cached.source === "disk") {
				console.log(`✅ Pre-warmed RAM: ${params.title}`);
			}
		}

		console.log(`🔥 Pre-warmed ${images_to_warm.length} images`);
	} catch (error) {
		console.error("❌ Error pre-warming cache:", error);
	}
}

serve({
	fetch: app.fetch,
	port: port,
});

console.log(`🚀 OG Image Generator server running on port ${port}`);

// Pre-warm cache after startup
setTimeout(pre_warm_cache, 1000);
console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`🔗 Health check: http://localhost:${port}/health`);
console.log(
	`🖼️  Generate image: http://localhost:${port}/og?title=Hello%20World`
);
