import DocsClient from '@/components/docs/DocsClient'
import { isDocsVisible } from '@/lib/docs/defaults'
import { readDocsConfig } from '@/lib/docs/store'

export const dynamic = 'force-dynamic'

export default async function DocsAdminPage() {
  const config = await readDocsConfig()
  return <DocsClient initialConfig={config} adminMode initialVisible={isDocsVisible(config)} />
}
