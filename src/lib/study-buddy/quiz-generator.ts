import { GoogleGenerativeAI } from '@google/generative-ai'
import type { StudyBuddyQuiz } from './types'

const genAI = process.env.GEMINI_API_KEY?.trim()
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim())
  : null

const questionMoves = [
  'main-idea',
  'real-life-example',
  'common-mistake',
  'cause-effect',
  'teach-a-friend',
] as const

const optionIds = ['A', 'B', 'C', 'D']
type QuizOption = { id: string; text: string }

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\wঀ-৿]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasRepeatedQuestionShape(prompts: string[]) {
  const normalized = prompts.map(normalizeText)
  const unique = new Set(normalized)
  if (unique.size !== normalized.length) return true

  const repeatedStems = [
    'কোন উত্তরটি সবচেয়ে যুক্তিযুক্ত',
    'কোনটি সহি',
    'which answer is most logical',
    'concept check',
  ]

  return repeatedStems.some(stem =>
    prompts.filter(p => normalizeText(p).includes(normalizeText(stem))).length > 1,
  )
}

export function isWeakStudyBuddyQuestion(question: { prompt_bn?: string | null; options?: unknown }) {
  const prompt = normalizeText(question.prompt_bn || '')
  if (prompt.length < 12) return true

  const options = Array.isArray(question.options) ? question.options : []
  if (options.length < 4) return true

  const optionTexts = options.map((o: any) => normalizeText(String(o?.text || o || '')))
  if (optionTexts.some(t => t.length < 2)) return true
  if (new Set(optionTexts).size !== optionTexts.length) return true

  const weakStems = ['concept check', 'which answer is most logical']
  return weakStems.some(stem => prompt === normalizeText(stem) || prompt.startsWith(normalizeText(stem)))
}

// ─── Topic-specific fallback quiz library ─────────────────────────────────────
// Used when Gemini is unavailable. Each quiz has 5 real questions about the topic.

type FallbackQ = {
  promptBn: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  hintBn: string
  explanationBn: string
  conceptTag: string
  difficulty: 'easy' | 'medium'
}

type FallbackQuizDef = {
  warmupBn: string
  learningGoalBn: string
  closingSummaryBn: string
  questions: [FallbackQ, FallbackQ, FallbackQ, FallbackQ, FallbackQ]
}

