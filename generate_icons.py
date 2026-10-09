"""开发时生成 PWA PNG 图标；应用运行不需要 Python。"""
from PIL import Image, ImageDraw
from pathlib import Path

folder = Path(__file__).resolve().parent / 'icons'
for size in (192, 512):
    im = Image.new('RGBA', (size, size), '#183b63')
    d = ImageDraw.Draw(im)
    s = size / 512
    rect = lambda box: tuple(round(v * s) for v in box)
    d.rounded_rectangle(rect((80, 144, 432, 420)), radius=round(32 * s), fill='#f4f8fb')
    for y in (201, 282, 363):
        for x in (137, 216, 295, 374):
            rad = 22
            d.ellipse(rect((x-rad, y-rad, x+rad, y+rad)), fill='#168c83' if x == 137 else '#b5cede')
    d.polygon([tuple(round(v*s) for v in point) for point in ((92, 108), (136, 108), (92, 152))], fill='#62d4c0')
    d.ellipse(rect((300, 91, 396, 183)), fill='#183b63')
    d.ellipse(rect((306, 99, 390, 177)), fill='#62d4c0')
    d.polygon([tuple(round(v*s) for v in point) for point in ((348, 65), (312, 116), (384, 116))], fill='#62d4c0')
    d.arc(rect((330, 117, 366, 155)), 90, 180, fill='white', width=max(1,round(7*s)))
    im.save(folder / f'icon-{size}.png')
im.save(folder / 'qPCR Plate Planner.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
