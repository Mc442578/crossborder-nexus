export function mapSearchResults(data) {
  if (!Array.isArray(data?.results)) return []

  return data.results.map((item) => ({
    title: typeof item?.title === 'string' ? item.title : '',
    url: typeof item?.url === 'string' ? item.url : '',
    snippet: typeof item?.content === 'string' ? item.content : '',
  }))
}
