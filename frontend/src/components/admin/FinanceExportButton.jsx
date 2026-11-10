import { useState } from 'react'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { downloadReportCsv } from '../../utils/reportCsv'
import { Button } from '../ui'

export function FinanceExportButton({ path, filename, headers, mapRow, disabled }) {
  const { t } = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function exportReport() {
    setBusy(true)
    setError(false)
    try {
      const report = await apiRequest(`${path}&export=csv`)
      if (!Array.isArray(report?.items)) throw new Error('Invalid export response')
      downloadReportCsv(filename, headers, report.items.map(mapRow))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={exportReport}
      >
        {t(busy ? 'financeReports.exporting' : 'financeReports.exportCsv')}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-muted">
          {t('financeReports.exportError')}
        </p>
      )}
    </div>
  )
}
