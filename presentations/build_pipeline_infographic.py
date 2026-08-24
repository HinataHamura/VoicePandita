from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "presentations" / "VoicePandita_Detailed_Pipeline.png"
W, H = 2400, 1350
img = Image.new("RGB", (W, H), "#F7FAF7")
d = ImageDraw.Draw(img)

def font(size, bold=False):
    candidates = [
        Path("C:/Windows/Fonts/aptos-display-bold.ttf" if bold else "C:/Windows/Fonts/aptos.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for p in candidates:
        if p.exists(): return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()

INK, FOREST, TEAL = "#122724", "#06684E", "#128482"
MINT, PALE, GOLD = "#DEF7EF", "#FFFFFF", "#F7B520"
MUTED, LINE, RED = "#5B706B", "#BFD8D0", "#D95843"

def rr(box, fill, outline=None, radius=28, width=2):
    d.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)

def txt(xy, s, size, fill=INK, bold=False, anchor="la", align="left"):
    d.multiline_text(xy, s, font=font(size, bold), fill=fill, anchor=anchor, align=align, spacing=8)

def arrow(x1, y1, x2, y2, color=FOREST, width=10):
    d.line((x1,y1,x2,y2), fill=color, width=width)
    import math
    a=math.atan2(y2-y1,x2-x1); L=22
    pts=[(x2,y2),(x2-L*math.cos(a-.55),y2-L*math.sin(a-.55)),(x2-L*math.cos(a+.55),y2-L*math.sin(a+.55))]
    d.polygon(pts, fill=color)

def node(x, y, w, h, n, title, lines, accent=FOREST):
    rr((x,y,x+w,y+h), PALE, LINE, 30, 3)
    d.rounded_rectangle((x,y,x+18,y+h), 12, fill=accent)
    d.ellipse((x+28,y+25,x+88,y+85), fill=accent)
    txt((x+58,y+56), n, 27, "white", True, "mm")
    txt((x+112,y+32), title, 29, accent, True)
    txt((x+32,y+108), lines, 21, MUTED, False)

# Header
d.rectangle((0,0,W,170), fill=FOREST)
txt((72,56), "VoicePandita — End-to-End AI Learning Pipeline", 54, "white", True)
txt((72,125), "Bangladesh-first • curriculum-grounded • low-connectivity • accessibility-aware", 25, "#DFF5ED")
txt((2325,62), "TOP 100", 23, GOLD, True, "ra")
txt((2325,105), "AI BUILD FEST", 19, "white", True, "ra")

# Main flow
node(70,235,390,275,"1","LEARNER INPUT","Voice / microphone\nTyped question\nTextbook photo / OCR\nPDF study material",FOREST)
node(540,235,390,275,"2","PRE-PROCESS","Language + script detection\nSTT transcription\nImage optimization + OCR\nStudent preference / subject",TEAL)
node(1010,235,390,275,"3","GROUNDING","NCTB curriculum chunks\nSupabase pgvector search\nConcept path / graph context\nProvenance + safety checks",FOREST)
node(1480,235,390,275,"4","AI ORCHESTRATION","Grounded prompt assembly\nGemini / configured provider\nOutput-mode instructions\nVerified-first language policy",TEAL)
node(1950,235,380,275,"5","LEARNING OUTPUT","Bangla explanation\nVoice / diagram / animation\nExam or simple mode\nBdSL text-to-sign prototype",FOREST)

for a,b in [(460,540),(930,1010),(1400,1480),(1870,1950)]: arrow(a,372,b-18,372)

# Feedback/memory band
rr((70,585,2330,845), MINT, "#A8D6C7", 34, 3)
txt((110,625), "CONTINUOUS LEARNING LOOP", 25, FOREST, True)
items=[
    (110,"RESPONSE METADATA","grounding label • source • confidence • language provenance"),
    (650,"STUDENT MEMORY","chat history • weak concepts • practice signals • progress"),
    (1190,"ADAPT NEXT STEP","simplify • show visual • invite Study Buddy • recommend practice"),
    (1730,"PRIVACY CONTROLS","server-side secrets • limited audio retention • sensitive vectors"),
]
for x,t,sub in items:
    rr((x,680,x+480,800), "#FFFFFF", "#C7E2D9", 20, 2)
    txt((x+24,704),t,20,FOREST,True)
    txt((x+24,744),sub,17,MUTED)

arrow(2140,845,2140,930,FOREST,8)
arrow(2140,930,270,930,FOREST,8)
arrow(270,930,270,852,FOREST,8)
txt((1200,902),"feedback + learning evidence",18,FOREST,True,"mm")

# Failure paths
txt((70,990), "RESILIENCE & SAFE FALLBACKS", 29, INK, True)
fallbacks=[
    (70,"NO / WEAK INTERNET","Offline curriculum packs\nand local search",FOREST),
    (475,"AI PROVIDER FAILURE","Deterministic fallback answer\nand friendly retry state",RED),
    (880,"OCR / STT FAILURE","Manual review and edit\nor browser capability fallback",TEAL),
    (1285,"LOW-RESOURCE LANGUAGE","Verified dataset first; otherwise\nStandard Bangla + limitation note",GOLD),
    (1690,"BDSL WORD NOT FOUND","Local SignML lookup, validated\nresolver, then fingerspelling",FOREST),
]
for x,title,sub,c in fallbacks:
    rr((x,1040,x+365,1195), "#FFFFFF", LINE, 22, 2)
    d.rectangle((x,1040,x+365,1052),fill=c)
    txt((x+20,1075),title,18,c,True)
    txt((x+20,1112),sub,17,MUTED)

# Bottom tech line
rr((70,1240,2330,1310), FOREST, None, 20)
txt((1200,1275),"Next.js PWA  •  API routes  •  Supabase/PostgreSQL + pgvector  •  Neo4j optional  •  offline JSON packs  •  AI/STT/TTS providers",20,"white",True,"mm")

img.save(OUT, quality=95)
print(OUT)
