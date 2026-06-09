import chakmaBridgeRows from '@/data/chakma/chakmaBridge.json'

export type ChakmaBridgeDatasetRow = {
  english: string
  bangla: string
  bengaliScriptChakma: string
  romanizedBangla: string
  romanizedChakma: string
}

export function loadChakmaBridgeDataset() {
  return chakmaBridgeRows as ChakmaBridgeDatasetRow[]
}
