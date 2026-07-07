import { Job } from 'bullmq';
import { createSupabaseAdmin } from '@pullquest/database';
import { config } from '../config/env.js';

const supabase = createSupabaseAdmin();

export default async function processAISummary(job: Job): Promise<void> {
  const { type, id, title, body } = job.data;
  console.log(`[Worker AI Summary]: Processing ${type} (ID: ${id})`);

  let summary = `[AI Summary] Auto-generated summary placeholder for: ${title}`;

  if (config.GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze the following GitHub ${type} title and description. Generate a concise 2-3 sentence summary explaining the core goal and scope. Avoid formatting artifacts.
                    
Title: ${title}
Description: ${body}`,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 250,
            },
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generatedText) {
          summary = generatedText.trim();
        }
      } else {
        console.error(`[Worker AI Summary]: Gemini API error: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error('[Worker AI Summary]: Error calling Gemini API:', err);
    }
  }

  // Update back in database
  const table = type === 'issue' ? 'issues' : 'pull_requests';
  const { error } = await supabase
    .from(table)
    .update({ ai_summary: summary })
    .eq('id', id);

  if (error) throw error;

  console.log(`[Worker AI Summary]: Saved AI summary for ${type} ID ${id}`);
  await job.updateProgress(100);
}
