/* Reading-canvas option sets shared by the reader toolbar and the reader settings drawer. */
export const READER_FONT_SIZES = [14, 16, 18, 20, 22, 24, 26, 28]
export const READER_LINE_HEIGHTS = [1.4, 1.6, 1.8, 2]
export const READER_PARAGRAPH_GAPS = [
  ['compact', 12],
  ['comfortable', 22],
  ['relaxed', 32],
]
export const READER_WIDTH = { min: 640, max: 1100, step: 20 }
export const DEFAULT_READER_FONT = "'Be Vietnam Pro', ui-sans-serif, sans-serif"
export const READER_FONTS = [
  ['Be Vietnam Pro', DEFAULT_READER_FONT],
  ['Arial', 'Arial, ui-sans-serif, sans-serif'],
  ['Giao diện hệ thống', 'ui-sans-serif, system-ui, sans-serif'],
]
/* How the reader moves between chapters; persisted with the other reader settings. */
export const DEFAULT_CHAPTER_MODE = 'continuous'
export const READER_CHAPTER_MODES = [
  {
    value: 'continuous',
    label: 'Cuộn liên tục',
    description: 'Chương sau hiện ngay bên dưới, đọc liền mạch không ngắt quãng.',
    recommended: true,
  },
  {
    value: 'swipe',
    label: 'Vuốt ngang',
    description: 'Vuốt trái hoặc phải trên trang, chạm mép màn hình hay dùng phím ← →.',
  },
  {
    value: 'button',
    label: 'Nút bấm',
    description: 'Chuyển chương bằng nút Chương trước và Chương sau.',
  },
]