const TOPIC_FALLBACKS: Record<string, FallbackQuizDef> = {
  'periodic table': {
    warmupBn: 'Periodic Table নিয়ে পাঁচটা concept check করি। ব্যক্তিগত তথ্য শেয়ার না করে, বোঝার আনন্দে অংশ নাও।',
    learningGoalBn: 'Periodic Table-এর গঠন, period ও group-এর মানে, আর উপাদানের ধর্মের pattern বোঝা।',
    closingSummaryBn: 'Periodic Table-এর গঠন, group ও period, ধর্মের pattern, এবং Mendeleev-এর অবদান নিয়ে আলোচনা হলো।',
    questions: [
      {
        promptBn: 'Periodic Table-এ একই group-এর উপাদানগুলোর মধ্যে মূল মিলটা কোথায়?',
        options: [
          'এদের valence electron সংখ্যা একই',
          'এদের পারমাণবিক ভর একই',
          'এরা সব ধাতু',
          'এদের neutron সংখ্যা একই',
        ],
        correctIndex: 0,
        hintBn: 'Group মানে হলো একই ধরনের রাসায়নিক ধর্ম। সেটা কোন electron-এর কারণে হয়?',
        explanationBn: 'একই group-এর উপাদানের valence electron (বাইরের কক্ষপথের electron) সংখ্যা একই হয়, তাই তাদের রাসায়নিক ধর্ম মিলে। পারমাণবিক ভর বা neutron সংখ্যা group নির্ধারণ করে না।',
        conceptTag: 'মূল ধারণা',
        difficulty: 'easy',
      },
      {
        promptBn: 'রান্নাঘরের লবণ NaCl-এ Na ও Cl দুটো আলাদা group-এ আছে। এই উদাহরণে Periodic Table-এর কোন ধারণাটা দেখা যায়?',
        options: [
          'আলাদা group-এর উপাদান মিলে যৌগ বানাতে পারে',
          'শুধু একই group-এর উপাদান যৌগ বানায়',
          'Periodic Table-এর শুধু ধাতু কাজে লাগে',
          'লবণে electron থাকে না',
        ],
        correctIndex: 0,
        hintBn: 'Na Group 1, Cl Group 17 — এরা দুজন মিলে stable NaCl বানায়। এটা কীভাবে সম্ভব?',
        explanationBn: 'আলাদা group-এর উপাদানও electron আদান-প্রদান করে stable যৌগ বানাতে পারে। Na একটা electron ছেড়ে দেয়, Cl একটা নেয়। এটাই ionic bonding-এর মূল উদাহরণ।',
        conceptTag: 'বাস্তব উদাহরণ',
        difficulty: 'easy',
      },
      {
        promptBn: 'অনেক student মনে করে Periodic Table-এ উপাদানগুলো পারমাণবিক ভর অনুযায়ী সাজানো। এটা ভুল কারণ কী?',
        options: [
          'সাজানো হয় atomic number (proton সংখ্যা) অনুযায়ী, ভর অনুযায়ী নয়',
          'সাজানো হয় neutron সংখ্যা অনুযায়ী',
          'সাজানো হয় electron সংখ্যা অনুযায়ী',
          'পারমাণবিক ভর আর atomic number সবসময় একই',
        ],
        correctIndex: 0,
        hintBn: 'Mendeleev শুরুতে ভর দিয়ে সাজিয়েছিলেন, কিন্তু পরে কী দিয়ে সাজানো হলো?',
        explanationBn: 'আধুনিক Periodic Table-এ উপাদান সাজানো হয় atomic number বা proton সংখ্যা দিয়ে। Mendeleev প্রথমে ভর ব্যবহার করেছিলেন, তাই কিছু জায়গায় অসংগতি ছিল। Moseley atomic number ব্যবহার করে সেটা সমাধান করেন।',
        conceptTag: 'সাধারণ ভুল',
        difficulty: 'medium',
      },
      {
        promptBn: 'Period-এ বাম থেকে ডানে যাওয়ার সাথে সাথে atomic radius কমে যায়। এর কারণ কী?',
        options: [
          'Proton বাড়ে, nucleus শক্তিশালী হয়, electron গুলো কাছে টানা পড়ে',
          'Electron সংখ্যা কমে যায়',
          'Neutron বাড়ে, atom ভারী হয়ে যায়',
          'নতুন electron shell যোগ হয়',
        ],
        correctIndex: 0,
        hintBn: 'একই period মানে একই shell। কিন্তু proton বাড়লে positive charge বাড়ে — তখন electron-এর কী হয়?',
        explanationBn: 'Period-এ বাম থেকে ডানে গেলে proton বাড়ে কিন্তু নতুন shell আসে না। বেশি proton মানে বেশি positive charge — nucleus electron-গুলোকে আরও জোরে টানে, তাই radius কমে।',
        conceptTag: 'কারণ-ফল',
        difficulty: 'medium',
      },
      {
        promptBn: 'তুমি বন্ধুকে ৩০ সেকেন্ডে Periodic Table কেন দরকার সেটা বোঝাতে চাইছ। সবচেয়ে ভালো শুরু কোনটা?',
        options: [
          '"১১৮টা উপাদান আছে — Table ছাড়া মনে রাখা অসম্ভব। Table দেখে বলা যায় কোনটার ধর্ম কী।"',
          '"এটা পরীক্ষায় আসে তাই মুখস্থ করতে হবে।"',
          '"সব element-এর নাম বাংলায় বলতে পারতে হবে।"',
          '"এটা বুঝতে আগে quantum mechanics জানতে হবে।"',
        ],
        correctIndex: 0,
        hintBn: 'ভালো ব্যাখ্যা শুরু হয় "কেন দরকার" দিয়ে, তারপর সহজ উদাহরণ।',
        explanationBn: 'বন্ধুকে বোঝাতে হলে প্রথমে কাজের কথা বলতে হবে — "এত উপাদান একসাথে বোঝার tool"। পরীক্ষার কথা বললে আগ্রহ কমে, আর quantum mechanics দিয়ে শুরু করলে বন্ধু ভয় পেয়ে যাবে।',
        conceptTag: 'বন্ধুকে শেখাও',
        difficulty: 'easy',
      },
    ],
  },

  "newton's second law": {
    warmupBn: "Newton-এর দ্বিতীয় সূত্র নিয়ে পাঁচটা concept check করি। আমরা নম্বরের জন্য না, বোঝার জন্য খেলব।",
    learningGoalBn: "F = ma সম্পর্কটা নিজের ভাষায় বলা, বাস্তব উদাহরণ, আর সাধারণ ভুল বোঝা।",
    closingSummaryBn: "Newton-এর দ্বিতীয় সূত্রের মূল সম্পর্ক, বাস্তব প্রয়োগ, সাধারণ ভুল, আর কারণ-ফল নিয়ে আলোচনা হলো।",
    questions: [
      {
        promptBn: "F = ma সূত্রে F, m, a-এর সম্পর্কটা নিজের ভাষায় কোনটা সবচেয়ে ভালো বলে?",
        options: [
          "বেশি বল দিলে বেশি ত্বরণ হয়, আর ভারী জিনিস একই বলে কম নড়ে",
          "ভর বাড়লে বল বাড়ে",
          "ত্বরণ সবসময় ধ্রুবক",
          "বল আর ভর সবসময় সমান",
        ],
        correctIndex: 0,
        hintBn: "F বাড়লে a-এর কী হয়? m বাড়লে a-এর কী হয়? দুটো আলাদাভাবে ভাবো।",
        explanationBn: "F = ma মানে বল (F) বাড়লে ত্বরণ (a) বাড়ে, আর ভর (m) বাড়লে একই বলে ত্বরণ কমে। রিকশায় একা বসলে আর দুজন বসলে চালক একই জোরে চাপলেও গতি আলাদা — এটাই এই সূত্র।",
        conceptTag: "মূল ধারণা",
        difficulty: "easy",
      },
      {
        promptBn: "রিকশায় একা বসলে চালক সহজে টানে, কিন্তু তিনজন বসলে কষ্ট হয়। এই উদাহরণে F = ma-র কোন অংশটা দেখা যাচ্ছে?",
        options: [
          "ভর বাড়লে একই বলে ত্বরণ কমে",
          "বল বাড়লে ভর বাড়ে",
          "ত্বরণ সবসময় শূন্য থাকে",
          "ভর কমলে বল বাড়ে",
        ],
        correctIndex: 0,
        hintBn: "চালকের বল একই — তাহলে পার্থক্যটা কোথায়? m বাড়লে a-র কী হয়?",
        explanationBn: "তিনজন মানে বেশি ভর (m)। চালকের বল (F) একই থাকলে a = F/m — m বড় হলে a ছোট হয়। তাই রিকশা ধীরে যায়। এটা F = ma-র সরাসরি প্রয়োগ।",
        conceptTag: "বাস্তব উদাহরণ",
        difficulty: "easy",
      },
      {
        promptBn: "অনেকে মনে করে 'ভারী জিনিস দ্রুত পড়ে'। Newton-এর দ্বিতীয় সূত্র অনুযায়ী এটা ভুল কারণ কী?",
        options: [
          "মাধ্যাকর্ষণে সব বস্তু একই ত্বরণে পড়ে, কারণ F আর m একসাথে বাড়ে",
          "ভারী জিনিসে বল কম লাগে",
          "হালকা জিনিস আগে পড়ে কারণ ভর কম",
          "Newton-এর সূত্র শুধু অনুভূমিক গতিতে কাজ করে",
        ],
        correctIndex: 0,
        hintBn: "ভারী জিনিসে মাধ্যাকর্ষণ বল বেশি, কিন্তু ভরও বেশি। a = F/m — দুটো বাড়লে a-র কী হয়?",
        explanationBn: "ভারী বস্তুতে মাধ্যাকর্ষণ বল বেশি, কিন্তু ভরও বেশি। a = F/m-এ লব আর হর দুটোই সমানুপাতে বাড়ে, তাই a = g ধ্রুবক থাকে। Galileo পাপিসা টাওয়ার থেকে দেখিয়েছিলেন।",
        conceptTag: "সাধারণ ভুল",
        difficulty: "medium",
      },
      {
        promptBn: "একটা ফুটবল কিক করলে বলে তোমার পায়ে কেন ব্যথা লাগে? Newton-এর কোন দিকটা এখানে আছে?",
        options: [
          "তৃতীয় সূত্র — বল পালটা একই বল দেয়, কিন্তু দ্বিতীয় সূত্র বলছে পায়ের ভর বেশি তাই ত্বরণ কম",
          "বল শুধু ফুটবলে লাগে, পায়ে না",
          "ব্যথা মানে বল শূন্য",
          "দ্বিতীয় সূত্রে শুধু একদিকের বল হিসেব হয়",
        ],
        correctIndex: 0,
        hintBn: "তুমি বল দিলে ফুটবলও তোমাকে বল দেয়। পা ভারী বলে ত্বরণ কম, কিন্তু বলটা আসে।",
        explanationBn: "এখানে Newton-এর ৩য় সূত্র (পালটা বল) আর ২য় সূত্র (a = F/m) দুটোই কাজ করছে। ফুটবল পায়ে যে বল দেয় সেটা সমান, কিন্তু পায়ের ভর বেশি তাই ত্বরণ কম — তবুও force টা অনুভব হয় বলে ব্যথা লাগে।",
        conceptTag: "কারণ-ফল",
        difficulty: "medium",
      },
      {
        promptBn: "বন্ধু বলল 'F = ma মানে বুঝি না'। ৩০ সেকেন্ডে কোনটা দিয়ে শুরু করবে?",
        options: [
          "'ধরো রিকশায় একা বসলে সহজে যায়, তিনজন বসলে চালকের কষ্ট হয় — এটাই F = ma।'",
          "'F মানে force, m মানে mass, a মানে acceleration।'",
          "'এটা vector quantity, তাই দিক গুরুত্বপূর্ণ।'",
          "'Newton ১৬৮৭ সালে Principia-তে লিখেছেন।'",
        ],
        correctIndex: 0,
        hintBn: "সংজ্ঞা বা ইতিহাস দিয়ে শুরু না করে চেনা উদাহরণ দিয়ে শুরু করলে বন্ধু আগ্রহ পায়।",
        explanationBn: "চেনা উদাহরণ (রিকশা) দিয়ে শুরু করলে বন্ধু নিজের অভিজ্ঞতার সাথে মেলাতে পারে। তারপর সেই উদাহরণ থেকে সূত্রে যাওয়া সহজ হয়। শুধু সংজ্ঞা বললে মাথায় ঢোকে না।",
        conceptTag: "বন্ধুকে শেখাও",
        difficulty: "easy",
      },
    ],
  },

  'photosynthesis': {
    warmupBn: 'সালোকসংশ্লেষণ নিয়ে পাঁচটা concept check করি। চলো বোঝার আনন্দে অংশ নাও।',
    learningGoalBn: 'সালোকসংশ্লেষণের মূল প্রক্রিয়া, উপাদান, আর শর্ত বোঝা।',
    closingSummaryBn: 'সালোকসংশ্লেষণের কাঁচামাল, আলোর ভূমিকা, chlorophyll, আর O₂ কোথা থেকে আসে তা নিয়ে আলোচনা হলো।',
    questions: [
      {
        promptBn: 'সালোকসংশ্লেষণে গাছ আলো ব্যবহার করে কী বানায়?',
        options: [
          'CO₂ আর জল থেকে গ্লুকোজ ও অক্সিজেন',
          'অক্সিজেন থেকে CO₂',
          'মাটি থেকে খাবার সরাসরি টেনে নেয়',
          'রাতে চিনি থেকে আলো বানায়',
        ],
        correctIndex: 0,
        hintBn: 'সূর্যের আলো কাঁচামাল না — সেটা energy source। কাঁচামাল কী কী?',
        explanationBn: '6CO₂ + 6H₂O + আলো → C₆H₁₂O₆ + 6O₂। গাছ CO₂ আর জল নিয়ে সূর্যের আলোর সাহায্যে গ্লুকোজ বানায় আর O₂ ছাড়ে। মাটি থেকে শুধু জল আর খনিজ আসে, খাবার না।',
        conceptTag: 'মূল ধারণা',
        difficulty: 'easy',
      },
      {
        promptBn: 'বর্ষাকালে ধানক্ষেতে ফসল ভালো হয়, কিন্তু অন্ধকার ঘরে গাছ মরে যায়। এটা কোন ধারণা দেখায়?',
        options: [
          'সালোকসংশ্লেষণে আলো অপরিহার্য',
          'বৃষ্টিতে CO₂ বাড়ে তাই ফসল হয়',
          'গাছ রাতে বেশি খাবার বানায়',
          'অন্ধকারে O₂ বেশি থাকে',
        ],
        correctIndex: 0,
        hintBn: 'দুটো পার্থক্য: আলো আছে/নেই। সালোকসংশ্লেষণে আলোর ভূমিকা কী?',
        explanationBn: 'আলো ছাড়া সালোকসংশ্লেষণ হয় না, তাই অন্ধকারে গাছ খাবার বানাতে পারে না এবং মরে। ধানক্ষেতে সূর্যালোক ও জল দুটোই পায় বলে ফসল ভালো হয়।',
        conceptTag: 'বাস্তব উদাহরণ',
        difficulty: 'easy',
      },
      {
        promptBn: 'অনেকে মনে করে সালোকসংশ্লেষণে উৎপন্ন O₂ CO₂ থেকে আসে। এটা ভুল — আসলে O₂ কোথা থেকে আসে?',
        options: [
          'জলের photolysis থেকে — H₂O ভেঙে O₂ মুক্ত হয়',
          'CO₂ ভেঙে O₂ বের হয়',
          'বাতাসের N₂ রূপান্তরিত হয়',
          'গ্লুকোজ ভাঙলে O₂ বের হয়',
        ],
        correctIndex: 0,
        hintBn: 'Light reaction-এ কী ভাঙে? CO₂ Calvin cycle-এ ব্যবহার হয়।',
        explanationBn: 'Light reaction-এ সূর্যের আলো H₂O ভাঙে (photolysis) — H⁺ গ্লুকোজ বানাতে যায়, O₂ বাতাসে বের হয়। CO₂ Calvin cycle-এ গ্লুকোজে পরিণত হয়, সেখান থেকে O₂ আসে না।',
        conceptTag: 'সাধারণ ভুল',
        difficulty: 'medium',
      },
      {
        promptBn: 'শীতকালে পাতা ঝরে পড়লে গাছ সালোকসংশ্লেষণ কম করে — এর ফলে কী হয়?',
        options: [
          'গাছ সঞ্চিত খাবারে বাঁচে, বৃদ্ধি কমে, O₂ উৎপাদন কমে',
          'গাছ বেশি খাবার বানায়',
          'শিকড় থেকে সালোকসংশ্লেষণ চলে',
          'CO₂ শোষণ বেড়ে যায়',
        ],
        correctIndex: 0,
        hintBn: 'পাতা কম মানে chlorophyll কম, সালোকসংশ্লেষণ কম — chain reaction কী?',
        explanationBn: 'পাতা ঝরলে chlorophyll কমে, সালোকসংশ্লেষণ কমে, গ্লুকোজ কম তৈরি হয়। গাছ আগে সঞ্চিত খাবার ব্যবহার করে বাঁচে, বৃদ্ধি থামে, আর পরিবেশে O₂ কম যায়।',
        conceptTag: 'কারণ-ফল',
        difficulty: 'medium',
      },
      {
        promptBn: 'বন্ধু জিজ্ঞেস করল "গাছ কীভাবে খাবার বানায়?" — ৩০ সেকেন্ডে কোন উত্তর দেবে?',
        options: [
          '"গাছ সূর্যের আলো দিয়ে বাতাসের CO₂ আর মাটির জল থেকে চিনি বানায়, আর O₂ ছাড়ে।"',
          '"গাছ মাটি খেয়ে বড় হয়।"',
          '"Chlorophyll একটা pigment যা light absorb করে।"',
          '"6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ এটা মুখস্থ করো।"',
        ],
        correctIndex: 0,
        hintBn: 'সহজ ভাষায় input আর output বলো — equation মুখস্থ দিয়ে শুরু নয়।',
        explanationBn: 'সহজ ভাষায় কাঁচামাল (আলো, CO₂, জল) আর ফলাফল (চিনি, O₂) বললে বন্ধু সহজে ধরতে পারে। Chlorophyll-এর সংজ্ঞা বা equation দিয়ে শুরু করলে বন্ধু ভয় পেয়ে যাবে।',
        conceptTag: 'বন্ধুকে শেখাও',
        difficulty: 'easy',
      },
    ],
  },

  'ionic bonding': {
    warmupBn: 'Ionic bonding নিয়ে পাঁচটা concept check করি। বোঝার আনন্দে অংশ নাও।',
    learningGoalBn: 'Ionic bonding কীভাবে হয়, কোন উপাদানে হয়, আর এর ধর্ম বোঝা।',
    closingSummaryBn: 'Ionic bonding-এর electron transfer, lattice structure, আর NaCl উদাহরণ নিয়ে আলোচনা হলো।',
    questions: [
      {
        promptBn: 'Ionic bonding-এ দুটো পরমাণুর মধ্যে মূল ঘটনাটা কী?',
        options: [
          'একটা পরমাণু electron ছেড়ে দেয়, আরেকটা নেয় — দুজনই stable হয়',
          'দুটো পরমাণু electron ভাগ করে নেয়',
          'দুটো nucleus একসাথে মিলে যায়',
          'Proton আদান-প্রদান হয়',
        ],
        correctIndex: 0,
        hintBn: 'Covalent bonding-এ sharing হয়। Ionic bonding-এ কী হয়?',
        explanationBn: 'Ionic bonding-এ electron transfer হয় — ধাতু electron ছেড়ে cation হয়, অধাতু electron নিয়ে anion হয়। দুজনই noble gas configuration পায়। Covalent-এ sharing, ionic-এ transfer।',
        conceptTag: 'মূল ধারণা',
        difficulty: 'easy',
      },
      {
        promptBn: 'রান্নাঘরের লবণ NaCl পানিতে গলে বিদ্যুৎ পরিবহন করে। Ionic bonding-এর কোন ধর্মটা এখানে দেখা যায়?',
        options: [
          'পানিতে গললে ions আলাদা হয়ে বিদ্যুৎ বহন করতে পারে',
          'NaCl কঠিন অবস্থায় বিদ্যুৎ পরিবহন করে',
          'লবণে electron নেই তাই বিদ্যুৎ হয় না',
          'শুধু ধাতু বিদ্যুৎ পরিবহন করে',
        ],
        correctIndex: 0,
        hintBn: 'কঠিন NaCl-এ ions আটকা, পানিতে কী হয়?',
        explanationBn: 'কঠিন NaCl-এ Na⁺ আর Cl⁻ lattice-এ আটকা, সরতে পারে না। পানিতে গললে ions মুক্ত হয়ে ঘুরে বেড়ায় — তখন বিদ্যুৎ বহন করতে পারে। এটা ionic compound-এর গুরুত্বপূর্ণ ধর্ম।',
        conceptTag: 'বাস্তব উদাহরণ',
        difficulty: 'easy',
      },
      {
        promptBn: 'অনেকে মনে করে C-O বন্ধন ionic কারণ C আর O আলাদা। এটা ভুল কারণ কী?',
        options: [
          'Ionic bonding শুধু ধাতু ও অধাতুর মধ্যে হয়; C ও O দুটোই অধাতু তাই covalent',
          'C ও O-এর electronegativity একই',
          'CO₂ কোনো bond ছাড়াই থাকে',
          'সব অক্সিজেন যৌগ ionic',
        ],
        correctIndex: 0,
        hintBn: 'Ionic bonding হয় যখন একটা ধাতু, অন্যটা অধাতু। C কি ধাতু?',
        explanationBn: 'Ionic bonding সাধারণত ধাতু (Na, Ca) আর অধাতু (Cl, O)-এর মধ্যে হয়। C আর O দুটোই অধাতু, তাই তারা electron ভাগ করে covalent bond বানায়। CO₂ তাই covalent compound।',
        conceptTag: 'সাধারণ ভুল',
        difficulty: 'medium',
      },
      {
        promptBn: 'NaCl-এর গলনাঙ্ক (801°C) খুব বেশি। Ionic bonding-এর কারণে এটা কেন?',
        options: [
          'Lattice-এ Na⁺ ও Cl⁻ শক্তিশালী electrostatic force-এ আটকা, ভাঙতে অনেক energy লাগে',
          'Na ধাতু বলে গলতে বেশি heat লাগে',
          'Cl গ্যাস বলে সহজে উড়ে না',
          'Ionic compound সবসময় গলে না',
        ],
        correctIndex: 0,
        hintBn: 'Lattice-এ কোটি কোটি ion একসাথে আটকা। এদের আলাদা করতে কী লাগে?',
        explanationBn: 'NaCl lattice-এ Na⁺ আর Cl⁻ alternating pattern-এ সাজানো, শক্তিশালী electrostatic attraction দিয়ে। এই bond ভাঙতে প্রচুর energy লাগে, তাই গলনাঙ্ক অনেক বেশি। Covalent compound যেমন পানি অনেক কম তাপে গলে।',
        conceptTag: 'কারণ-ফল',
        difficulty: 'medium',
      },
      {
        promptBn: 'বন্ধু জিজ্ঞেস করল "ionic bonding কী?" — ৩০ সেকেন্ডে সবচেয়ে ভালো উত্তর কোনটা?',
        options: [
          '"লবণ (NaCl) মনে করো — Na একটা electron ছেড়ে দেয়, Cl সেটা নেয়। দুজনই খুশি হয়ে আটকে থাকে।"',
          '"Electronegativity difference ≥ 1.7 হলে ionic।"',
          '"Lattice energy আর hydration energy-র তুলনা করতে হয়।"',
          '"Ionic মানে electron share করা।"',
        ],
        correctIndex: 0,
        hintBn: 'চেনা উদাহরণ দিয়ে শুরু করো, সংজ্ঞা পরে।',
        explanationBn: 'চেনা উদাহরণ লবণ দিয়ে শুরু করলে বন্ধু সহজে বুঝবে। Electronegativity বা lattice energy দিয়ে শুরু করলে শুনতে চাইবে না। Electron sharing হলো covalent — সেটা বলা ভুল।',
        conceptTag: 'বন্ধুকে শেখাও',
        difficulty: 'easy',
      },
    ],
  },
}

