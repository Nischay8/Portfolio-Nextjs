import { defineQuery } from "next-sanity";
import { sanityFetch } from "@/sanity/lib/live";

const PORTFOLIO_CONTEXT_QUERY = defineQuery(`{
  "profile": *[_id == "singleton-profile"][0]{
    firstName, lastName, headline, shortBio, fullBio,
    email, phone, location, availability, yearsOfExperience,
    socialLinks, stats
  },
  "experience": *[_type == "experience"] | order(startDate desc){
    company, position, startDate, endDate, description,
    responsibilities, achievements, technologies, current
  },
  "projects": *[_type == "project"] | order(_createdAt desc){
    title, description, technologies, liveUrl, githubUrl,
    featured, category
  },
  "skills": *[_type == "skill"] | order(proficiency desc){
    name, category, proficiency, yearsOfExperience
  },
  "education": *[_type == "education"] | order(endDate desc){
    institution, degree, field, startDate, endDate, description, gpa
  },
  "certifications": *[_type == "certification"] | order(issueDate desc){
    name, issuer, issueDate, expiryDate, credentialUrl, description
  },
  "services": *[_type == "service"]{
    title, description, featured
  },
  "achievements": *[_type == "achievement"] | order(date desc){
    title, description, date, category
  },
  "testimonials": *[_type == "testimonial"]{
    name, role, company, content, rating, date
  },
  "blogs": *[_type == "blog"] | order(publishedAt desc)[0...10]{
    title, "slug": slug.current, excerpt, publishedAt, categories, featured
  }
}`);

let cachedContext: { value: string; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getPortfolioContext(): Promise<string> {
  const now = Date.now();
  if (cachedContext && cachedContext.expiresAt > now) {
    return cachedContext.value;
  }

  try {
    const { data } = await sanityFetch({
      query: PORTFOLIO_CONTEXT_QUERY,
      // No live updates needed in a server action
      perspective: "published",
    });

    const serialized = JSON.stringify(data, null, 2);
    cachedContext = { value: serialized, expiresAt: now + CACHE_TTL_MS };
    return serialized;
  } catch (error) {
    console.error("[gemini] Failed to load portfolio context:", error);
    return "{}";
  }
}
