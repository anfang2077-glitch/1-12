# -*- coding: utf-8 -*-
"""交付前自检：DOCX 结构/图片/空表，PPTX 页数与文字溢出风险。"""
import os
import re
import sys

from docx import Document
from docx.shared import Cm
from pptx import Presentation
from pptx.util import Emu

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCX = os.path.join(BASE, "05-thesis", "毕业设计论文.docx")
PPTX = os.path.join(BASE, "06-defense", "答辩PPT.pptx")


def check_docx():
    d = Document(DOCX)
    text = "\n".join(p.text for p in d.paragraphs)
    print("== DOCX ==")
    print("paragraphs:", len(d.paragraphs), "tables:", len(d.tables),
          "inline_shapes:", len(d.inline_shapes))
    print("cjk_chars:", len(re.findall(r"[\u4e00-\u9fff]", text)))
    for bad in ("缺失图片", "待补充", "TBD", "TODO", "**"):
        print("contains %-6s: %s" % (bad, bad in text or any(bad in c.text for t in d.tables for r in t.rows for c in r.cells)))
    # 空表格
    empty = 0
    for t in d.tables:
        cols = len(t.columns)
        if cols == 0 or all(not c.text.strip() for r in t.rows for c in r.cells):
            empty += 1
    print("empty_tables:", empty)
    # 表格列数分布
    print("table_cols:", sorted({len(t.columns) for t in d.tables}))
    # 图片宽度
    for s in d.inline_shapes:
        pass
    print("first_paragraphs:")
    n = 0
    for p in d.paragraphs:
        if p.text.strip():
            print("   ", p.text.strip()[:60])
            n += 1
            if n >= 8:
                break
    # 标题层级抽样
    print("headings_sample:")
    cnt = 0
    for p in d.paragraphs:
        t = p.text.strip()
        if re.match(r"^(第\s*\d+\s*章|\d+\.\d+|摘要|Abstract|目录|参考文献|致谢)", t) and len(t) < 40:
            print("   ", t, "| size=", [r.font.size.pt for r in p.runs if r.font.size][:1])
            cnt += 1
            if cnt >= 12:
                break


def check_pptx():
    prs = Presentation(PPTX)
    print("\n== PPTX ==")
    print("slides:", len(prs.slides), "size:", prs.slide_width.inches, "x", prs.slide_height.inches)
    for i, s in enumerate(prs.slides, 1):
        title, n_shapes, over = "", 0, []
        for sh in s.shapes:
            n_shapes += 1
            if sh.left is not None and sh.left + (sh.width or 0) > prs.slide_width:
                over.append(sh.name)
            if sh.has_text_frame and sh.text_frame.text.strip() and not title:
                title = sh.text_frame.text.strip().split("\n")[0]
        notes = s.notes_slide.notes_text_frame.text if s.has_notes_slide else ""
        print("%2d %-40s shapes=%2d notes=%3d chars %s" % (i, title[:36], n_shapes, len(notes),
                                                          "OVERFLOW:" + ",".join(over) if over else ""))


if __name__ == "__main__":
    if os.path.exists(DOCX):
        check_docx()
    if os.path.exists(PPTX):
        check_pptx()
