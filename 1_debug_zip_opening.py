# debug_inspect_zip.py
# Usage: python debug_inspect_zip.py docs.zip
import zipfile, tempfile, os
from pathlib import Path
from bs4 import BeautifulSoup
import docx
from pypdf import PdfReader

def preview_docx(p):
    try:
        d = docx.Document(p)
        return "\\n".join([para.text for para in d.paragraphs])[:400]
    except Exception as e:
        return f"docx error: {e}"

def preview_html(p):
    try:
        with open(p, 'r', encoding='utf-8', errors='ignore') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        return soup.get_text()[:400]
    except Exception as e:
        return f"html error: {e}"

def preview_pdf(p):
    try:
        r = PdfReader(str(p))
        text = []
        for pg in r.pages[:3]:
            text.append(pg.extract_text() or "")
        return "\\n".join(text)[:400]
    except Exception as e:
        return f"pdf error: {e}"

def inspect(zip_path):
    tmp = Path(tempfile.mkdtemp(prefix='kb_debug_'))
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(tmp)
    print('Extracted to', tmp)
    for p in sorted(tmp.rglob('*')):
        if p.is_file():
            print('-', p.relative_to(tmp), p.suffix, p.stat().st_size, 'bytes')
            if p.suffix.lower()=='.docx':
                print('  preview:', preview_docx(p))
            elif p.suffix.lower() in ['.html', '.htm']:
                print('  preview:', preview_html(p))
            elif p.suffix.lower()=='.pdf':
                print('  preview:', preview_pdf(p))
            else:
                print('  (unsupported type preview skipped)')
    print('Done.')

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print('Usage: python debug_inspect_zip.py your_docs.zip')
        sys.exit(1)
    inspect(sys.argv[1])
