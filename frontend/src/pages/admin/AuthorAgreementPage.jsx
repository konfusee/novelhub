import { useState } from 'react'
import { Save } from 'lucide-react'
import { AdminLayout } from '../../layouts'
import { Button, Card } from '../../components/ui'
import { useMockData } from '../../context/MockDataContext'
export function AuthorAgreementPage() {
  const { data, saveAgreement } = useMockData()
  const current = data.agreements['user-author']
  const [share, setShare] = useState(current?.authorShare ?? 80)
  const [message, setMessage] = useState('')
  const platform = 100 - Number(share)
  const valid = Number(share) >= 0 && Number(share) <= 100 && platform >= 0 && platform <= 100
  const save = () => {
    if (!valid) return
    saveAgreement('user-author', share)
    setMessage('Agreement saved to mock storage. The author view now uses this split.')
  }
  return (
    <AdminLayout>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-bold">Mira Lane · Revenue Agreement</h1>
        <p className="mt-2 text-sm text-muted">Financial / Agreement Settings</p>
        <Card className="mt-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Author share
              <input
                type="number"
                min="0"
                max="100"
                value={share}
                onChange={e => setShare(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3"
              />
            </label>
            <label className="text-sm font-semibold">
              NovelHub share
              <input
                readOnly
                value={Number.isFinite(platform) ? platform : ''}
                className="mt-2 w-full rounded-2xl border border-line bg-elevated px-4 py-3"
              />
            </label>
          </div>
          <p className={`mt-4 text-sm ${valid ? 'text-brand' : 'text-rose'}`}>
            Total: {valid ? 100 : Number(share) + platform}% · both values must remain between 0 and
            100.
          </p>
          {message && (
            <p role="status" className="mt-4 rounded-2xl bg-brand/10 p-3 text-sm text-brand">
              {message}
            </p>
          )}
          <Button disabled={!valid} onClick={save} className="mt-6">
            <Save size={16} />
            Save agreement
          </Button>
        </Card>
      </main>
    </AdminLayout>
  )
}
