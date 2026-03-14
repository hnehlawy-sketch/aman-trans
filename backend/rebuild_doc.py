#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rebuild_doc.py  — Rebuild DOCX / PDF with translated text
Arabic/RTL fully supported: wkhtmltopdf for PDF, proper font for DOCX
Usage: python rebuild_doc.py <original> <translated.txt> <output>
"""
import sys, os, json, subprocess, tempfile, re, shutil

# ── Windows stdout fix ──────────────────────────────────────────────────────
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ── Auto-install dependencies ───────────────────────────────────────────────
def pip_install(*pkgs):
    cmd = [sys.executable, '-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', *pkgs]
    if sys.platform != 'win32':
        cmd.append('--break-system-packages')
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def ensure_deps():
    missing = []
    try: import docx
    except ImportError: missing.append('python-docx')
    try: from reportlab.lib.pagesizes import A4
    except ImportError: missing.append('reportlab')
    if missing: pip_install(*missing)

ensure_deps()

# ── Arabic helpers ──────────────────────────────────────────────────────────
def has_arabic(text):
    return bool(re.search(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFEFF]', text))

def detect_dir(text):
    ar = len(re.findall(r'[\u0600-\u06FF]', text))
    lt = len(re.findall(r'[a-zA-Z]', text))
    return 'rtl' if ar >= lt else 'ltr'

# ── Find wkhtmltopdf ────────────────────────────────────────────────────────
def find_wk():
    cmd = shutil.which('wkhtmltopdf')
    if cmd: return cmd
    for p in [r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe',
               r'C:\Program Files (x86)\wkhtmltopdf\bin\wkhtmltopdf.exe']:
        if os.path.exists(p): return p
    return None

# ── Find Arabic TTF font ────────────────────────────────────────────────────
def find_arabic_ttf():
    for p in [
        r'C:\Windows\Fonts\arial.ttf', r'C:\Windows\Fonts\tahoma.ttf',
        r'C:\Windows\Fonts\calibri.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
    ]:
        if os.path.exists(p): return p
    for d in ['/usr/share/fonts', r'C:\Windows\Fonts', '/Library/Fonts']:
        if not os.path.exists(d): continue
        for root,_,files in os.walk(d):
            for f in files:
                if f.lower().endswith('.ttf'):
                    return os.path.join(root, f)
    return None

# ── HTML → PDF via wkhtmltopdf (perfect Arabic) ─────────────────────────────
def pdf_via_wk(text, out, wk):
    direction = detect_dir(text)
    is_rtl = direction == 'rtl'
    font_stack = (
        '"Arabic Typesetting","Traditional Arabic","Simplified Arabic",Arial,Tahoma,sans-serif'
        if is_rtl else 'Arial,"Liberation Sans",sans-serif'
    )
    lines_html = []
    for line in text.split('\n'):
        s = line.strip()
        if not s: lines_html.append('<p>&nbsp;</p>'); continue
        e = s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
        if   s.startswith('### '): lines_html.append(f'<h3>{e[4:].strip()}</h3>')
        elif s.startswith('## '): lines_html.append(f'<h2>{e[3:].strip()}</h2>')
        elif s.startswith('# '):  lines_html.append(f'<h1>{e[2:].strip()}</h1>')
        elif re.match(r'^\[(?:Page|صفحة|página)\s*\d+',s,re.I):
            lines_html.append(f'<div class="pgmark">{e}</div>')
        else: lines_html.append(f'<p>{e}</p>')

    html = f'''<!DOCTYPE html>
<html lang="{'ar' if is_rtl else 'en'}" dir="{direction}">
<head><meta charset="UTF-8">
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:{font_stack};direction:{direction};
     text-align:{'right' if is_rtl else 'left'};
     font-size:13pt;line-height:2;color:#1a1a1a;
     padding:0;unicode-bidi:embed}}
p{{margin-bottom:8px;word-break:break-word;orphans:2;widows:2}}
h1{{font-size:20pt;font-weight:bold;margin:18px 0 10px;border-bottom:1px solid #ccc;padding-bottom:4px}}
h2{{font-size:16pt;font-weight:bold;margin:14px 0 8px}}
h3{{font-size:14pt;font-weight:bold;margin:12px 0 6px}}
.pgmark{{color:#888;font-size:10pt;margin:16px 0 8px;
         border-top:1px dashed #ddd;padding-top:8px}}
</style></head>
<body>{''.join(lines_html)}</body></html>'''

    tmp = tempfile.NamedTemporaryFile(suffix='.html', mode='w', encoding='utf-8', delete=False)
    tmp.write(html); tmp.close()
    try:
        r = subprocess.run([
            wk, '--quiet', '--encoding','utf-8',
            '--margin-top','20mm','--margin-bottom','20mm',
            '--margin-left','20mm','--margin-right','20mm',
            '--page-size','A4',
            '--load-error-handling','ignore',
            '--load-media-error-handling','ignore',
            tmp.name, out
        ], capture_output=True, text=True, timeout=90)
        if r.returncode != 0 and not os.path.exists(out):
            raise Exception(f'wkhtmltopdf: {r.stderr[:300]}')
        return {'success':True,'method':'wkhtmltopdf','dir':direction}
    finally:
        try: os.unlink(tmp.name)
        except: pass

# ── PDF via reportlab (fallback) ────────────────────────────────────────────
def pdf_via_reportlab(text, out):
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_LEFT
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

    direction = detect_dir(text)
    is_rtl = direction == 'rtl'
    fname = 'ArabicFont'
    fpath = find_arabic_ttf()
    if fpath:
        try: pdfmetrics.registerFont(TTFont(fname, fpath))
        except: fname = 'Helvetica'
    else: fname = 'Helvetica'

    align = TA_RIGHT if is_rtl else TA_LEFT
    wrap  = 'RTL'    if is_rtl else 'LTR'
    base  = ParagraphStyle('B', fontName=fname, fontSize=12, leading=22,
                             alignment=align, wordWrap=wrap, spaceAfter=6)
    h1    = ParagraphStyle('H1', parent=base, fontSize=18, leading=26, spaceBefore=12)
    h2    = ParagraphStyle('H2', parent=base, fontSize=15, leading=22, spaceBefore=10)
    h3    = ParagraphStyle('H3', parent=base, fontSize=13, leading=20, spaceBefore=8)

    doc = SimpleDocTemplate(out, pagesize=A4,
                             rightMargin=2*cm, leftMargin=2*cm,
                             topMargin=2*cm, bottomMargin=2*cm)
    story = []
    for line in text.split('\n'):
        s = line.strip()
        if not s: story.append(Spacer(1,8)); continue
        e = s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
        if   s.startswith('### '): story.append(Paragraph(e[4:].strip(),h3))
        elif s.startswith('## '): story.append(Paragraph(e[3:].strip(),h2))
        elif s.startswith('# '):  story.append(Paragraph(e[2:].strip(),h1))
        else: story.append(Paragraph(e, base))
    doc.build(story)
    note = '' if fpath else 'Install wkhtmltopdf from https://wkhtmltopdf.org for better Arabic'
    return {'success':True,'method':'reportlab_fallback','dir':direction,'note':note}

# ── DOCX rebuild ────────────────────────────────────────────────────────────
def rebuild_docx(orig, text, out):
    import copy
    from docx import Document
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    doc = Document(orig)
    is_rtl = has_arabic(text)

    text_paras = [(i,p) for i,p in enumerate(doc.paragraphs) if p.text.strip()]
    if not text_paras:
        doc.save(out)
        return {'success':True,'method':'docx_no_text'}

    # Split translated text to match paragraph count
    parts_dbl = [p.strip() for p in text.split('\n\n') if p.strip()]
    parts_sgl = [p.strip() for p in text.split('\n')   if p.strip()]
    n = len(text_paras)
    parts = parts_dbl if len(parts_dbl)>=n else parts_sgl
    while len(parts) < n: parts.append(parts[-1] if parts else '')
    parts = parts[:n]

    for (_, para), new_text in zip(text_paras, parts):
        clean = re.sub(r'^#+\s+', '', new_text.strip())
        if not clean: continue

        if is_rtl:
            # Make paragraph RTL
            pPr = para._p.get_or_add_pPr()
            for tag in ['w:bidi','w:jc']:
                el = pPr.find(qn(tag))
                if el is None:
                    el = OxmlElement(tag)
                    pPr.insert(0, el)
            pPr.find(qn('w:bidi')).set(qn('w:val'),'1')
            pPr.find(qn('w:jc')).set(qn('w:val'),'right')

        runs = para.runs
        if runs:
            runs[0].text = clean
            if is_rtl:
                runs[0].font.name = 'Arial'
                rPr = runs[0]._r.get_or_add_rPr()
                for tag in ['w:rtl','w:cs']:
                    if rPr.find(qn(tag)) is None:
                        rPr.append(OxmlElement(tag))
                rFonts = rPr.find(qn('w:rFonts'))
                if rFonts is None:
                    rFonts = OxmlElement('w:rFonts')
                    rPr.insert(0, rFonts)
                for attr in ['w:ascii','w:hAnsi','w:cs']:
                    rFonts.set(qn(attr),'Arial')
            for r in runs[1:]: r.text = ''
        else:
            pEl = para._p
            for r in pEl.findall(qn('w:r')): pEl.remove(r)
            run = OxmlElement('w:r')
            rPr = OxmlElement('w:rPr')
            if is_rtl:
                rPr.append(OxmlElement('w:rtl'))
                rPr.append(OxmlElement('w:cs'))
                rf = OxmlElement('w:rFonts')
                for a in ['w:ascii','w:hAnsi','w:cs']: rf.set(qn(a),'Arial')
                rPr.insert(0,rf)
            run.append(rPr)
            tEl = OxmlElement('w:t')
            tEl.text = clean
            tEl.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
            run.append(tEl)
            pEl.append(run)

    doc.save(out)
    return {'success':True,'method':'docx_rebuild','paragraphs':n,'rtl':is_rtl}

# ── Main ────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 4:
        print(json.dumps({'error':'Usage: rebuild_doc.py <original> <translated.txt> <output>'}))
        sys.exit(1)

    orig  = sys.argv[1]
    trans = sys.argv[2]
    out   = sys.argv[3]
    ext   = os.path.splitext(orig)[1].lower()

    try:
        with open(trans, 'r', encoding='utf-8') as f:
            text = f.read()

        if ext in ('.docx','.doc'):
            result = rebuild_docx(orig, text, out)
        elif ext == '.pdf':
            wk = find_wk()
            if wk:
                result = pdf_via_wk(text, out, wk)
            else:
                result = pdf_via_reportlab(text, out)
        else:
            shutil.copy(trans, out)
            result = {'success':True,'method':'copy'}

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        import traceback
        print(json.dumps({'error':str(e),'trace':traceback.format_exc()}, ensure_ascii=False))
        sys.exit(1)

if __name__ == '__main__':
    main()
