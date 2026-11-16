import Image from "next/image";
import Link from "next/link";
import { IDEAS } from "@/lib/ideas";
import { photoFor } from "@/lib/photos";
import { Carousel } from "./Carousel";

export function IdeaCarousel() {
  return (
    <Carousel
      label="sample plans"
      heading={
        <div>
          <p className="eyebrow">Ready-made</p>
          <h2 id="ideas-h">Start from a sample plan</h2>
        </div>
      }
    >
      {IDEAS.map((idea) => {
        const photo = photoFor(idea.destination);
        return (
          <li key={idea.slug}>
            <Link href={`/ideas/${idea.slug}`} className="idea-card" style={{ background: idea.tone }}>
              {photo && <Image src={photo} alt="" fill placeholder="blur" sizes="(max-width: 600px) 80vw, 300px" />}
              <span className="idea-days">{idea.days.length} days</span>
              <span className="idea-place">{idea.destination}</span>
              <span className="idea-kicker">{idea.tagline}</span>
              <span className="idea-cta">See the plan →</span>
            </Link>
          </li>
        );
      })}
    </Carousel>
  );
}
