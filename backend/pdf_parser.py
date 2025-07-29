"""
Utility for parsing work order / delivery note PDFs to extract structured data.

This script uses the `pdfplumber` library to open and read PDF files.  It
implements a very simple heuristic to extract:

* The project reference (first long alphanumeric string containing digits)
* The site address (first occurrence of something that looks like an address)
* Product lines (lines that contain a product code and quantity)

Because document formats vary widely, you may need to customise the
regular expressions and heuristics below for your specific work order
templates.

Usage:

```
python pdf_parser.py path/to/your.pdf
```
"""

from __future__ import annotations

import re
import sys
import json
from typing import List, Dict

import pdfplumber


def parse_pdf(path: str) -> Dict[str, any]:
    reference = None
    site_address = None
    products: List[Dict[str, any]] = []
    try:
        with pdfplumber.open(path) as pdf:
            full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        raise RuntimeError(f"Failed to open PDF: {e}")

    # Find a project reference: a sequence of letters/numbers at least 6 chars
    ref_match = re.search(r"\b([A-Z0-9]{6,})\b", full_text)
    if ref_match:
        reference = ref_match.group(1)

    # Heuristically find an address: look for lines containing numbers and a street keyword
    for line in full_text.splitlines():
        if site_address:
            break
        if re.search(r"\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Way|Park)", line, re.IGNORECASE):
            site_address = line.strip()

    # Find product lines: look for lines with a product code (alphanumeric) and quantity
    product_lines = []
    for line in full_text.splitlines():
        # Example pattern: code (letters+digits) followed by quantity (digits)
        m = re.match(r"\s*(\w{3,})\s+(\d+)\s+(.+)", line)
        if m:
            code, qty, name = m.groups()
            try:
                quantity = int(qty)
            except ValueError:
                continue
            products.append({"code": code, "name": name.strip(), "quantity": quantity})

    return {
        "reference": reference,
        "site_address": site_address,
        "products": products,
    }


def main():  # pragma: no cover
    if len(sys.argv) < 2:
        print("Usage: python pdf_parser.py <path-to-pdf>")
        return
    path = sys.argv[1]
    result = parse_pdf(path)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()