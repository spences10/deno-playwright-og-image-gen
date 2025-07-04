export interface og_params {
  title: string;
  author?: string;
  website?: string;
  theme?: 'light' | 'dark';
}

export interface template_data {
  title: string;
  author: string;
  website: string;
  theme: 'light' | 'dark';
  background_colour: string;
  text_colour: string;
  accent_colour: string;
}

export interface image_generation_options {
  width: number;
  height: number;
  device_scale_factor: number;
  format: 'png' | 'jpeg';
  quality?: number;
}
