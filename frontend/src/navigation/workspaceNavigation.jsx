import {
  BarChart3,
  Bell,
  BookHeart,
  BookOpen,
  Bot,
  Boxes,
  CircleDollarSign,
  CirclePlus,
  ClipboardCheck,
  Compass,
  FileClock,
  FileSearch,
  FileText,
  Flag,
  FolderTree,
  Gauge,
  Headphones,
  History,
  Home,
  Images,
  LayoutDashboard,
  Library,
  MessageCircle,
  PenLine,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from '../components/icons';
import { ROUTES } from '../app/routes';

export const workspaceMeta = {
  reader: { labelKey: 'navigation.reader', home: '/reader' },
  author: { labelKey: 'navigation.authorStudio', home: '/author' },
  moderator: { labelKey: 'navigation.moderator', home: '/moderator' },
  admin: { labelKey: 'navigation.admin', home: '/admin' },
};

export const workspaceNavigation = {
  reader: [
    {
      labelKey: 'navigation.main',
      items: [
        ['navigation.home', '/reader', Home, true],
        ['navigation.discover', '/', Compass],
        ['navigation.explore', '/reader/explore', Search],
        ['navigation.library', '/reader/library', Library],
        ['navigation.myList', '/reader/following', BookHeart],
        ['navigation.becomeAuthor', ROUTES.authorApply, PenLine],
      ],
    },
    {
      labelKey: 'navigation.activity',
      items: [
        ['navigation.audiobooks', '/reader/audiobooks', Headphones],
        ['navigation.history', '/reader/history', History],
        ['common.notifications', '/reader/notifications', Bell],
        ['navigation.messages', '/reader/messages', MessageCircle],
        ['navigation.wallet', '/reader/wallet', WalletCards],
      ],
    },
  ],
  author: [
    {
      labelKey: 'navigation.main',
      items: [
        ['navigation.dashboard', '/author', LayoutDashboard, true],
        ['navigation.storyManager', '/author/stories', BookOpen],
        ['navigation.drafts', '/author/drafts', FileClock],
        ['navigation.newStory', '/author/stories/new', CirclePlus],
      ],
    },
    {
      labelKey: 'navigation.create',
      items: [
        ['navigation.chapterEditor', '/author/editor', PenLine],
        ['navigation.importPdf', '/author/import', FileText],
        ['navigation.mediaLibrary', '/author/media', Images],
        ['navigation.aiAssistant', '/author/ai', Bot],
      ],
    },
    {
      labelKey: 'navigation.publish',
      items: [
        ['navigation.submissions', '/author/submissions', Send],
        ['navigation.analytics', '/author/analytics', BarChart3],
        ['navigation.revenue', '/author/earnings', CircleDollarSign],
      ],
    },
  ],
  moderator: [
    {
      labelKey: 'navigation.moderation',
      items: [
        ['navigation.dashboard', '/moderator', Gauge, true],
        ['navigation.pendingReviews', '/moderator/submissions', ClipboardCheck],
        ['navigation.contentReviews', '/moderator/reviews', FileSearch],
        ['navigation.reports', '/moderator/reports', Flag],
        ['navigation.similarityFlags', '/moderator/similarity-flags', ShieldAlert],
      ],
    },
    {
      labelKey: 'navigation.history',
      items: [
        ['navigation.decisions', '/moderator/decisions', UserRoundCheck],
        ['navigation.escalations', '/moderator/escalations', Scale],
        ['navigation.auditTrail', '/moderator/audit-trail', History],
      ],
    },
  ],
  admin: [
    {
      labelKey: 'navigation.main',
      items: [['navigation.dashboard', '/admin', LayoutDashboard, true]],
    },
    {
      labelKey: 'navigation.management',
      items: [
        ['navigation.users', '/admin/users', UsersRound],
        ['navigation.roles', '/admin/roles', UserCog],
        ['navigation.categories', '/admin/categories', FolderTree],
        ['navigation.content', '/admin/content', SlidersHorizontal],
      ],
    },
    {
      labelKey: 'navigation.platform',
      items: [
        ['navigation.platformSettings', '/admin/settings', SlidersHorizontal],
        ['navigation.services', '/admin/services', Boxes],
        ['navigation.auditLogs', '/admin/audit-logs', History],
        ['navigation.moderation', '/admin/moderation', ShieldCheck],
        ['navigation.transactions', '/admin/transactions', WalletCards],
      ],
    },
  ],
};
