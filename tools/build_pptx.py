# -*- coding: utf-8 -*-
"""根据 06-defense/slides.json 生成答辩用 PPTX（16:9，统一视觉规范，含演讲者备注）。"""
import json
import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Emu, Inches, Pt

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "06-defense", "slides.json")
DST = os.path.join(BASE, "06-defense", "答辩PPT.pptx")
FIG = os.path.join(BASE, "05-thesis", "figures")

NAVY = RGBColor(0x0F, 0x17, 0x2A)
BLUE = RGBColor(0x25, 0x63, 0xEB)
LIGHT = RGBColor(0xEF, 0xF6, 0xFF)
GRAY = RGBColor(0x6B, 0x72, 0x80)
INK = RGBColor(0x1F, 0x29, 0x37)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "微软雅黑"


def font(run, size, bold=False, color=INK, name=FONT):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = name
    rpr = run._r.get_or_add_rPr()
    ea = rpr.find("{http://schemas.openxmlformats.org/drawingml/2006/main}ea")
    if ea is None:
        ea = rpr.makeelement("{http://schemas.openxmlformats.org/drawingml/2006/main}ea", {})
        rpr.append(ea)
    ea.set("typeface", name)


def rect(slide, x, y, w, h, color, line=None):
    from pptx.enum.shapes import MSO_SHAPE
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shp.fill.solid()
    shp.fill.fore_color.rgb = color
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(0.75)
    shp.shadow.inherit = False
    return shp


def textbox(slide, x, y, w, h, text, size, bold=False, color=INK, align=PP_ALIGN.LEFT,
            anchor=MSO_ANCHOR.TOP, spacing=1.0):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = spacing
    r = p.add_run()
    r.text = text
    font(r, size, bold, color)
    return tb


def footer(slide, idx, total):
    line = rect(slide, Inches(0.9), Inches(6.92), Inches(11.5), Pt(1.2), RGBColor(0xE5, 0xE7, 0xEB))
    line.line.fill.background()
    textbox(slide, Inches(0.9), Inches(7.0), Inches(6), Inches(0.3),
            "基于 React + Node.js 的在线考试系统设计与实现", 9, False, GRAY)
    textbox(slide, Inches(11.0), Inches(7.0), Inches(1.4), Inches(0.3),
            "%d / %d" % (idx, total), 9, False, GRAY, PP_ALIGN.RIGHT)


def add_bullets(slide, items, y=Inches(1.95), size=19, gap=Inches(0.78)):
    top = y
    for it in items:
        rect(slide, Inches(1.05), top + Inches(0.13), Inches(0.13), Inches(0.13), BLUE)
        tb = slide.shapes.add_textbox(Inches(1.35), top, Inches(10.6), Inches(0.55))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.line_spacing = 1.25
        r = p.add_run()
        r.text = it
        font(r, size, False, INK)
        top += gap


