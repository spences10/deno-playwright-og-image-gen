import * as fs from "fs";
import * as path from "path";
import { template_data } from "../types/og-params";

export class template_renderer {
	private template_cache: Map<string, string> = new Map();

	private get_template(template_name: string): string {
		if (this.template_cache.has(template_name)) {
			return this.template_cache.get(template_name)!;
		}

		const template_path = path.join(
			process.cwd(),
			"src",
			"templates",
			`${template_name}.html`
		);
		const template_content = fs.readFileSync(template_path, "utf-8");
		this.template_cache.set(template_name, template_content);

		return template_content;
	}
	private sanitise_text(text: string): string {
		// Convert Unicode characters to HTML entities to avoid Playwright ByteString issues
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
			.replace(/[\u0080-\uFFFF]/g, function(match) {
				// Handle multi-byte Unicode characters (like emojis) properly
				const codePoint = match.codePointAt(0);
				return codePoint ? "&#" + codePoint + ";" : match;
			});
	}

	private get_theme_colours(theme: "light" | "dark") {
		const themes = {
			light: {
				background_colour: "#ffffff",
				text_colour: "#1a1a1a",
				accent_colour: "#3b82f6",
			},
			dark: {
				background_colour: "#0f172a",
				text_colour: "#f8fafc",
				accent_colour: "#60a5fa",
			},
		};

		return themes[theme];
	}

	public render_template(
		template_name: string,
		data: Omit<
			template_data,
			"background_colour" | "text_colour" | "accent_colour"
		>
	): string {
		const template = this.get_template(template_name);

		let rendered = template;

		// Replace template placeholders with sanitized data
		rendered = rendered.replace(
			/\{\{TITLE\}\}/g,
			this.sanitise_text(data.title)
		);
		rendered = rendered.replace(
			/\{\{AUTHOR\}\}/g,
			this.sanitise_text(data.author)
		);
		rendered = rendered.replace(
			/\{\{WEBSITE\}\}/g,
			this.sanitise_text(data.website)
		);
		rendered = rendered.replace(/\{\{THEME\}\}/g, data.theme);

		return rendered;
	}
}
