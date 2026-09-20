import { GoogleGenerativeAI } from '@google/generative-ai'
import { geminiTextModels } from '@/lib/ai/models'
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
  "ohm's law": {
    warmupBn: "Ohm's Law নিয়ে পাঁচটা concept check করি। বোঝার আনন্দে অংশ নাও।",
    learningGoalBn: 'V = IR সম্পর্কটা নিজের ভাষায় বলা, বাস্তব উদাহরণ, আর সাধারণ ভুল বোঝা।',
    closingSummaryBn: "Ohm's Law-এর মূল সম্পর্ক, বাস্তব প্রয়োগ, সাধারণ ভুল, আর কারণ-ফল নিয়ে আলোচনা হলো।",
    questions: [
      {
        promptBn: 'V = IR সূত্রে ভোল্টেজ (V), কারেন্ট (I), আর রোধ (R)-এর সম্পর্কটা নিজের ভাষায় কোনটা সবচেয়ে ভালো বলে?',
        options: [
          'ভোল্টেজ বাড়লে কারেন্ট বাড়ে, রোধ বাড়লে একই ভোল্টেজে কারেন্ট কমে',
          'কারেন্ট বাড়লে রোধ বাড়ে',
          'ভোল্টেজ আর রোধ সবসময় সমান',
          'রোধ শূন্য হলে কারেন্টও শূন্য হয়',
        ],
        correctIndex: 0,
        hintBn: 'I = V/R। V বাড়লে I-এর কী হয়? R বাড়লে I-এর কী হয়?',
        explanationBn: 'V = IR মানে I = V/R। ভোল্টেজ বেশি হলে বেশি কারেন্ট বয়, কিন্তু রোধ বেশি হলে একই ভোল্টেজে কম কারেন্ট বয়। তার আর বাল্বের রোধ এভাবেই কারেন্ট নিয়ন্ত্রণ করে।',
        conceptTag: 'মূল ধারণা',
        difficulty: 'easy',
      },
      {
        promptBn: 'শীতকালে হিটার কয়েলের তার গরম হয়ে লাল হয়ে যায়, কিন্তু সংযোগ তার ঠান্ডা থাকে। এখানে Ohm\'s Law-এর কোন ধারণাটা দেখা যায়?',
        options: [
          'কয়েলের রোধ বেশি বলে বেশি তাপ উৎপন্ন হয়, সংযোগ তারের রোধ কম',
          'কয়েলে কারেন্ট যায় না',
          'সংযোগ তারে ভোল্টেজ বেশি',
          'রোধের সাথে তাপের সম্পর্ক নেই',
        ],
        correctIndex: 0,
        hintBn: 'একই কারেন্ট দুই জায়গা দিয়ে যায়, কিন্তু রোধ আলাদা। রোধ বেশি হলে কী হয়?',
        explanationBn: 'হিটার কয়েলের রোধ ইচ্ছাকৃতভাবে বেশি রাখা হয় (নিক্রোম তার), তাই কারেন্ট গেলে বেশি তাপ উৎপন্ন হয় (I²R)। সংযোগ তারের রোধ কম বলে তেমন তাপ হয় না।',
        conceptTag: 'বাস্তব উদাহরণ',
        difficulty: 'easy',
      },
      {
        promptBn: "অনেকে মনে করে রোধ বাড়লে ভোল্টেজ বাড়ে। Ohm's Law অনুযায়ী এটা ভুল কারণ কী?",
        options: [
          'নির্দিষ্ট ভোল্টেজ উৎসে রোধ বাড়লে কারেন্ট কমে, ভোল্টেজ উৎসের মান পরিবর্তন হয় না',
          'রোধ বাড়লে সবসময় ভোল্টেজও বাড়ে',
          'রোধ আর ভোল্টেজ সবসময় বিপরীতভাবে বাড়ে-কমে',
          'ভোল্টেজ উৎস রোধ অনুযায়ী নিজে বদলে যায়',
        ],
        correctIndex: 0,
        hintBn: 'ব্যাটারির ভোল্টেজ ধ্রুবক থাকে ধরে নাও। তাহলে R বাড়লে I-এর কী হয়, V-এর কী হয়?',
        explanationBn: 'সাধারণত ব্যাটারি/উৎসের ভোল্টেজ নির্দিষ্ট থাকে। R বাড়লে I = V/R অনুযায়ী কারেন্ট কমে, ভোল্টেজ উৎস নিজে বদলায় না। ভোল্টেজ আর রোধের মধ্যে সরাসরি সমানুপাতিক সম্পর্ক ভাবাটা ভুল।',
        conceptTag: 'সাধারণ ভুল',
        difficulty: 'medium',
      },
      {
        promptBn: 'তার পাতলা ও লম্বা হলে রোধ বেড়ে যায়। এর ফলে সার্কিটে কারেন্টের কী পরিবর্তন হয়?',
        options: [
          'রোধ বাড়ার কারণে একই ভোল্টেজে কারেন্ট কমে যায়',
          'কারেন্ট বেড়ে যায়',
          'কারেন্টের কোনো পরিবর্তন হয় না',
          'ভোল্টেজ নিজে থেকে বেড়ে কারেন্ট ঠিক রাখে',
        ],
        correctIndex: 0,
        hintBn: 'তার পাতলা-লম্বা মানে রোধ বেশি। I = V/R-এ R বাড়লে I-এর কী হয়?',
        explanationBn: 'তার পাতলা ও লম্বা হলে ইলেকট্রনের চলাচলে বাধা বেশি পড়ে, তাই রোধ বাড়ে। V অপরিবর্তিত থাকলে I = V/R অনুযায়ী কারেন্ট কমে যায়। এই কারণেই মোটা তার কম রোধ দেয়।',
        conceptTag: 'কারণ-ফল',
        difficulty: 'medium',
      },
      {
        promptBn: "বন্ধু জিজ্ঞেস করল \"Ohm's Law কী?\" — ৩০ সেকেন্ডে সবচেয়ে ভালো উত্তর কোনটা?",
        options: [
          '"ধরো পানির পাইপ — ভোল্টেজ মানে চাপ, রোধ মানে পাইপের সরুতা। চাপ বেশি বা পাইপ চওড়া হলে পানি (কারেন্ট) বেশি যায়।"',
          '"V = IR এটা মুখস্থ করো, পরীক্ষায় লিখতে হবে।"',
          '"এটা শুধু ধাতুর জন্য প্রযোজ্য একটা জটিল সূত্র।"',
          '"রোধের একক ওহম, এটাই মূল কথা।"',
        ],
        correctIndex: 0,
        hintBn: 'পানির পাইপের সাথে তুলনা করলে বন্ধু সহজে কল্পনা করতে পারে।',
        explanationBn: 'পানির পাইপের উপমা (চাপ=ভোল্টেজ, সরুতা=রোধ, প্রবাহ=কারেন্ট) ব্যবহার করলে বিমূর্ত ধারণাটা চোখে দেখা যায়। শুধু সূত্র বা একক মুখস্থ বলা দিলে বন্ধু আসল সম্পর্কটা বোঝে না।',
        conceptTag: 'বন্ধুকে শেখাও',
        difficulty: 'easy',
      },
    ],
  },

  'wave motion': {
    warmupBn: 'Wave Motion নিয়ে পাঁচটা concept check করি। বোঝার আনন্দে অংশ নাও।',
    learningGoalBn: 'তরঙ্গের মূল ধারণা, বৈশিষ্ট্য (তরঙ্গদৈর্ঘ্য, কম্পাঙ্ক, বেগ), আর সাধারণ ভুল বোঝা।',
    closingSummaryBn: 'তরঙ্গের সংজ্ঞা, শক্তি সঞ্চালন, v = fλ সম্পর্ক, আর transverse-longitudinal পার্থক্য নিয়ে আলোচনা হলো।',
    questions: [
      {
        promptBn: 'তরঙ্গ (Wave) গতি বলতে মূলত কী বোঝায় — নিজের ভাষায় কোনটা সবচেয়ে ভালো বলে?',
        options: [
          'মাধ্যমের কণা নিজে স্থানান্তরিত না হয়ে শুধু শক্তি এক জায়গা থেকে আরেক জায়গায় সঞ্চালিত হয়',
          'মাধ্যমের কণাগুলো উৎস থেকে গন্তব্যে স্থানান্তরিত হয়',
          'শুধু শব্দের ক্ষেত্রে প্রযোজ্য একটা ঘটনা',
          'পানি ছাড়া তরঙ্গ তৈরি হতে পারে না',
        ],
        correctIndex: 0,
        hintBn: 'পুকুরে ঢিল ফেললে পানির কণা কি সরে যায়, নাকি শুধু ঢেউ (শক্তি) ছড়িয়ে পড়ে?',
        explanationBn: 'তরঙ্গে মাধ্যমের কণা তার নিজের জায়গায় কম্পিত হয় মাত্র, শক্তিটাই সামনে এগিয়ে যায়। পুকুরে ভাসমান পাতা ঢেউয়ের সাথে দূরে যায় না, শুধু ওঠানামা করে — এটাই প্রমাণ করে শক্তি সঞ্চালিত হচ্ছে, বস্তু নয়।',
        conceptTag: 'মূল ধারণা',
        difficulty: 'easy',
      },
      {
        promptBn: 'পুকুরে ঢিল ফেললে পানিতে ভাসমান একটা কাগজের নৌকা শুধু ওপর-নিচ করে, দূরে সরে যায় না। এটা তরঙ্গের কোন ধর্ম দেখায়?',
        options: [
          'তরঙ্গ শক্তি বহন করে, কিন্তু মাধ্যমকে স্থায়ীভাবে সরায় না',
          'নৌকা তরঙ্গের গতিতে বাধা দিচ্ছে',
          'পানি তরঙ্গের সাথে সাথে এগিয়ে যাচ্ছে',
          'তরঙ্গদৈর্ঘ্য শূন্য হয়ে গেছে',
        ],
        correctIndex: 0,
        hintBn: 'নৌকাটা যদি পানির কণার মতোই আচরণ করে, আর পানির কণা শুধু কাঁপে, তাহলে নৌকারও কী হওয়া উচিত?',
        explanationBn: 'তরঙ্গ শক্তি বহন করে সামনে এগোয়, কিন্তু মাধ্যমের প্রতিটি কণা (এখানে নৌকা) নিজের অবস্থানের কাছেই দোলে। এটাই তরঙ্গ আর প্রবাহের (যেমন স্রোত) মধ্যে মূল পার্থক্য।',
        conceptTag: 'বাস্তব উদাহরণ',
        difficulty: 'easy',
      },
      {
        promptBn: 'অনেকে মনে করে তরঙ্গের বেগ (v), কম্পাঙ্ক (f) আর তরঙ্গদৈর্ঘ্য (λ) একে অপর থেকে সম্পূর্ণ স্বাধীন। এটা ভুল কারণ কী?',
        options: [
          'v = fλ সম্পর্ক অনুযায়ী তিনটা রাশি একসাথে যুক্ত — মাধ্যম একই থাকলে f বাড়লে λ কমে',
          'v, f, λ কোনো সূত্রে যুক্ত নয়',
          'শুধু আলোর তরঙ্গে এই সম্পর্ক খাটে',
          'মাধ্যম বদলালেও f সবসময় স্থির থাকে না',
        ],
        correctIndex: 0,
        hintBn: 'v = fλ — একই মাধ্যমে v প্রায় ধ্রুবক থাকে। তাহলে f বাড়লে λ-এর কী হওয়া উচিত?',
        explanationBn: 'v = fλ সূত্র অনুযায়ী নির্দিষ্ট মাধ্যমে তরঙ্গবেগ প্রায় ধ্রুবক থাকে, তাই কম্পাঙ্ক বাড়লে তরঙ্গদৈর্ঘ্য কমে এবং উল্টোটাও সত্য। তিনটা রাশি স্বাধীন নয়, একে অপরের সাথে গাণিতিকভাবে যুক্ত।',
        conceptTag: 'সাধারণ ভুল',
        difficulty: 'medium',
      },
      {
        promptBn: 'পানির গভীরতা কমে গেলে (যেমন সমুদ্রতীরের কাছে) ঢেউয়ের বেগ কমে যায়। এর ফলে সাধারণত কী ঘটে?',
        options: [
          'কম্পাঙ্ক প্রায় একই থাকে বলে তরঙ্গদৈর্ঘ্য কমে যায় এবং ঢেউ উঁচু হয়ে ভাঙে',
          'তরঙ্গদৈর্ঘ্য বেড়ে যায় আর ঢেউ সমান থাকে',
          'কম্পাঙ্ক শূন্য হয়ে যায়',
          'শক্তি সম্পূর্ণ নষ্ট হয়ে যায় তাই ঢেউ থেমে যায়',
        ],
        correctIndex: 0,
        hintBn: 'উৎসের কম্পাঙ্ক বদলায় না। v কমলে, v = fλ অনুযায়ী λ-এর কী হয়?',
        explanationBn: 'কম্পাঙ্ক প্রায় অপরিবর্তিত থাকে, কিন্তু গভীরতা কমায় বেগ কমে যায়, তাই v = fλ অনুযায়ী তরঙ্গদৈর্ঘ্য কমে। একই শক্তি ছোট দৈর্ঘ্যে জমা হয় বলে ঢেউ উঁচু ও খাড়া হয়ে তীরে আছড়ে পড়ে।',
        conceptTag: 'কারণ-ফল',
        difficulty: 'medium',
      },
      {
        promptBn: 'বন্ধু জিজ্ঞেস করল "Wave motion কী?" — ৩০ সেকেন্ডে সবচেয়ে ভালো উত্তর কোনটা?',
        options: [
          '"পুকুরে ঢিল ফেললে যেমন ঢেউ ছড়ায় কিন্তু পানি নিজে জায়গা বদলায় না — তেমনি তরঙ্গ মাধ্যমকে না সরিয়ে শুধু শক্তি বহন করে নিয়ে যায়।"',
          '"v = fλ, এটা মুখস্থ রাখলেই হবে।"',
          '"তরঙ্গ মানে বস্তু এক জায়গা থেকে আরেক জায়গায় চলে যাওয়া।"',
          '"এটা শুধু পদার্থবিজ্ঞানের জটিল অধ্যায়, বোঝা কঠিন।"',
        ],
        correctIndex: 0,
        hintBn: 'চেনা উদাহরণ (পুকুরের ঢেউ) দিয়ে শুরু করলে ধারণাটা চোখে ভাসে।',
        explanationBn: 'পুকুরের ঢেউয়ের মতো চেনা দৃশ্য দিয়ে বোঝালে "শক্তি সঞ্চালন, বস্তু নয়" ধারণাটা সহজে ধরা পড়ে। সূত্র মুখস্থ বলা বা ভুল সংজ্ঞা (বস্তু সরে যাওয়া) দিয়ে শুরু করলে বন্ধু ভুল বুঝবে।',
        conceptTag: 'বন্ধুকে শেখাও',
        difficulty: 'easy',
      },
    ],
  },

  'refraction of light': {
    warmupBn: 'Refraction of Light নিয়ে পাঁচটা concept check করি। বোঝার আনন্দে অংশ নাও।',
    learningGoalBn: 'আলোর প্রতিসরণ কেন হয়, কোন দিকে বাঁকে, আর বাস্তব উদাহরণ বোঝা।',
    closingSummaryBn: 'প্রতিসরণের কারণ (আলোর বেগ পরিবর্তন), ঘন-হালকা মাধ্যমে বাঁকার দিক, আর বাস্তব উদাহরণ নিয়ে আলোচনা হলো।',
    questions: [
      {
        promptBn: 'আলোর প্রতিসরণ (Refraction) বলতে মূলত কী বোঝায় — নিজের ভাষায় কোনটা সবচেয়ে ভালো বলে?',
        options: [
          'এক মাধ্যম থেকে অন্য মাধ্যমে যাওয়ার সময় আলোর বেগ বদলায়, তাই আলো তার দিক (পথ) বদলে বেঁকে যায়',
          'আলো একটা মাধ্যমের গায়ে বাধা পেয়ে ফিরে আসে',
          'আলো মাধ্যম পরিবর্তনে সম্পূর্ণ বন্ধ হয়ে যায়',
          'শুধু পানিতে ঢুকলেই আলো বাঁকে, অন্য মাধ্যমে না',
        ],
        correctIndex: 0,
        hintBn: 'প্রতিফলন (reflection) আর প্রতিসরণ (refraction) এক জিনিস না। প্রতিসরণে আলো মাধ্যম পার হয়ে যায়, কিন্তু কীভাবে?',
        explanationBn: 'প্রতিসরণে আলো একটা স্বচ্ছ মাধ্যম থেকে আরেকটায় ঢোকে, কিন্তু ঘনত্ব ভিন্ন হওয়ায় বেগ বদলে যায় বলে দিক বেঁকে যায়। এটা প্রতিফলনের (bounce back) থেকে আলাদা — প্রতিসরণে আলো মাধ্যম ভেদ করে এগিয়ে যায়।',
        conceptTag: 'মূল ধারণা',
        difficulty: 'easy',
      },
      {
        promptBn: 'গ্লাসে রাখা পেনসিল পানির মধ্যে ডুবানো অংশে বাঁকা দেখায়। এটা প্রতিসরণের কোন উদাহরণ?',
        options: [
          'পানি থেকে চোখে (হালকা মাধ্যমে) আসার সময় আলো বেঁকে যায় বলে পেনসিল ভাঙা মনে হয়',
          'পেনসিল সত্যিই বেঁকে যায়',
          'পানি আলো সম্পূর্ণ শোষণ করে নেয়',
          'চোখের ভুলে কোনো আলো জড়িত নেই',
        ],
        correctIndex: 0,
        hintBn: 'পেনসিল আসলে সোজাই আছে। তাহলে চোখে বাঁকা লাগার কারণ আলোর কোন ঘটনা?',
        explanationBn: 'পানির নিচের অংশ থেকে আসা আলো পানি ছেড়ে বাতাসে ঢোকার সময় বেঁকে যায় (প্রতিসরণ), তাই মস্তিষ্ক পেনসিলের সেই অংশকে ভিন্ন অবস্থানে দেখে ভাবে — ফলে পেনসিল ভাঙা মনে হয়, আসলে ভাঙে না।',
        conceptTag: 'বাস্তব উদাহরণ',
        difficulty: 'easy',
      },
      {
        promptBn: 'অনেকে মনে করে ঘন মাধ্যমে (যেমন কাচ) ঢুকলে আলো নিজের গতিপথ থেকে লম্ব রেখা থেকে দূরে সরে যায়। এটা ভুল কারণ কী?',
        options: [
          'হালকা থেকে ঘন মাধ্যমে গেলে আলো লম্বের কাছে সরে আসে (বেগ কমে বলে), দূরে না',
          'ঘন মাধ্যমে আলো মোটেও বাঁকে না',
          'ঘন মাধ্যমে আলোর বেগ বেড়ে যায়',
          'লম্ব রেখার সাথে প্রতিসরণের কোনো সম্পর্ক নেই',
        ],
        correctIndex: 0,
        hintBn: 'ঘন মাধ্যমে আলোর বেগ কমে যায়। বেগ কমলে আলো লম্বের দিকে সরে আসে, নাকি দূরে যায়?',
        explanationBn: 'হালকা মাধ্যম (বাতাস) থেকে ঘন মাধ্যমে (কাচ, পানি) ঢুকলে আলোর বেগ কমে যায়, ফলে আলো অভিলম্বের (normal) কাছাকাছি সরে আসে — দূরে সরে না। উল্টো দিকে গেলে (ঘন থেকে হালকা) আলো লম্ব থেকে দূরে সরে।',
        conceptTag: 'সাধারণ ভুল',
        difficulty: 'medium',
      },
      {
        promptBn: 'পানির গ্লাসে সূর্যের আলো পড়লে মাঝে মাঝে রংধনুর মতো রং দেখা যায়। প্রতিসরণের কোন কারণ-ফল সম্পর্ক এখানে কাজ করে?',
        options: [
          'বিভিন্ন রঙের আলো ভিন্ন ভিন্ন মাত্রায় বাঁকে (dispersion), তাই সাদা আলো আলাদা রঙে ভাগ হয়ে যায়',
          'পানি নিজে থেকে রং তৈরি করে',
          'শুধু লাল আলো প্রতিসরিত হয়',
          'সব রঙের আলো একই মাত্রায় বাঁকে বলে রং আলাদা হয়ে যায়',
        ],
        correctIndex: 0,
        hintBn: 'সাদা আলোতে অনেক রং মেশানো থাকে। প্রতিটা রং কি একইভাবে বাঁকে, নাকি আলাদাভাবে?',
        explanationBn: 'সাদা আলোর প্রতিটা রঙের তরঙ্গদৈর্ঘ্য আলাদা, তাই প্রতিসরণের সময় প্রতিটা রং ভিন্ন মাত্রায় বাঁকে (বেগুনি সবচেয়ে বেশি, লাল সবচেয়ে কম) — এই dispersion-এর কারণেই রংধনু বা প্রিজমে সাত রং আলাদা দেখা যায়।',
        conceptTag: 'কারণ-ফল',
        difficulty: 'medium',
      },
      {
        promptBn: 'বন্ধু জিজ্ঞেস করল "আলোর প্রতিসরণ কী?" — ৩০ সেকেন্ডে সবচেয়ে ভালো উত্তর কোনটা?',
        options: [
          '"পানিতে ডোবানো পেনসিল যেমন বাঁকা দেখায় — মাধ্যম বদলালে আলোর বেগ বদলায়, তাই আলো নিজের পথ থেকে বেঁকে যায়। এটাই প্রতিসরণ।"',
          '"এটা প্রতিফলনের মতোই একটা ব্যাপার।"',
          '"লম্ব রেখার কোণ মুখস্থ করলেই হবে।"',
          '"শুধু পানিতে এটা ঘটে, বাতাসে না।"',
        ],
        correctIndex: 0,
        hintBn: 'চেনা দৃশ্য (পানিতে বাঁকা পেনসিল) দিয়ে শুরু করলে ধারণাটা সহজে চোখে ভাসে।',
        explanationBn: 'পেনসিলের চেনা উদাহরণ দিয়ে বোঝালে বেগ পরিবর্তন ও দিক বাঁকার সম্পর্কটা সহজে ধরা পড়ে। প্রতিফলনের সাথে গুলিয়ে ফেলা বা শুধু কোণ মুখস্থ বলা দিলে বন্ধু আসল কারণটা বুঝবে না।',
        conceptTag: 'বন্ধুকে শেখাও',
        difficulty: 'easy',
      },
    ],
  },
}

