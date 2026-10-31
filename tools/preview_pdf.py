# -*- coding: utf-8 -*-
"""把导出的论文 PDF 的前若干页渲染成 PNG，用于人工目检排版。"""
import os
import sys

import pypdfium2 as pdfium

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(BASE, "05-thesis", "毕业设计论文.pdf")
OUT = os.path.join(BASE, "05-thesis", "preview")
os.makedirs(OUT, exist_ok=True)

pages = [int(x) for x in sys.argv[1:]] or [1, 2, 3, 6, 10, 20, 30, 45, 55, 68]
doc = pdfium.PdfDocument(PDF)
print("pages:", len(doc))
for p in pages:
    if p > len(doc):
        continue
    page = doc[p - 1]
    bitmap = page.render(scale=1.5)
    img = bitmap.to_pil()
    path = os.path.join(OUT, "page-%02d.png" % p)
    img.save(path)
    print(path, img.size)
