import Link from "next/link";
import { IDEAS } from "@/lib/ideas";

export function IdeaCarousel() {
  return (
    <ul className="carousel" aria-label="Sample plans">
      {IDEAS.map((idea) => (
        <li key={idea.slug}>
          <Link href={`/ideas/${idea.slug}`} className="idea-card" style={{ background: idea.tone }}>
            <span className="idea-kicker">{idea.tagline}</span>
            <span className="idea-title">{idea.title}</span>
            <span className="idea-cta">See the plan →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
