import { StoryCard } from './StoryCard'
import { SectionTitle } from './SectionTitle'
export function StoryShelf({ title, stories }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="nh-grid-12 grid nh-cols-2 gap-4 nh-sm-cols-4">
        {stories.map(story => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </section>
  )
}
