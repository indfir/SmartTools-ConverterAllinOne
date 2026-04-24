#!/usr/bin/env python3
"""
DOCX to PDF Converter using docx2pdf
Requires Microsoft Word to be installed on Windows.
Produces high-fidelity PDF output identical to "Save as PDF" in Word.
"""

import sys
import os
from docx2pdf import convert


def convert_docx_to_pdf(docx_path, pdf_path):
    """Convert DOCX to PDF using docx2pdf"""
    try:
        # docx2pdf uses MS Word COM interface on Windows
        # It preserves all formatting, fonts, images, and layout exactly as in Word
        convert(docx_path, pdf_path)
        return True
    except Exception as e:
        raise Exception(f"docx2pdf conversion failed: {str(e)}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python docx_to_pdf.py <input.docx> <output.pdf>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.exists(input_file):
        print(f"Error: File not found: {input_file}")
        sys.exit(1)

    try:
        print(f"Converting {input_file} to {output_file}...")
        convert_docx_to_pdf(input_file, output_file)
        print(f"Success: {output_file}")
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
