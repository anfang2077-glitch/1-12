# -*- coding: utf-8 -*-
"""把毕业设计论文 Markdown 转换为排版规范的 DOCX（A4、宋体小四、1.5 倍行距、图表居中）。"""
import os
import re
import sys

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "05-thesis", "毕业设计论文.md")
DST = os.path.join(BASE, "05-thesis", "毕业设计论文.docx")

BODY_FONT = "宋体"
HEAD_FONT = "黑体"
MONO_FONT = "Consolas"
BODY_SIZE = Pt(12)          # 小四
CAPTION_SIZE = Pt(10.5)     # 五号
TABLE_SIZE = Pt(9)
CODE_SIZE = Pt(8.5)
GRAY = RGBColor(0x44, 0x44, 0x44)


def set_font(run, name, size=None, bold=None, color=None):
    run.font.name = name
    run.font.size = size
    if bold is not None:
        run.font.bold = bold
    if color is not None:
        run.font.color.rgb = color
    latin = "Times New Roman" if name in (BODY_FONT, HEAD_FONT) else name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:ascii"), latin)
    rfonts.set(qn("w:hAnsi"), latin)
    rfonts.set(qn("w:eastAsia"), name)


def shade(paragraph, fill="F4F4F5"):
    pPr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    pPr.append(shd)


def add_page_number(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    run = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = "1"
    run.append(t)
    fld.append(run)
    p._p.append(fld)


def doc_defaults(doc):
    style = doc.styles["Normal"]
    style.font.name = BODY_FONT
    style.font.size = BODY_SIZE
    style.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
    pf = style.paragraph_format
    pf.line_spacing = 1.5
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)