// Normalize topic title for lookup
function lookupTopicFallback(topicTitle: string): FallbackQuizDef | null {
  const key = topicTitle.toLowerCase().trim()
  if (TOPIC_FALLBACKS[key]) return TOPIC_FALLBACKS[key]

  // Only accept a partial match when the learner's title actually contains the
  // full fallback key. Matching the other way round let short titles ("table",
  // "a") pull in an unrelated quiz.
  for (const k of Object.keys(TOPIC_FALLBACKS)) {
    if (key.includes(k)) return TOPIC_FALLBACKS[k]
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
  // The model sometimes wraps the JSON in fences or adds a short preamble, so
  // slice to the outermost object instead of only trimming leading fences.
  const withoutFences = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = withoutFences.indexOf('{')
  const end = withoutFences.lastIndexOf('}')
  const cleaned = start !== -1 && end > start ? withoutFences.slice(start, end + 1) : withoutFences
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed.questions) || parsed.questions.length < 5) throw new Error('Quiz must have at least 5 questions')

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

  // Each room gets its own angle so a repeat session on the same topic does not
  // regenerate the identical five questions.
  const variationSeed = Math.random().toString(36).slice(2, 8)
  const prompt = buildQuizPrompt(topicTitle, subject, variationSeed)

  let lastErr: unknown = null
  for (const modelName of geminiTextModels()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 1, responseMimeType: 'application/json' },
      })
      const result = await model.generateContent(prompt)
      return parseQuizJson(result.response.text(), topicTitle)
    } catch (err) {
      lastErr = err
      console.warn(
        `[quiz-generator] model "${modelName}" failed for topic "${topicTitle}":`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  console.error(
    `[quiz-generator] all Gemini models failed for topic "${topicTitle}" — using fallback:`,
    lastErr instanceof Error ? lastErr.message : lastErr,
  )
  return fallbackQuestions(topicTitle)
}

function buildQuizPrompt(topicTitle: string, subject: string | null | undefined, variationSeed: string) {
  return `You are VoicePandita's Bondhu Study Room AI host for Bangladeshi SSC/HSC students.
Generate exactly one 5-question MCQ concept-check session. Return ONLY valid JSON -- no markdown, no preamble.

Topic: "${topicTitle}"
Subject: ${subject || 'general'}
Session variation id: ${variationSeed} -- use it to pick fresh examples, numbers, and scenarios so this session differs from earlier sessions on the same topic. Never mention this id.

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
{"topicTitle":"string","learningGoalBn":"string","warmupBn":"string","questions":[{"questionOrder":1,"questionType":"mcq","promptBn":"string","options":[{"id":"A","text":"string"},{"id":"B","text":"string"},{"id":"C","text":"string"},{"id":"D","text":"string"}],"correctAnswer":{"id":"A"},"hintBn":"string","explanationBn":"string","difficulty":"easy","conceptTag":"string"}],"closingSummaryBn":"string"}`
}
