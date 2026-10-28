/** Gives the user a file to save, made here: nothing is sent anywhere. */
export function downloadFile(text: string, name: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}
