# python3 tools/sheet.py out.png cols a.png b.png ... : tiles screenshots into one sheet
import sys
from PIL import Image
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]; w, h = ims[0].size; rows = -(-len(ims) // cols)
s = Image.new('RGB', (w * cols, h * rows))
for i, im in enumerate(ims): s.paste(im, ((i % cols) * w, (i // cols) * h))
if s.size[0] > 2000: s = s.resize((2000, round(s.size[1] * 2000 / s.size[0])), Image.LANCZOS)
s.save(out)