def build():
    with open(SRC, encoding="utf-8") as f:
        slides = json.load(f)
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]
    total = len(slides)

    for idx, s in enumerate(slides, start=1):
        layout = s.get("layout", "content")
        slide = prs.slides.add_slide(blank)

        if layout == "cover":
            rect(slide, 0, 0, prs.slide_width, prs.slide_height, NAVY)
            rect(slide, 0, Inches(1.55), Inches(0.16), Inches(1.9), BLUE)
            textbox(slide, Inches(1.0), Inches(1.45), Inches(11.4), Inches(1.75),
                    s.get("title", ""), 34, True, WHITE, spacing=1.2)
            textbox(slide, Inches(1.0), Inches(3.42), Inches(11.0), Inches(0.5),
                    s.get("subtitle", ""), 20, False, RGBColor(0xBF, 0xDB, 0xFE))
            rect(slide, Inches(1.0), Inches(4.02), Inches(2.2), Pt(2), BLUE)
            y = Inches(4.42)
            for m in s.get("meta", []):
                textbox(slide, Inches(1.0), y, Inches(6.5), Inches(0.36), m, 14, False,
                        RGBColor(0xCB, 0xD5, 0xE1))
                y += Inches(0.42)
            textbox(slide, Inches(8.6), Inches(6.55), Inches(4.2), Inches(0.3),
                    "2026 届本科毕业设计答辩", 12, False, RGBColor(0x94, 0xA3, 0xB8), PP_ALIGN.RIGHT)

        elif layout == "section":
            rect(slide, 0, 0, prs.slide_width, prs.slide_height, NAVY)
            last = idx == total
            if not last:
                textbox(slide, Inches(0.95), Inches(2.15), Inches(2.2), Inches(1.6),
                        "%02d" % idx, 72, True, RGBColor(0x1D, 0x4E, 0xD8))
            textbox(slide, Inches(0.95) if last else Inches(2.55), Inches(2.35), Inches(11.3), Inches(0.9),
                    s.get("title", ""), 40, True, WHITE)
            textbox(slide, Inches(1.0) if last else Inches(2.6), Inches(3.35), Inches(9.0), Inches(0.5),
                    s.get("subtitle", "恳请各位老师批评指正"), 17, False, RGBColor(0xBF, 0xDB, 0xFE))
            rect(slide, Inches(1.0) if last else Inches(2.6), Inches(4.15), Inches(1.8), Pt(2), BLUE)

        elif layout == "table":
            rect(slide, 0, 0, prs.slide_width, Inches(0.16), BLUE)
            textbox(slide, Inches(0.9), Inches(0.55), Inches(11.5), Inches(0.7),
                    s.get("title", ""), 30, True, NAVY)
            rect(slide, Inches(0.95), Inches(1.32), Inches(0.9), Pt(3), BLUE)
            table = s.get("table", {"headers": [], "rows": []})
            headers, rows = table.get("headers", []), table.get("rows", [])
            nrow, ncol = len(rows) + 1, max(1, len(headers))
            left, top, width = Inches(1.0), Inches(1.85), Inches(11.3)
            height = Inches(0.5) * nrow
            if height > Inches(4.6):
                height = Inches(4.6)
            else:
                top = Emu(int(top + (Inches(4.85) - height) / 2))
            shape = slide.shapes.add_table(nrow, ncol, left, top, width, height)
            tbl = shape.table
            for j, h in enumerate(headers):
                cell = tbl.cell(0, j)
                cell.fill.solid()
                cell.fill.fore_color.rgb = BLUE
                cell.text = ""
                p = cell.text_frame.paragraphs[0]
                p.alignment = PP_ALIGN.CENTER
                r = p.add_run()
                r.text = str(h)
                font(r, 15, True, WHITE)
                cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            for i, row in enumerate(rows, start=1):
                for j in range(ncol):
                    cell = tbl.cell(i, j)
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = WHITE if i % 2 else LIGHT
                    cell.text = ""
                    p = cell.text_frame.paragraphs[0]
                    p.alignment = PP_ALIGN.CENTER
                    r = p.add_run()
                    r.text = str(row[j]) if j < len(row) else ""
                    font(r, 13, False, INK)
                    cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            footer(slide, idx, total)

        else:  # content
            rect(slide, 0, 0, prs.slide_width, Inches(0.16), BLUE)
            textbox(slide, Inches(0.9), Inches(0.55), Inches(11.5), Inches(0.7),
                    s.get("title", ""), 30, True, NAVY)
            rect(slide, Inches(0.95), Inches(1.32), Inches(0.9), Pt(3), BLUE)
            add_bullets(slide, s.get("bullets", []), size=19 if len(s.get("bullets", [])) <= 5 else 17)
            footer(slide, idx, total)

        notes = s.get("notes")
        if notes:
            slide.notes_slide.notes_text_frame.text = notes

    prs.save(DST)
    return DST


if __name__ == "__main__":
    out = build()
    prs = Presentation(out)
    print("saved:", out, "slides:", len(prs.slides), "size_kb:", os.path.getsize(out) // 1024)
    for i, s in enumerate(prs.slides, 1):
        texts = [sh.text_frame.text.split("\n")[0] for sh in s.shapes if sh.has_text_frame and sh.text_frame.text.strip()]
        print(i, "|", texts[:2])
