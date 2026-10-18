import { ReaderLayout } from '../../layouts';
import { useLocale } from '../../context/LocaleContext';
import { AuthorBankDetails } from '../author/AuthorBankDetails';
import { AuthorPayoutHistory } from '../author/AuthorPayoutHistory';
export function AuthorPayoutsPage() {
  const { t } = useLocale();
  return (
    <ReaderLayout>
      <div className="page-reader py-7">
        <h1 className="text-h2 sm:text-h1">{t('authorFinanceAccess.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{t('authorFinanceAccess.hint')}</p>
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <AuthorPayoutHistory apiBase="/reader/author-finance" />
          </div>
          <div className="min-w-0">
            <AuthorBankDetails apiBase="/reader/author-finance" />
          </div>
        </div>
      </div>
    </ReaderLayout>
  );
}
