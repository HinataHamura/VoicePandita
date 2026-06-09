export type DocsSection = {
  id: string
  label: string
  eyebrow: string
  body: string
}

export type DocsTeamMember = {
  name: string
  role: string
  email: string
  image: string
}

export type DocsVersion = {
  id: string
  at: string
  by: string
  note: string
}

export type DocsConfig = {
  enabled: boolean
  startAt: string
  endAt: string
  teamName: string
  sections: DocsSection[]
  team: DocsTeamMember[]
  version: string
  updatedAt: string
  versions: DocsVersion[]
}

export type DocsLiveData = {
  docsStatus: string
  localKeys: number
  sessions: number
  apiCount: number
  featureCount: number
  lastCheckedAt: string
}