// Normalize topic title for lookup
function lookupTopicFallback(topicTitle: string): FallbackQuizDef | null {
  const key = topicTitle.toLowerCase().trim()
  // direct match
  if (TOPIC_FALLBACKS[key]) return TOPIC_FALLBACKS[key]
  // partial match
  for (const k of Object.keys(TOPIC_FALLBACKS)) {
    if (key.includes(k) || k.includes(key)) return TOPIC_FALLBACKS[k]
  }
  return null
}

function makeQuizFromDef(def: FallbackQuizDef, topicTitle: string): StudyBuddyQuiz {
  return {
    topicTitle,
    learningGoalBn: def.learningGoalBn,
    warmupBn: def.warmupBn,
    closingSummaryBn: def.closingSummaryBn,
    questions: def.questions.map((q, i) => {
      const correctText = q.options[q.correctIndex]
      const rotation = i % optionIds.length
      const rotated = [...q.options.slice(rotation), ...q.options.slice(0, rotation)] as string[]
      const correctId = optionIds[rotated.findIndex(o => o === correctText)]
      return {
        questionOrder: i + 1,
        questionType: 'mcq' as const,
        promptBn: q.promptBn,
        options: rotated.map((text, idx) => ({ id: optionIds[idx], text })),
        correctAnswer: { id: correctId },
        hintBn: q.hintBn,
        explanationBn: q.explanationBn,
        difficulty: q.difficulty,
        conceptTag: q.conceptTag,
      }
    }),
  }
}

