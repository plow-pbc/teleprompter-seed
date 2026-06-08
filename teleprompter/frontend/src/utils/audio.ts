export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === 'string') {
        const base64 = result.includes(',')
          ? result.slice(result.indexOf(',') + 1)
          : result
        resolve(base64)
      } else {
        reject(new Error('Unexpected FileReader result type'))
      }
    }
    reader.onerror = () => {
      reader.abort()
      reject(new Error('Failed to read audio blob'))
    }
    reader.readAsDataURL(blob)
  })
}
