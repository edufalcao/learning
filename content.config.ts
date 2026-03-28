import { defineCollection, defineContentConfig, z } from '@nuxt/content';

export default defineContentConfig({
  collections: {
    courses: defineCollection({
      type: 'data',
      source: 'courses/*.yml',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        slug: z.string(),
        color: z.string(),
        lessons: z.number(),
        weeks: z.array(z.object({
          number: z.number(),
          name: z.string(),
          subtitle: z.string(),
          color: z.string()
        }))
      })
    }),
    agentic_coding: defineCollection({
      type: 'page',
      source: 'agentic-coding/*.md',
      schema: z.object({
        title: z.string(),
        day: z.number(),
        week: z.number(),
        weekName: z.string(),
        description: z.string(),
        tag: z.string()
      })
    }),
    systems_design_ai_native: defineCollection({
      type: 'page',
      source: 'systems-design-ai-native/*.md',
      schema: z.object({
        title: z.string(),
        day: z.number(),
        week: z.number(),
        weekName: z.string(),
        description: z.string(),
        tag: z.string()
      })
    })
  }
});
