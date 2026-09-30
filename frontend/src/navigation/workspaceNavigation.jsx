import {
  BarChart3, BookHeart, BookOpen, Bot, Boxes, CircleDollarSign, CirclePlus,
  ClipboardCheck, Compass, FileClock, FileSearch, FileText, Flag, FolderTree,
  Gauge, Headphones, History, Home, Images, LayoutDashboard, Library, MessageCircle,
  PenLine, Scale, Search, Send, ShieldAlert, ShieldCheck, SlidersHorizontal,
  UserCog, UserRoundCheck, UsersRound, WalletCards,
} from 'lucide-react'

export const workspaceMeta = {
  reader: { label: 'Reader', home: '/reader' },
  author: { label: 'Author Studio', home: '/author' },
  moderator: { label: 'Moderator', home: '/moderator' },
  admin: { label: 'Admin', home: '/admin' },
}

export const workspaceNavigation = {
  reader: [
    { label: 'Main', items: [
      ['Home', '/reader', Home, true], ['Discover', '/', Compass],
      ['Explore', '/reader/explore', Search], ['Library', '/reader/library', Library],
      ['My List', '/reader/following', BookHeart],
    ] },
    { label: 'Activity', items: [
      ['Audiobooks', '/reader/audiobooks', Headphones], ['History', '/reader/history', History],
      ['Messages', '/reader/messages', MessageCircle], ['Wallet', '/reader/wallet', WalletCards],
    ] },
  ],
  author: [
    { label: 'Main', items: [
      ['Dashboard', '/author', LayoutDashboard, true], ['My Stories', '/author/stories/demo', BookOpen],
      ['Drafts', '/author/drafts', FileClock], ['New Story', '/author/stories/new', CirclePlus],
    ] },
    { label: 'Create', items: [
      ['Chapter Editor', '/author/stories/demo/chapters/chapter-1/edit', PenLine],
      ['Import PDF', '/author/import', FileText], ['Media Library', '/author/media', Images],
      ['AI Assistant', '/author/ai', Bot],
    ] },
    { label: 'Publish', items: [
      ['Submissions', '/author/submissions', Send], ['Analytics', '/author/analytics', BarChart3],
      ['Revenue', '/author/earnings', CircleDollarSign],
    ] },
  ],
  moderator: [
    { label: 'Moderation', items: [
      ['Dashboard', '/moderator', Gauge, true], ['Pending Reviews', '/moderator/submissions', ClipboardCheck],
      ['Content Reviews', '/moderator/reviews', FileSearch], ['Reports', '/moderator/reports', Flag],
      ['Similarity Flags', '/moderator/similarity-flags', ShieldAlert],
    ] },
    { label: 'History', items: [
      ['Decisions', '/moderator/decisions', UserRoundCheck], ['Escalations', '/moderator/escalations', Scale],
      ['Audit Trail', '/moderator/audit-trail', History],
    ] },
  ],
  admin: [
    { label: 'Main', items: [['Dashboard', '/admin', LayoutDashboard, true]] },
    { label: 'Management', items: [
      ['Users', '/admin/users', UsersRound], ['Roles', '/admin/roles', UserCog],
      ['Categories', '/admin/categories', FolderTree], ['Content', '/admin/content', SlidersHorizontal],
    ] },
    { label: 'Platform', items: [
      ['Services', '/admin/services', Boxes], ['Audit Logs', '/admin/audit-logs', History],
      ['Moderation', '/admin/moderation', ShieldCheck], ['Transactions', '/admin/transactions', WalletCards],
    ] },
  ],
}