// Generic fallback — only used if no topic-specific quiz found
function genericFallbackQuestions(topicTitle: string): StudyBuddyQuiz {
  const moves: Array<{
    promptBn: string
    options: [string, string, string, string]
    correctIndex: 0 | 1 | 2 | 3
    hintBn: string
    explanationBn: string
    conceptTag: string
    difficulty: 'easy' | 'medium'
  }> = [
    {
      promptBn: `${topicTitle} বলতে মূলত কোন ধারণাটা বোঝায়?`,
      options: [
        `${topicTitle}-এর মূল সম্পর্ক বা প্রক্রিয়া`,
        'শুধু একটা সংজ্ঞা মুখস্থ করা',
        'পরীক্ষার প্রশ্ন মনে রাখা',
        'বইয়ের পৃষ্ঠা নম্বর জানা',
      ],
      correctIndex: 0,
      hintBn: `${topicTitle}-এর কেন্দ্রীয় idea কোনটা — সেটা ভাবো।`,
      explanationBn: `${topicTitle} বুঝতে হলে মূল সম্পর্ক বা প্রক্রিয়া জানা দরকার, শুধু সংজ্ঞা মুখস্থ করলে নতুন প্রশ্নে প্রয়োগ করা যায় না।`,
      conceptTag: 'মূল ধারণা',
      difficulty: 'easy',
    },
    {
      promptBn: `${topicTitle} বোঝাতে বাংলাদেশের দৈনন্দিন জীবনে কোন ধরনের উদাহরণ সবচেয়ে কাজে লাগে?`,
      options: [
        'দৈনন্দিন জীবনের চেনা ঘটনায় concept খোঁজা',
        'শুধু বইয়ের উদাহরণ মনে রাখা',
        'বিদেশের উদাহরণ ব্যবহার করা',
        'উদাহরণ ছাড়াই মুখস্থ করা',
      ],
      correctIndex: 0,
      hintBn: 'চেনা ঘটনায় concept দেখলে মনে থাকে বেশি।',
      explanationBn: `দৈনন্দিন জীবনে ${topicTitle} কোথায় দেখা যায় সেটা বুঝলে concept শুধু বইয়ের শব্দ না থেকে বাস্তব হয়ে ওঠে।`,
      conceptTag: 'বাস্তব উদাহরণ',
      difficulty: 'easy',
    },
    {
      promptBn: `${topicTitle} শেখার সময় কোন ভুলটা বোঝাকে দুর্বল করে দেয়?`,
      options: [
        'কারণ না বুঝে উত্তর মুখস্থ করা',
        'নিজের ভাষায় ব্যাখ্যা করা',
        'উদাহরণ দিয়ে যাচাই করা',
        'বন্ধুকে শেখানোর চেষ্টা করা',
      ],
      correctIndex: 0,
      hintBn: 'কোন কাজটা বোঝার বদলে শুধু মুখস্থে ঠেলে দেয়?',
      explanationBn: `কারণ না বুঝে মুখস্থ করলে ${topicTitle} নতুন প্রশ্নে প্রয়োগ করা কঠিন হয়। নিজের ভাষায় বলতে পারা মানে সত্যিকারের বোঝা।`,
      conceptTag: 'সাধারণ ভুল',
      difficulty: 'medium',
    },
    {
      promptBn: `${topicTitle}-এ কারণ ও ফল বোঝার সবচেয়ে ভালো উপায় কোনটা?`,
      options: [
        '"কোন কারণে কী পরিবর্তন হলো?" — এই প্রশ্ন করা',
        'শুধু formula মুখস্থ করা',
        'সবকিছু একই মনে করা',
        'শুধু ফলাফল জানা, কারণ না জানলেও চলে',
      ],
      correctIndex: 0,
      hintBn: '"কেন?" আর "এর ফলে কী?" — দুটো প্রশ্ন একসাথে করো।',
      explanationBn: `${topicTitle}-এ কারণ-ফল ধরতে পারলে শুধু উত্তর না, পেছনের যুক্তিটাও পরিষ্কার হয়। এটা পরীক্ষায় নতুন প্রশ্নে কাজে লাগে।`,
      conceptTag: 'কারণ-ফল',
      difficulty: 'medium',
    },
    {
      promptBn: `বন্ধুকে ৩০ সেকেন্ডে ${topicTitle} বোঝাতে হলে সবচেয়ে ভালো শুরু কোনটা?`,
      options: [
        'সহজ ভাষায় মূল ধারণা, তারপর একটা চেনা উদাহরণ',
        'প্রথমেই কঠিন technical term',
        'শুধু বলব "এটা পরীক্ষায় আসে"',
        'ব্যাখ্যা না দিয়ে উত্তর বলে দেওয়া',
      ],
      correctIndex: 0,
      hintBn: 'সহজ ভাষা আর চেনা উদাহরণ — এই দুটো মিলেই সেরা শুরু।',
      explanationBn: `কাউকে শেখাতে গেলে ${topicTitle} নিজের কাছেও আরও পরিষ্কার হয়। সহজ ভাষায় শুরু করলে বন্ধু মনোযোগ দেয়, technical term দিয়ে শুরু করলে ভয় পেয়ে যায়।`,
      conceptTag: 'বন্ধুকে শেখাও',
      difficulty: 'easy',
    },
  ]

  return {
    topicTitle,
    learningGoalBn: `${topicTitle} নিয়ে মূল ধারণা, বাস্তব উদাহরণ, সাধারণ ভুল, কারণ-ফল, আর বন্ধুকে বোঝানোর অনুশীলন।`,
    warmupBn: `চলো ${topicTitle} নিয়ে ছোট একটা Bondhu practice করি। ব্যক্তিগত তথ্য শেয়ার করো না — আমরা বোঝার জন্য খেলব।`,
    closingSummaryBn: `${topicTitle} নিয়ে পাঁচভাবে ভেবেছ: মূল ধারণা, বাস্তব উদাহরণ, সাধারণ ভুল, কারণ-ফল, আর বন্ধুকে বোঝানো।`,
    questions: moves.map((q, i) => {
      const rotation = i % optionIds.length
      const rotated = [...q.options.slice(rotation), ...q.options.slice(0, rotation)] as string[]
      const correctText = q.options[q.correctIndex]
      const correctId = optionIds[rotated.findIndex(o => o === correctText)]
      return {
        questionOrder: i + 1,
        questionType: 'mcq' as const,
        promptBn: q.promptBn,
        options: rotated.map((text, idx) => ({ id: optionIds[idx], text })),
        correctAnswer: { id: correctId },
        hintBn: q.hintBn,
        explanationBn: q.explanationBn,
        difficulty: q.difficulty,
        conceptTag: q.conceptTag,
      }
    }),
  }
}

