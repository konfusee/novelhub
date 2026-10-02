import { createElement, forwardRef } from 'react'
import { iconPaths } from './iconPaths'

// Decorative by default. Label the enclosing button, or pass title/aria-label.
function createIcon(name) {
  const Icon = forwardRef(function FolioIcon(
    {
      size = 24,
      color = 'currentColor',
      strokeWidth = 1.75,
      absoluteStrokeWidth = false,
      title,
      children,
      ...props
    },
    ref,
  ) {
    const labelled = Boolean(title || props['aria-label'] || props['aria-labelledby'])
    return createElement(
      'svg',
      {
        ref,
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: color,
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        focusable: 'false',
        'aria-hidden': labelled ? undefined : true,
        role: labelled ? 'img' : undefined,
        'data-nh-icon': name,
        ...props,
      },
      title && createElement('title', null, title),
      createElement('path', {
        d: iconPaths[name],
        vectorEffect: absoluteStrokeWidth ? 'non-scaling-stroke' : undefined,
      }),
      children,
    )
  })
  Icon.displayName = name
  return Icon
}

export const NovelHubMark = createIcon('NovelHubMark')
export const Activity = createIcon('Activity')
export const AlertTriangle = createIcon('AlertTriangle')
export const AlignJustify = createIcon('AlignJustify')
export const AlignLeft = createIcon('AlignLeft')
export const Archive = createIcon('Archive')
export const ArrowLeft = createIcon('ArrowLeft')
export const ArrowRight = createIcon('ArrowRight')
export const ArrowUp = createIcon('ArrowUp')
export const AtSign = createIcon('AtSign')
export const BadgeDollarSign = createIcon('BadgeDollarSign')
export const BarChart3 = createIcon('BarChart3')
export const Bell = createIcon('Bell')
export const BellOff = createIcon('BellOff')
export const BellRing = createIcon('BellRing')
export const Bold = createIcon('Bold')
export const BookCheck = createIcon('BookCheck')
export const BookHeart = createIcon('BookHeart')
export const BookMarked = createIcon('BookMarked')
export const BookOpen = createIcon('BookOpen')
export const BookOpenCheck = createIcon('BookOpenCheck')
export const Bookmark = createIcon('Bookmark')
export const Bot = createIcon('Bot')
export const Boxes = createIcon('Boxes')
export const BrainCircuit = createIcon('BrainCircuit')
export const CalendarDays = createIcon('CalendarDays')
export const Camera = createIcon('Camera')
export const Check = createIcon('Check')
export const CheckCheck = createIcon('CheckCheck')
export const CheckCircle2 = createIcon('CheckCircle2')
export const ChevronDown = createIcon('ChevronDown')
export const ChevronLeft = createIcon('ChevronLeft')
export const ChevronRight = createIcon('ChevronRight')
export const ChevronUp = createIcon('ChevronUp')
export const CircleDollarSign = createIcon('CircleDollarSign')
export const CirclePlus = createIcon('CirclePlus')
export const ClipboardCheck = createIcon('ClipboardCheck')
export const Clock = createIcon('Clock')
export const Clock3 = createIcon('Clock3')
export const Cloud = createIcon('Cloud')
export const Coins = createIcon('Coins')
export const Compass = createIcon('Compass')
export const Copy = createIcon('Copy')
export const Copyright = createIcon('Copyright')
export const Crown = createIcon('Crown')
export const Database = createIcon('Database')
export const Download = createIcon('Download')
export const Edit3 = createIcon('Edit3')
export const Ellipsis = createIcon('Ellipsis')
export const ExternalLink = createIcon('ExternalLink')
export const Eye = createIcon('Eye')
export const EyeOff = createIcon('EyeOff')
export const Feather = createIcon('Feather')
export const FileAudio = createIcon('FileAudio')
export const FileCheck2 = createIcon('FileCheck2')
export const FileClock = createIcon('FileClock')
export const FilePlus2 = createIcon('FilePlus2')
export const FileSearch = createIcon('FileSearch')
export const FileText = createIcon('FileText')
export const FileWarning = createIcon('FileWarning')
export const Filter = createIcon('Filter')
export const Flag = createIcon('Flag')
export const Flame = createIcon('Flame')
export const FlaskConical = createIcon('FlaskConical')
export const Focus = createIcon('Focus')
export const FolderHeart = createIcon('FolderHeart')
export const FolderOpen = createIcon('FolderOpen')
export const FolderTree = createIcon('FolderTree')
export const Gauge = createIcon('Gauge')
export const Gavel = createIcon('Gavel')
export const GitMerge = createIcon('GitMerge')
export const Globe2 = createIcon('Globe2')
export const Grid2X2 = createIcon('Grid2X2')
export const GripVertical = createIcon('GripVertical')
export const Hash = createIcon('Hash')
export const Heading2 = createIcon('Heading2')
export const Heading3 = createIcon('Heading3')
export const Headphones = createIcon('Headphones')
export const Heart = createIcon('Heart')
export const HelpCircle = createIcon('HelpCircle')
export const Highlighter = createIcon('Highlighter')
export const History = createIcon('History')
export const Home = createIcon('Home')
export const Image = createIcon('Image')
export const ImagePlus = createIcon('ImagePlus')
export const Images = createIcon('Images')
export const Import = createIcon('Import')
export const Info = createIcon('Info')
export const Italic = createIcon('Italic')
export const KeyRound = createIcon('KeyRound')
export const Laptop = createIcon('Laptop')
export const LayoutDashboard = createIcon('LayoutDashboard')
export const Library = createIcon('Library')
export const Lightbulb = createIcon('Lightbulb')
export const Link2 = createIcon('Link2')
export const List = createIcon('List')
export const ListMusic = createIcon('ListMusic')
export const ListTree = createIcon('ListTree')
export const Lock = createIcon('Lock')
export const LockKeyhole = createIcon('LockKeyhole')
export const LogOut = createIcon('LogOut')
export const Mail = createIcon('Mail')
export const Menu = createIcon('Menu')
export const MessageCircle = createIcon('MessageCircle')
export const MessageSquare = createIcon('MessageSquare')
export const MessageSquareText = createIcon('MessageSquareText')
export const MessageSquareWarning = createIcon('MessageSquareWarning')
export const Moon = createIcon('Moon')
export const MoreHorizontal = createIcon('MoreHorizontal')
export const MoreVertical = createIcon('MoreVertical')
export const NotebookPen = createIcon('NotebookPen')
export const Palette = createIcon('Palette')
export const PanelLeft = createIcon('PanelLeft')
export const PanelRight = createIcon('PanelRight')
export const Pause = createIcon('Pause')
export const PenLine = createIcon('PenLine')
export const Play = createIcon('Play')
export const Plus = createIcon('Plus')
export const Quote = createIcon('Quote')
export const RefreshCw = createIcon('RefreshCw')
export const Repeat2 = createIcon('Repeat2')
export const RotateCcw = createIcon('RotateCcw')
export const RotateCw = createIcon('RotateCw')
export const Save = createIcon('Save')
export const Scale = createIcon('Scale')
export const Scissors = createIcon('Scissors')
export const Search = createIcon('Search')
export const Send = createIcon('Send')
export const Settings = createIcon('Settings')
export const Settings2 = createIcon('Settings2')
export const Share2 = createIcon('Share2')
export const Shield = createIcon('Shield')
export const ShieldAlert = createIcon('ShieldAlert')
export const ShieldCheck = createIcon('ShieldCheck')
export const ShieldX = createIcon('ShieldX')
export const Shuffle = createIcon('Shuffle')
export const SkipBack = createIcon('SkipBack')
export const SkipForward = createIcon('SkipForward')
export const SlidersHorizontal = createIcon('SlidersHorizontal')
export const Smartphone = createIcon('Smartphone')
export const Sparkles = createIcon('Sparkles')
export const Star = createIcon('Star')
export const Sun = createIcon('Sun')
export const Tags = createIcon('Tags')
export const Target = createIcon('Target')
export const Trash2 = createIcon('Trash2')
export const Trophy = createIcon('Trophy')
export const Underline = createIcon('Underline')
export const Upload = createIcon('Upload')
export const UserCog = createIcon('UserCog')
export const UserPlus = createIcon('UserPlus')
export const UserRound = createIcon('UserRound')
export const UserRoundCheck = createIcon('UserRoundCheck')
export const UsersRound = createIcon('UsersRound')
export const Volume2 = createIcon('Volume2')
export const WalletCards = createIcon('WalletCards')
export const WandSparkles = createIcon('WandSparkles')
export const X = createIcon('X')
export const Coffee = createIcon('Coffee')
export const Theater = createIcon('Theater')
export const Ghost = createIcon('Ghost')
export const Orbit = createIcon('Orbit')
export const Leaf = createIcon('Leaf')
export const Castle = createIcon('Castle')
export const TreePine = createIcon('TreePine')
export const Sunrise = createIcon('Sunrise')
