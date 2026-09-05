import type { DetectedInputScript } from '@/lib/language/script'

export type SelectedTab = 'Chakma' | 'Marma' | 'Garo'
export type RouteStatus = 'routable' | 'fallback'

export type RoutingResolverResult = {
  selected_language: SelectedTab
  detected_input_script: DetectedInputScript
  target_language: 'Chakma' | 'Marma' | 'Garo' | 'Bangla'
  target_script: string
  preferred_dataset: string
  route_status: RouteStatus
  fallback_reason: string | null
}

const FALLBACK_ROUTE: Omit<RoutingResolverResult, 'selected_language' | 'detected_input_script'> = {
  target_language: 'Bangla',
  target_script: 'Bengali script',
  preferred_dataset: 'STANDARD_BANGLA_CURRICULUM',
  route_status: 'fallback',
  fallback_reason: 'No routable language-script path matched; fall back to Bangla.',
}

function buildResult(
  selected_language: SelectedTab,
  detected_input_script: DetectedInputScript,
  overrides: Omit<RoutingResolverResult, 'selected_language' | 'detected_input_script'>,
): RoutingResolverResult {
  return {
    selected_language,
    detected_input_script,
    ...overrides,
  }
}

export function resolveLanguageRoute(
  selectedTab: SelectedTab,
  detected_input_script: DetectedInputScript,
): RoutingResolverResult {
  if (selectedTab === 'Chakma') {
    if (detected_input_script === 'Chakma_Native') {
      return buildResult(selectedTab, detected_input_script, {
        ...FALLBACK_ROUTE,
        fallback_reason: 'No verified Chakma Unicode resource is registered; fall back to Bangla.',
      })
    }

    if (detected_input_script === 'Bengali') {
      return buildResult(selectedTab, detected_input_script, {
        target_language: 'Chakma',
        target_script: 'Bengali script',
        preferred_dataset: 'EXCEL_BENGALI_PARALLEL_DATASET',
        route_status: 'routable',
        fallback_reason: null,
      })
    }

    if (detected_input_script === 'Latin') {
      return buildResult(selectedTab, detected_input_script, {
        ...FALLBACK_ROUTE,
        fallback_reason: 'No verified Chakma Latin/Roman resource is registered; fall back to Bangla.',
      })
    }

    return buildResult(selectedTab, detected_input_script, {
      ...FALLBACK_ROUTE,
      fallback_reason: 'Unsupported Chakma input script; fall back to Bangla.',
    })
  }

  if (selectedTab === 'Marma') {
    if (detected_input_script === 'Marma_Myanmar_Block') {
      return buildResult(selectedTab, detected_input_script, {
        ...FALLBACK_ROUTE,
        fallback_reason: 'No verified Marma-script resource is registered; fall back to Bangla. Marma script is a writing system label here, not Burmese/Myanmar language.',
      })
    }

    if (detected_input_script === 'Bengali') {
      return buildResult(selectedTab, detected_input_script, {
        target_language: 'Marma',
        target_script: 'Bengali script',
        preferred_dataset: 'EXCEL_BENGALI_PARALLEL_DATASET',
        route_status: 'routable',
        fallback_reason: null,
      })
    }

    if (detected_input_script === 'Latin') {
      return buildResult(selectedTab, detected_input_script, {
        ...FALLBACK_ROUTE,
        fallback_reason: 'No verified Marma Latin/Roman resource is registered; fall back to Bangla.',
      })
    }

    return buildResult(selectedTab, detected_input_script, {
      ...FALLBACK_ROUTE,
      fallback_reason: 'Unsupported Marma input script; fall back to Bangla.',
    })
  }

  if (selectedTab === 'Garo') {
    if (detected_input_script === 'Bengali') {
      return buildResult(selectedTab, detected_input_script, {
        target_language: 'Garo',
        target_script: 'Bengali script',
        preferred_dataset: 'EXCEL_BENGALI_PARALLEL_DATASET',
        route_status: 'routable',
        fallback_reason: null,
      })
    }

    if (detected_input_script === 'Latin') {
      return buildResult(selectedTab, detected_input_script, {
        ...FALLBACK_ROUTE,
        fallback_reason: 'No verified Garo Latin/Roman resource is registered; fall back to Bangla.',
      })
    }

    return buildResult(selectedTab, detected_input_script, {
      ...FALLBACK_ROUTE,
      fallback_reason: 'Unsupported Garo input script; fall back to Bangla.',
    })
  }

  return {
    selected_language: selectedTab,
    detected_input_script,
    ...FALLBACK_ROUTE,
  }
}
