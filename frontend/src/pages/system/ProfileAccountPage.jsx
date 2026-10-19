import { useSearchParams } from 'react-router'
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts'
import { Card, Tabs } from '../../components/ui'
import { ReaderProfilePage } from '../reader/ReaderProfilePage'
import { AccountPage } from './AccountPage'
import { useLocale } from '../../context/LocaleContext'
const layouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
}
export function ProfileAccountPage({ workspace = 'reader' }) {
  const { t } = useLocale()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'account' ? 'account' : 'profile'
  const Layout = layouts[workspace] || ReaderLayout
  return (
    <Layout>
      <div className={'page-' + workspace + ' pt-6 sm:pt-8'}>
        <Card as="header" className="p-6 sm:p-8">
          <p className="nh-eyebrow">{t('account.sharedAccount')}</p>
          <h1 className="mt-3 text-h2 sm:text-h1">{t('account.combinedTitle')}</h1>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted">
            {t('account.combinedDescription')}
          </p>
        </Card>
        <div className="mt-6">
          <Tabs
            value={tab}
            label={t('account.combinedTitle')}
            onChange={value => {
              const next = new URLSearchParams(params)
              next.set('tab', value)
              setParams(next, { replace: true })
            }}
            items={[
              { value: 'profile', label: t('navigation.profile') },
              { value: 'account', label: t('account.securityAndAccess') },
            ]}
          />
        </div>
        <div hidden={tab !== 'profile'}>
          <ReaderProfilePage workspace={workspace} embedded />
        </div>
        <div hidden={tab !== 'account'}>
          <AccountPage workspace={workspace} embedded />
        </div>
      </div>
    </Layout>
  )
}
