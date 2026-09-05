# Same-Language Same-Script Support

## Status

Implemented in main for the `/api/ask` answer pipeline and `/learn` response metadata.

VoicePandita detects the learner language and script from the submitted question, uses curriculum/RAG grounding to produce a Standard Bangla source answer, then localizes the final answer into the detected learner language and script when confidence is high enough.

## Detection Module

Primary function:

```ts
detectLearnerLanguageAndScript(input: string, selectedLanguage?: LearnerLanguage)
```

It returns:

```ts
{
  language: 'bn' | 'en' | 'chakma' | 'garo' | 'marma' | 'unknown'
  script: 'bengali' | 'latin' | 'chakma' | 'myanmar' | 'unknown'
  confidence: number
  shouldFallback: boolean
}
```

The implementation also includes internal debugging fields such as selected language and detection reasons.

## Rules

- Bengali script is detected from the Unicode Bengali range.
- Latin script is detected from English letters.
- Latin script is not treated as English by default.
- Selected Chakma/Garo/Marma is a strong language hint.
- Selected Chakma/Garo/Marma plus Bengali-script input returns that selected language in Bengali script.
- Selected Chakma/Garo/Marma plus Latin-script input returns that selected language in Latin script.
- Clearly English Latin-script questions are detected as English, including when the default Bangla tab is selected.
- Low-confidence or unclear input returns `unknown` and falls back to Standard Bangla.

## Answer Pipeline

1. `/learn` sends the question and selected language tab to `/api/ask`.
2. `/api/ask` calls `detectLearnerLanguageAndScript`.
3. Existing curriculum retrieval and answer grounding run against the question.
4. The grounded Standard Bangla answer is localized with `localizeAnswer`.
5. If detection or localization is uncertain, the API returns a Standard Bangla fallback with fallback metadata.

## UI Behavior

The `/learn` answer card shows:

- Output language/script, for example `উত্তর ভাষা: চাকমা · English horof`
- Detected input language/script, for example `Detected: Chakma · Latin script`
- Confidence percentage
- Fallback badge/message when Standard Bangla fallback is used

## Known Limitations

- Chakma, Garo, and Marma localization quality depends on limited bridge data and model output, so it remains prototype/demo unless verified examples are available.
- Romanized spelling varies by community and dialect.
- Bengali-script Chakma/Garo/Marma can be ambiguous without the selected language tab.
- Low-resource generated output is script-checked, but not a substitute for trusted speaker review.
- Voice output is not native for Chakma/Garo/Marma; text is the authoritative output.
