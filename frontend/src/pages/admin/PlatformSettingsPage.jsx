import { AdminLayout } from '../../layouts'
import { PolicySettingsPanel } from './PolicySettingsPanel'
import { useLocale } from '../../context/LocaleContext'
export function PlatformSettingsPage() {
  const { t } = useLocale()
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <h1 className="text-h2 sm:text-h1">{t('policy.title')}</h1>
        <p className="mt-2 text-muted">{t('policy.description')}</p>
        <PolicySettingsPanel />
      </div>
    </AdminLayout>
  )
}
