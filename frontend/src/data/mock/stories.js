export const stories = [
  {
    id: 'silent-forest',
    title: 'The Silent Forest',
    author: 'Mira Lane',
    genre: 'Fantasy',
    rating: '4.8',
    reads: '125K',
    color: '#173b3f',
    icon: '🌲',
  },
  {
    id: 'whispers-of-you',
    title: 'Whispers of You',
    author: 'Elena J. Park',
    genre: 'Romance',
    rating: '4.7',
    reads: '98K',
    color: '#df8b79',
    icon: '🌅',
  },
  {
    id: 'neon-hearts',
    title: 'Neon Hearts',
    author: 'Kaito Min',
    genre: 'Sci-Fi',
    rating: '4.6',
    reads: '210K',
    color: '#34336f',
    icon: '🌃',
  },
  {
    id: 'dragons-wish',
    title: "A Dragon's Wish",
    author: 'Ren Park',
    genre: 'Adventure',
    rating: '4.6',
    reads: '143K',
    color: '#9d744b',
    icon: '🐉',
  },
  {
    id: 'last-kingdom',
    title: 'The Last Kingdom',
    author: 'Aurora White',
    genre: 'Mystery',
    rating: '4.5',
    reads: '86K',
    color: '#668ba3',
    icon: '🏰',
  },
  {
    id: 'fragments-of-us',
    title: 'Fragments of Us',
    author: 'Liam Carter',
    genre: 'Drama',
    rating: '4.4',
    reads: '72K',
    color: '#77a9b3',
    icon: '🌊',
  },
]

export const featuredStories = [
  {
    label: 'BIÊN TẬP VIÊN ĐỀ XUẤT',
    title: 'Thế giới muôn vàn khả năng',
    description: 'Khám phá những câu chuyện được đội ngũ biên tập tuyển chọn.',
    icon: '🏰',
    tone: 'rose',
  },
  {
    label: 'TÁC GIẢ MỚI',
    title: 'Giọng kể mới, ý tưởng sáng tạo',
    description: 'Gặp gỡ những cây bút tài năng và các truyện mới nhất của họ.',
    icon: '📚',
    tone: 'orange',
  },
  {
    label: 'NGHE MỌI NƠI',
    title: 'Truyện đồng hành mọi hành trình',
    description: 'Thưởng thức âm thanh sống động với giọng kể ấm áp.',
    icon: '🎧',
    tone: 'green',
  },
]

const variants = [
  ['Crown of Starlight', 'Valerie Adams', 'Fantasy', '#91785f', '✨'],
  ['Autumn Coffee & Letters', 'Clara Hayes', 'Romance', '#b56f76', '☕'],
  ['Before Sunrise in Paris', 'Max Dupont', 'Romance', '#a67782', '🗼'],
  ['Echoes in the Void', 'Sora Yane', 'Sci-Fi', '#394b70', '🚀'],
  ['Synapse Terminal 9', 'Dahlia Chen', 'Sci-Fi', '#4a3a71', '🧠'],
  ['Orbit Beyond Sol', 'D. J. Martinez', 'Sci-Fi', '#45677e', '🪐'],
]
export const extendedStories = [
  ...stories,
  ...variants.map(([title, author, genre, color, icon], index) => ({
    id: `story-${index + 7}`,
    title,
    author,
    genre,
    rating: (4.3 + (index % 3) * 0.1).toFixed(1),
    reads: `${64 + index * 18}K`,
    color,
    icon,
  })),
]

export const hiddenGems = [
  {
    genre: 'Adventure',
    title: 'The Clockmaker of Verona',
    chapters: 31,
    description:
      'In a secluded atelier, an apprentice uncovers mechanisms that wind backward through lost conversations and forgotten memories.',
    author: 'Josie Thorne',
  },
  {
    genre: 'Slice of Life',
    title: 'Station at Daybreak',
    chapters: 24,
    description:
      'A quiet morning encounter between strangers waiting for the 6:15 express train, gradually intertwining their small joys and sorrows.',
    author: 'Maya Lin',
  },
  {
    genre: 'Mystery',
    title: "The Archivist's Key",
    chapters: 45,
    description:
      'A locked cabinet in the royal library holds correspondence of three monarchs who never officially existed in historical records.',
    author: 'Arthur Pendleton',
  },
]
