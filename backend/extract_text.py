#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_text.py — Extract plain text from PDF or DOCX files
Dependencies: python-docx pdfplumber pypdf
Install: pip install python-docx pdfplumber pypdf
"""

import sys, os, json, subprocess

def pip_install_fallback(*packages):
    """Fallback installer — runs only if deps missing. Should be pre-installed."""
    sys.stderr.write(f"[aman] WARNING: Installing missing packages: {packages}\n"
                     "Install them permanently: pip install " + " ".join(packages) + "\n")
    cmd = [sys.executable, '-m', 'pip', 'install', '--quiet',
           '--disable-pip-version-check', *packages]
    if sys.platform != 'win32':
        cmd.append('--break-system-packages')
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Check deps once — install only if missing (should already be there in Docker/prod)
def ensure():
    missing = []
    try: import docx
    except ImportError: missing.append('python-docx')
    try: import pdfplumber
    except ImportError: missing.append('pdfplumber')
    try: from pypdf import PdfReader
    except ImportError: missing.append('pypdf')
    try: from reportlab.lib.pagesizes import A4
    except ImportError: missing.append('reportlab')
    if missing: pip_install_fallback(*missing)

ensure()

def extract_pdf(path):
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and text.strip():
                    pages.append(f"[Page {i+1}]\n{text.strip()}")
        if pages: return "\n\n".join(pages)
    except Exception as e:
        sys.stderr.write(f"pdfplumber failed: {e}\n")

    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                pages.append(f"[Page {i+1}]\n{text.strip()}")
        if pages: return "\n\n".join(pages)
        raise RuntimeError("No text — PDF may be image-only (scanned).")
    except RuntimeError: raise
    except Exception as e:
        raise RuntimeError(f"PDF extraction failed: {e}")

def extract_docx(path):
    from docx import Document
    doc = Document(path)
    parts = []
    for para in doc.paragraphs:
        txt = para.text.strip()
        if not txt: continue
        style = (para.style.name or '') if para.style else ''
        if 'Heading 1' in style or style == 'Title': parts.append(f"# {txt}")
        elif 'Heading 2' in style: parts.append(f"## {txt}")
        elif 'Heading 3' in style: parts.append(f"### {txt}")
        else: parts.append(txt)
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            seen = []
            for c in cells:
                if not seen or seen[-1] != c: seen.append(c)
            line = " | ".join(seen)
            if line.strip(): parts.append(line)
    if parts: return "\n\n".join(parts)
    raise RuntimeError("Document appears empty.")

def extract_doc_legacy(path):
    try:
        result = subprocess.run(['antiword', path], capture_output=True, timeout=30)
        if result.returncode == 0:
            return result.stdout.decode('utf-8', errors='replace')
    except Exception: pass
    raise RuntimeError("Cannot read legacy .doc — convert to .docx first.")

def main():
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: extract_text.py <file>"}))
        sys.exit(1)

    path = sys.argv[1]
    if not os.path.exists(path):
        print(json.dumps({"error": f"File not found: {path}"}))
        sys.exit(1)

    ext = os.path.splitext(path)[1].lower()
    try:
        if   ext == '.pdf':  text = extract_pdf(path);        doc_type = 'pdf'
        elif ext == '.docx': text = extract_docx(path);       doc_type = 'docx'
        elif ext == '.doc':  text = extract_doc_legacy(path); doc_type = 'doc'
        else:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                text = f.read()
            doc_type = 'text'

        print(json.dumps({
            "success": True, "type": doc_type,
            "wordCount": len(text.split()), "text": text
        }, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)

if __name__ == '__main__':
    main()
