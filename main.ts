import { serve } from "https://deno.land/std/http/server.ts";
import { Canvas } from "@gfx/canvas";
import { crypto } from "https://deno.land/std/crypto/mod.ts";

// In-memory cache for generated images
const imageCache = new Map<string, Uint8Array>();

// Simple template renderer
function render_template(template_content: string, data: Record<string, string>): string {
  let rendered = template_content;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replaceAll(placeholder, value);
  }
  return rendered;
}

// Load template file
async function load_template(template_name: string): Promise<string> {
  const template_path = `./templates/${template_name}.html`;
  return await Deno.readTextFile(template_path);
}

// Generate cache key from template data
function generate_cache_key(template_data: Record<string, string>): string {
  const sorted_data = Object.keys(template_data)
    .sort()
    .reduce((result, key) => {
      result[key] = template_data[key];
      return result;
    }, {} as Record<string, string>);
  
  const data_string = JSON.stringify(sorted_data);
  const hash = crypto.subtle.digestSync("SHA-256", new TextEncoder().encode(data_string));
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

const PORT = parseInt(Deno.env.get("PORT") || "8000");

const server = serve(async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === "/api/generate") {
    try {
      console.log("Generating image...");
      
      // Extract query parameters
      const params = new URLSearchParams(url.search);
      
      // Default template data with query parameter overrides
      const template_data = {
        title: params.get("title") || "Hello World",
        description: params.get("description") || "OG Image Generator is Working!",
        author: params.get("author") || "",
        website: params.get("website") || "",
        backgroundColor: params.get("backgroundColor") || "#667eea",
        backgroundColorSecondary: params.get("backgroundColorSecondary") || "#764ba2",
        textColor: params.get("textColor") || "white"
      };
      
      // Generate cache key
      const cache_key = generate_cache_key(template_data);
      
      // Check if image is already cached
      if (imageCache.has(cache_key)) {
        console.log("Returning cached image");
        const cached_image = imageCache.get(cache_key)!;
        return new Response(cached_image, {
          headers: { 
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=2592000"
          }
        });
      }
      
      // Create canvas
      const canvas = new Canvas(1200, 630);
      const ctx = canvas.getContext('2d');
      
      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
      gradient.addColorStop(0, template_data.backgroundColor);
      gradient.addColorStop(1, template_data.backgroundColorSecondary);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1200, 630);
      
      // Draw title
      ctx.fillStyle = template_data.textColor;
      ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template_data.title, 600, 250);
      
      // Draw description
      ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.globalAlpha = 0.9;
      ctx.fillText(template_data.description, 600, 320);
      
      // Draw author
      if (template_data.author) {
        ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.globalAlpha = 0.8;
        ctx.fillText(template_data.author, 600, 400);
      }
      
      // Draw website
      if (template_data.website) {
        ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.globalAlpha = 0.7;
        ctx.fillText(template_data.website, 600, 440);
      }
      
      // Generate PNG
      const screenshot = canvas.encode('png');
      
      // Cache the generated image
      imageCache.set(cache_key, screenshot);
      
      console.log("Image generated successfully");
      
      return new Response(screenshot, {
        headers: { 
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=2592000"
        }
      });
      
    } catch (error) {
      console.error("Error generating image:", error);
      return new Response("Error generating image", { status: 500 });
    }
  }
  
  // Health check endpoint
  if (url.pathname === "/health") {
    return new Response("OK", { status: 200 });
  }
  
  // Root endpoint with instructions
  if (url.pathname === "/") {
    return new Response(`
      <html>
        <body style="font-family: Arial; padding: 40px;">
          <h1>OG Image Generator</h1>
          <p>Server is running!</p>
          <h2>Test the API:</h2>
          <ul>
            <li><a href="/api/generate" target="_blank">Generate Test Image</a></li>
            <li><a href="/health">Health Check</a></li>
          </ul>
        </body>
      </html>
    `, {
      headers: { "Content-Type": "text/html" }
    });
  }
  
  return new Response("404 Not Found", { status: 404 });
}, { port: PORT });

console.log("🚀 OG Image Generator starting...");
console.log(`📍 Server running on http://localhost:${PORT}`);
console.log(`🖼️  Test image: http://localhost:${PORT}/api/generate`);
console.log(`❤️  Health check: http://localhost:${PORT}/health`);
