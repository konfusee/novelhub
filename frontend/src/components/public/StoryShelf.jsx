import { StoryCard, StoryCardSkeleton } from './StoryCard';
import { SectionTitle } from './SectionTitle';
import { Reveal } from '../ui';

/* `loading` keeps the title and grid and swaps the cards for same-size placeholders. */
export function StoryShelf({ title, stories, to, loading = false, placeholders = 4 }) {
  return (
    <section>
      <SectionTitle to={to}>{title}</SectionTitle>
      {loading ? (
        <div
          aria-busy="true"
          aria-label={`Đang tải ${title}`}
          className="nh-grid-12 grid nh-cols-2 gap-x-4 gap-y-6 nh-sm-cols-4"
        >
          {Array.from({ length: placeholders }, (_, index) => (
            <StoryCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="nh-grid-12 grid nh-cols-2 gap-x-4 gap-y-6 nh-sm-cols-4">
          {stories.map((story, index) => (
            <Reveal key={story.id} delay={Math.min(index, 5) * 80}>
              <StoryCard story={story} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
