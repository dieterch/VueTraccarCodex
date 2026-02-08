export const useDocuments = () => {
  // Get document by key
  const getDocument = async (key: string): Promise<string> => {
    try {
      const response = await $fetch<{ content: string }>(`/api/document/${key}`)
      return response.content
    } catch (error) {
      console.error(`Error fetching document ${key}:`, error)
      throw error
    }
  }

  // Save document by key
  const saveDocument = async (key: string, content: string): Promise<void> => {
    try {
      await $fetch(`/api/document/${key}`, {
        method: 'POST',
        body: { content }
      })
      console.log(`Document ${key} saved successfully`)
    } catch (error) {
      console.error(`Error saving document ${key}:`, error)
      throw error
    }
  }

  return {
    getDocument,
    saveDocument
  }
}