INLINE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`)")


def add_inline(paragraph, text, size=BODY_SIZE, font=BODY_FONT, color=None):
    for seg in INLINE.split(text):
        if not seg:
            continue
        if seg.startswith("**") and seg.endswith("**") and len(seg) > 4:
            r = paragraph.add_run(seg[2:-2])
            set_font(r, font, size, True, color)
        elif seg.startswith("`") and seg.endswith("`") and len(seg) > 2:
            r = paragraph.add_run(seg[1:-1])
            set_font(r, MONO_FONT, Pt(size.pt - 1.5), False, color)
        else:
            r = paragraph.add_run(seg)
            set_font(r, font, size, False, color)


def body_para(doc, text, indent=True, align=WD_ALIGN_PARAGRAPH.JUSTIFY, size=BODY_SIZE,
              font=BODY_FONT, before=0, after=0, color=None):
    p = doc.add_paragraph()
    p.alignment = align
    pf = p.paragraph_format
    pf.line_spacing = 1.5
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    if indent:
        pf.first_line_indent = Pt(size.pt * 2)
    add_inline(p, text, size=size, font=font, color=color)
    return p


def heading(doc, text, level):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    if level == 0:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf.space_before = Pt(0)
        pf.space_after = Pt(18)
        pf.line_spacing = 1.5
        r = p.add_run(text)
        set_font(r, HEAD_FONT, Pt(22), True)
        return p
    if level == 1:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf.space_before = Pt(18)
        pf.space_after = Pt(14)
        r = p.add_run(text)
        set_font(r, HEAD_FONT, Pt(16), True)
    elif level == 2:
        pf.space_before = Pt(12)
        pf.space_after = Pt(6)
        pf.keep_with_next = True
        r = p.add_run(text)
        set_font(r, HEAD_FONT, Pt(14), True)
    else:
        pf.space_before = Pt(8)
        pf.space_after = Pt(4)
        pf.keep_with_next = True
        r = p.add_run(text)
        set_font(r, HEAD_FONT, Pt(12), True)
    pf.line_spacing = 1.5
    p.style = p.style
    return p


def strip_leading_number(text):
    return re.sub(r"^第[一二三四五六七八九十]+[章节]\s*", "", text).strip()


def page_break(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def add_table(doc, rows):
    ncol = max(len(r) for r in rows)
    table = doc.add_table(rows=0, cols=ncol)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    for i, row in enumerate(rows):
        cells = table.add_row().cells
        for j in range(ncol):
            txt = row[j] if j < len(row) else ""
            cell = cells[j]
            cell.text = ""
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if (i == 0 or j > 0) else WD_ALIGN_PARAGRAPH.LEFT
            pf = p.paragraph_format
            pf.line_spacing = 1.0
            pf.space_before = Pt(2)
            pf.space_after = Pt(2)
            add_inline(p, txt, size=TABLE_SIZE, font=BODY_FONT)
    # 表头加粗 + 浅底 + 跨页重复 + 行不跨页
    for cell in table.rows[0].cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.bold = True
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:fill"), "EFF6FF")
        tcPr.append(shd)
    trPr = table.rows[0]._tr.get_or_add_trPr()
    header = OxmlElement("w:tblHeader")
    header.set(qn("w:val"), "true")
    trPr.append(header)
    for row in table.rows:
        rp = row._tr.get_or_add_trPr()
        cant = OxmlElement("w:cantSplit")
        cant.set(qn("w:val"), "true")
        rp.append(cant)
    # 表格后留白
    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(0)
    sp.paragraph_format.line_spacing = 1.0
    for r_ in sp.runs:
        r_.font.size = Pt(4)
    return table


def add_code(doc, lines, lang):
    for ln in lines:
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.line_spacing = 1.0
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
        pf.left_indent = Cm(0.5)
        shade(p)
        r = p.add_run(ln if ln else " ")
        set_font(r, MONO_FONT, CODE_SIZE, False)
    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(0)
    sp.paragraph_format.line_spacing = 1.0


def add_image(doc, alt, path, width_cm=15.2, show_caption=True):
    full = os.path.join(BASE, "05-thesis", path) if not os.path.isabs(path) else path
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.0
    if os.path.exists(full):
        p.add_run().add_picture(full, width=Cm(width_cm))
    else:
        r = p.add_run("[缺失图片：" + path + "]")
        set_font(r, BODY_FONT, CAPTION_SIZE, False, RGBColor(0xCC, 0, 0))
    if not show_caption:
        return
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(10)
    cap.paragraph_format.line_spacing = 1.0
    r = cap.add_run(alt)
    set_font(r, BODY_FONT, CAPTION_SIZE, True)


def is_table_sep(line):
    s = line.strip().strip("|")
    return bool(s) and all(re.fullmatch(r":?-{2,}:?", c.strip()) for c in s.split("|") if c.strip() != "")


def split_row(line):
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def build():
    with open(SRC, encoding="utf-8") as f:
        lines = f.read().splitlines()

    doc = Document()
    doc_defaults(doc)
    sec = doc.sections[0]
    sec.page_width = Cm(21)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(2.54)
    sec.bottom_margin = Cm(2.54)
    sec.left_margin = Cm(3.0)
    sec.right_margin = Cm(2.6)
    add_page_number(sec)

    i = 0
    first_h1 = True
    in_code = False
    code_buf, code_lang = [], ""
    pending_caption = None
    title_done = False
    front = True
    in_toc = False

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if stripped.startswith("```"):
            if not in_code:
                in_code, code_buf = True, []
                code_lang = stripped[3:].strip()
            else:
                add_code(doc, code_buf, code_lang)
                in_code = False
            i += 1
            continue
        if in_code:
            code_buf.append(raw)
            i += 1
            continue

        if not stripped:
            i += 1
            continue
        if re.fullmatch(r"[-*_]{3,}", stripped):
            i += 1
            continue

        # 图片
        m = re.fullmatch(r"!\[(.*?)\]\((.*?)\)", stripped)
        if m:
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            nxt = lines[j].strip() if j < len(lines) else ""
            dup = nxt.strip("*").strip() == m.group(1).strip()
            add_image(doc, m.group(1), m.group(2), show_caption=not dup)
            i += 1
            continue

        # 标题
        m = re.match(r"^(#{1,5})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            if level == 1 and not title_done:
                heading(doc, text, 0)
                title_done = True
                i += 1
                continue
            special = text.strip() in ("摘要", "Abstract", "目 录", "目录", "参考文献", "致谢")
            if special:
                if text.strip() not in ("Abstract",):
                    page_break(doc)
                if text.strip() == "摘要":
                    front = False
                in_toc = text.strip() in ("目 录", "目录")
                heading(doc, text, 1)
                i += 1
                continue
            in_toc = False
            if level == 1:
                page_break(doc)
                heading(doc, text, 1)
            elif level == 2:
                heading(doc, text, 2)
            else:
                heading(doc, text, 3)
            i += 1
            continue

        # 表格
        if stripped.startswith("|") and i + 1 < len(lines) and is_table_sep(lines[i + 1]):
            rows = [split_row(stripped)]
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i]))
                i += 1
            add_table(doc, rows)
            continue

        # 引用
        if stripped.startswith(">"):
            body_para(doc, stripped.lstrip("> ").strip(), indent=False, size=Pt(10.5), color=GRAY,
                      align=WD_ALIGN_PARAGRAPH.LEFT)
            i += 1
            continue

        # 列表
        m = re.match(r"^(\s*)[-*+]\s+(.*)$", raw)
        if m:
            level = min(len(m.group(1).replace("\t", "  ")) // 2, 3)
            p = doc.add_paragraph()
            pf = p.paragraph_format
            pf.left_indent = Cm(0.75 + level * 0.55)
            pf.first_line_indent = Cm(-0.35) if not in_toc else Cm(0)
            pf.line_spacing = 1.5
            if not in_toc:
                r = p.add_run("· ")
                set_font(r, BODY_FONT, BODY_SIZE)
            add_inline(p, m.group(2))
            i += 1
            continue
        m = re.match(r"^(\s*)\d+[.)]\s+(.*)$", raw)
        if m:
            level = min(len(m.group(1).replace("\t", "  ")) // 2, 3)
            p = doc.add_paragraph()
            pf = p.paragraph_format
            pf.left_indent = Cm(0.75 + level * 0.55)
            pf.first_line_indent = Cm(-0.35)
            pf.line_spacing = 1.5
            num = re.match(r"^(\s*)(\d+)[.)]", raw).group(2)
            r = p.add_run(num + ". ")
            set_font(r, BODY_FONT, BODY_SIZE)
            add_inline(p, m.group(2))
            i += 1
            continue

        # 图题 / 表题（单独一行的加粗说明）
        if re.fullmatch(r"\*\*(图|表)\s*\d+[-－]\d+.*\*\*", stripped):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(10)
            p.paragraph_format.line_spacing = 1.0
            r = p.add_run(stripped.strip("*"))
            set_font(r, BODY_FONT, CAPTION_SIZE, True)
            i += 1
            continue

        # 封面：英文题目等整行加粗内容居中
        if front and re.fullmatch(r"\*\*[^*]+\*\*", stripped):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(12)
            p.paragraph_format.line_spacing = 1.4
            add_inline(p, stripped, size=Pt(14))
            i += 1
            continue

        body_para(doc, stripped)
        i += 1

    doc.save(DST)
    return DST


if __name__ == "__main__":
    out = build()
    d = Document(out)
    chars = 0
    for p in d.paragraphs:
        chars += len(re.findall(r"[\u4e00-\u9fff]", p.text))
    print("saved:", out)
    print("paragraphs:", len(d.paragraphs), "tables:", len(d.tables), "cjk_chars:", chars,
          "size_kb:", os.path.getsize(out) // 1024)
