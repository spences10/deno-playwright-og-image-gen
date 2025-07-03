#!/usr/bin/env -S deno run --allow-read --allow-net

import { serve } from "https://deno.land/std/http/server.ts";

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

const PORT = 3000;

serve(async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === "/") {
    try {
      // Get query parameters or use defaults
      const params = new URLSearchParams(url.search);
      
      const template_data = {
        title: params.get("title") || "Sample Blog Post Title",
        description: params.get("description") || "This is a sample description to show how the template looks with real content.",
        author: params.get("author") || "Scott Spence",
        website: params.get("website") || "scottspence.com",
        backgroundColor: params.get("backgroundColor") || "#667eea",
        backgroundColorSecondary: params.get("backgroundColorSecondary") || "#764ba2",
        textColor: params.get("textColor") || "white"
      };
      
      // Load and render template
      const template_content = await load_template("basic");
      const rendered_html = render_template(template_content, template_data);
      
      return new Response(rendered_html, {
        headers: { "Content-Type": "text/html" }
      });
      
    } catch (error) {
      console.error("Error:", error);
      return new Response("Error loading template", { status: 500 });
    }
  }
  
  return new Response("404 Not Found", { status: 404 });
}, { port: PORT });

console.log(`🖼️  HTML Template Preview running on http://localhost:${PORT}`);
console.log(`🎨  Try: http://localhost:${PORT}/?title=My%20Custom%20Title&author=Your%20Name`);