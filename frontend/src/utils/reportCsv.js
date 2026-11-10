export function reportCsv(headers, rows) {
  const escapeCell = value => {
    let text = String(value ?? '')
    // Treat user-entered names/notes as text when opened in spreadsheet applications.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n')
}

export function downloadReportCsv(filename, headers, rows) {
  const url = URL.createObjectURL(
    new Blob([reportCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
