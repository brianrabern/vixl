export default async (file: File): Promise<File> => {
  const bytes = await file.arrayBuffer()
  return new File([bytes], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  })
}
