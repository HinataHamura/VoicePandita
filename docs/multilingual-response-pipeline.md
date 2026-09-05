# Multilingual Response Pipeline

VoicePandita's multilingual answer pipeline keeps the learner's target language and script preference visible without claiming production-grade native fluency for low-resource languages.

## Same-Language Same-Script Rule

The `/learn` UI sends the selected language tab with the student question. The API detects the input script, prepares a grounded Standard Bangla curriculum answer, then localizes only when verified dataset/local bridge support exists for the requested language-script pair.

Rule:

- Standard Bangla input returns Standard Bangla in Bengali script.
- The selected Chakma/Garo/Marma tab controls the target language intent.
- Bengali-script input requests Bengali-script output.
- Latin input requests Latin/Roman output.
- Chakma Unicode input requests Chakma Unicode output.
- Marma Myanmar-block input requests Marma-script output; it is not treated as Burmese/Myanmar language.
- Bengali script does not override the selected language tab.
- The current low-resource bridge is verified only for Bengali-script localized output where a dataset/local bridge match exists.
- Missing bridge data, native-script support, Roman-script support, or low confidence returns Standard Bangla fallback.

The UI label uses the resolved answer metadata:

- `উত্তর ভাষা: বাংলা`
- `উত্তর ভাষা: চাকমা · বাংলা হরফ`
- `উত্তর ভাষা: চাকমা · English horof`
- `উত্তর ভাষা: গারো · বাংলা হরফ`
- `উত্তর ভাষা: গারো · English horof`
- `উত্তর ভাষা: মারমা · বাংলা হরফ`
- `উত্তর ভাষা: মারমা · English horof`

## Bengali-Script Examples

Bengali-script low-resource examples are questions or answers where the target language is written with Bangla letters.

Examples:

- Chakma tab + exact verified bridge phrase -> `outputLanguage: chakma`, `outputScript: bengali`
- Chakma/Garo/Marma tab + no verified bridge match -> Standard Bangla fallback

Dataset row shape for a Bengali-script example:

```json
{"id":"chakma-bnscript-001","language":"chakma","script":"bengali","domain":"curriculum","grade":"10","subject":"biology","bn":"সালোকসংশ্লেষণে উদ্ভিদ খাদ্য তৈরি করে।","target":"সালোকসংশ্লেষণত গাছ খাদ্য তৈরি করে।","source":"community-reviewed-demo","verified":false,"license":"research-demo"}
```

## Romanized / English-Letter Examples

Romanized examples are target-language examples written with English letters. They are not English translations.

Examples:

- Chakma tab + `photosynthesis ki bhabe hoy` -> `outputLanguage: chakma`, `outputScript: latin`
- Garo tab + `photosynthesis ki bhabe hoy` -> `outputLanguage: garo`, `outputScript: latin`
- Marma tab + `photosynthesis ki bhabe hoy` -> `outputLanguage: marma`, `outputScript: latin`

To add Romanized examples, append JSONL rows to `data/multilingual/sample-parallel.jsonl` with:

- `language`: `chakma`, `garo`, or `marma`
- `script`: `latin`
- `bn`: the grounded Standard Bangla source sentence
- `target`: the Romanized Chakma/Garo/Marma sentence
- `source`: dataset or reviewer provenance
- `verified`: `true` only after trusted language review
- `license`: reuse permission or dataset license

Example:

```json
{"id":"garo-latin-001","language":"garo","script":"latin","domain":"curriculum","grade":"10","subject":"biology","bn":"উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।","target":"Gachrang alo jakkale cha-a dakchaka.","source":"community-review-needed","verified":false,"license":"research-demo"}
```

## Fallback Rules

Fallback is required when:

- language detection confidence is below `LANGUAGE_CONFIDENCE_FALLBACK_THRESHOLD`
- the input language or script is unknown
- no verified dataset/local bridge match exists
- the requested script is unsupported
- the requested native/Roman script lacks verified support
- unverified demo output is disabled in production

When fallback is used, the answer metadata resolves to Bangla/Bengali script and includes:

- `badge: "fallback-standard-bangla"`
- `fallbackReason: "Not enough verified Chakma/Marma/Garo data for confident answer"`

For prototype/demo low-resource output, VoicePandita may return best-effort generated text only behind an explicit feature flag and when it is clearly marked:

- `badge: "unverified-demo"`
- `verified: false`

Unknown Latin input without a selected language tab must fall back safely instead of guessing Chakma, Garo, or Marma.

## Dataset Requirements

Demo rows are loaded by `src/lib/multilingual/datasets.ts` from `data/multilingual/sample-parallel.jsonl`. Production-safe Bengali-script bridge rows are normalized by `src/lib/multilingual/localBridge.ts` from named bridge files such as `data/multilingual/localization-bridge.jsonl` and the existing Chakma Bengali-script bridge.

Each row must include:

- stable `id`
- supported `language`
- supported `script`
- `domain`
- Standard Bangla `bn`
- target-language `target`
- `source`
- `verified`
- `license`

Use `verified: false` for demo, machine-generated, or unreviewed rows. Use `verified: true` only for examples reviewed by trusted speakers or sourced from a reliable licensed dataset.

## Known Limitations

- Current Chakma/Garo/Marma coverage is limited and should fall back unless rows are verified and script-compatible.
- Romanized spelling can vary by community, dialect, and contributor.
- Bengali-script low-resource text can be ambiguous without the selected tab.
- Native Chakma Unicode, Marma script, and Romanized support are separate from Bengali-script support and currently fall back unless verified resources are added.
- The UI does not fake native TTS. Romanized Chakma/Garo/Marma answers are text-first, with the note `এই ভাষার ভয়েস এখনো পরীক্ষামূলক।` when shown.

## Future Work

- Add community-reviewed curriculum examples for each language/script pair.
- Track reviewer, dialect, consent, and license metadata separately from demo rows.
- Add per-language normalization rules for Romanized spelling variants.
- Add stronger automated checks that generated output preserves script.
- Add verified low-resource voice support only when the provider truly supports the language.
