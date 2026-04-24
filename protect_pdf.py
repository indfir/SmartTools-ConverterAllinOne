#!/usr/bin/env python3
"""
PDF Password Protection using pypdf
Usage: python protect_pdf.py <input.pdf> <output.pdf> <password>
"""
import sys
import os
import subprocess

def ensure_pypdf():
    try:
        import pypdf
        return True
    except ImportError:
        pass
    try:
        subprocess.check_call(
            [sys.executable, '-m', 'pip', 'install', 'pypdf', '--quiet', '--disable-pip-version-check'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return True
    except Exception:
        return False

def protect_pdf(input_path, output_path, password):
    if not ensure_pypdf():
        print("Error: Could not install pypdf. Run: pip install pypdf", file=sys.stderr)
        sys.exit(2)

    from pypdf import PdfReader, PdfWriter

    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        writer.encrypt(user_password=password, owner_password=password, use_128bit=True)

        with open(output_path, 'wb') as f:
            writer.write(f)

        print(f"Success: {output_path}")

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python protect_pdf.py <input.pdf> <output.pdf> <password>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    pwd = sys.argv[3]

    if not os.path.exists(input_file):
        print(f"Error: File not found: {input_file}", file=sys.stderr)
        sys.exit(1)

    protect_pdf(input_file, output_file, pwd)