function fallbackQuestions(topicTitle: string): StudyBuddyQuiz {
  const specific = lookupTopicFallback(topicTitle)
  if (specific) return makeQuizFromDef(specific, topicTitle)
  return genericFallbackQuestions(topicTitle)
}

function parseQuizJson(text: string, topicTitle: string): StudyBuddyQuiz {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed.questions) || parsed.questions.length !== 5) throw new Error('Quiz must have exactly 5 questions')

  const questions: StudyBuddyQuiz['questions'] = parsed.questions.slice(0, 5).map((q: any, index: number) => {
    const options: QuizOption[] = Array.isArray(q.options)
      ? q.options.slice(0, 4).map((option: any, optionIndex: number) => ({
        id: optionIds.includes(String(option.id)) ? String(option.id) : optionIds[optionIndex],
        text: String(option.text || option).slice(0, 180),
      }))
      : []
    if (options.length !== 4 || options.some(option => !option.text.trim())) throw new Error('Each question needs 4 options')

    const correctId = String(q.correctAnswer?.id || q.correct_answer?.id || 'A').slice(0, 4)
    if (!options.some(option => option.id === correctId)) throw new Error('Correct answer must match an option')

    const promptBn = String(q.promptBn || q.prompt || '').slice(0, 500).trim()
    if (!promptBn) throw new Error('Question prompt is required')

    return {
      questionOrder: index + 1,
      questionType: 'mcq' as const,
      promptBn,
      options,
      correctAnswer: { id: correctId },
      hintBn: String(q.hintBn || q.hint || '').slice(0, 240),
      explanationBn: String(q.explanationBn || q.explanation || '').slice(0, 700),
      difficulty: q.difficulty === 'medium' ? 'medium' as const : 'easy' as const,
      conceptTag: String(q.conceptTag || questionMoves[index] || topicTitle).slice(0, 80),
    }
  })

  if (hasRepeatedQuestionShape(questions.map(question => question.promptBn))) {
    throw new Error('Generated quiz repeated question shapes')
  }

  return {
    topicTitle: String(parsed.topicTitle || topicTitle).slice(0, 120),
    learningGoalBn: String(parsed.learningGoalBn || `${topicTitle} বোঝা`).slice(0, 300),
    warmupBn: String(parsed.warmupBn || 'চলো concept practice করি।').slice(0, 400),
    questions,
    closingSummaryBn: String(parsed.closingSummaryBn || `${topicTitle} summary ready.`).slice(0, 700),
  }
}

