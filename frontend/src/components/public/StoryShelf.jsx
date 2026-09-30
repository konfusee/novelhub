import { StoryCard } from './StoryCard'
import { SectionTitle } from './SectionTitle'
export function StoryShelf({ title, stories }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stories.map(story => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </section>
  )
}