export async function generateStudyBuddyQuiz(topicTitle: string, subject?: string | null) {
  if (!genAI) {
    console.warn('[quiz-generator] GEMINI_API_KEY not set — using fallback questions for:', topicTitle)
    return fallbackQuestions(topicTitle)
  }

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash' })
    const result = await model.generateContent(`You are VoicePandita's Bondhu Study Room AI host for Bangladeshi SSC/HSC students.
Generate exactly one 5-question MCQ concept-check session. Return ONLY valid JSON -- no markdown, no preamble.

Topic: "${topicTitle}"
Subject: ${subject || 'general'}

Personality and tone:
- Warm, concise, and peer-friendly like a calm Bangla bondhu study group host.
- Write in simple Bangla. Use English study-words (force, cell, equation) only when they are the standard term.
- Ground examples in Bangladesh daily life: rickshaw, paddy field, bazar, tube well, etc. where topic allows.
- Never ask for personal info. No exam-pressure language.

Question design rules (strictly follow):
1. Each of the 5 prompts MUST use a DIFFERENT learning move in this exact order:
   Q1: Main idea -- ask students to restate the core idea in own words. Be specific to the topic.
   Q2: Real-life example -- ask them to identify the best local/real-world example of this topic.
   Q3: Common mistake -- present a specific misconception about this topic that students actually make.
   Q4: Cause-effect -- ask about a specific cause-to-effect or process chain within this topic.
   Q5: Teach-a-friend -- ask how they would explain this specific topic to a friend in 30 seconds.
2. Each question must name "${topicTitle}" specifically -- NOT generic "which answer is correct"-style.
3. Spread correct answers: use A, B, C, D. Do NOT put correct on A every time.
4. Wrong options must be realistic misconceptions students actually believe -- no silly fillers.
5. Each hint: reasoning nudge without revealing answer (max 40 Bangla words).
6. Each explanation: WHY correct is right AND why most common wrong choice fails (max 90 Bangla words).
7. Difficulty: Q1=easy, Q2=easy, Q3=medium, Q4=medium, Q5=easy.

Return this exact JSON schema (no extra fields, no markdown):
{"topicTitle":"string","learningGoalBn":"string","warmupBn":"string","questions":[{"questionOrder":1,"questionType":"mcq","promptBn":"string","options":[{"id":"A","text":"string"},{"id":"B","text":"string"},{"id":"C","text":"string"},{"id":"D","text":"string"}],"correctAnswer":{"id":"A"},"hintBn":"string","explanationBn":"string","difficulty":"easy","conceptTag":"string"}],"closingSummaryBn":"string"}`)
    return parseQuizJson(result.response.text(), topicTitle)
  } catch (err) {
    console.error('[quiz-generator] Gemini failed, using fallback:', err)
    return fallbackQuestions(topicTitle)
  }
}
