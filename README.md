# SmartTools - Universal File Converter

Desktop application untuk convert, compress, merge, dan manipulate file.

## Cara Pakai

**Double-click `SmartTools.exe`** - Aplikasi langsung terbuka!

Tidak perlu install apapun, tidak perlu buka folder lain.

## Fitur

### Document Conversion
- PDF ↔ Word (DOCX)
- PDF ↔ Excel (XLSX)
- PDF ↔ PowerPoint (PPTX)
- PDF ↔ Images (PNG)
- PDF ↔ Text
- Image → PDF
- Text → PDF

### PDF Tools
- Merge PDFs
- Split PDF
- Compress PDF
- Rotate PDF
- Extract text from PDF
- Edit PDF (add text, watermark, draw)
- E-Sign PDF

### Image Tools
- Compress Image
- Resize Image
- Convert format (PNG ↔ JPG)

### Text & Data
- JSON Formatter
- CSV ↔ JSON Converter
- Base64 Encode/Decode
- URL Encode/Decode
- Word Counter
- Markdown Preview

### Calculators
- Basic Calculator
- Color Converter (HEX ↔ RGB)

### QR Code
- Generate QR Code
- Read QR Code

## Struktur File

```
SmartTools/
├── SmartTools.exe       ← Double-click ini untuk jalankan
├── index.html           ← Main HTML
├── styles.css           ← Styling
├── app.js               ← Logic
├── icon.png             ← App icon
├── package.json         ← Config
├── node_modules/        ← Dependencies
├── nwjs/                ← NW.js runtime (jangan dihapus)
└── README.md            ← Dokumentasi ini
```

## Distribusi

Untuk mendistribusikan aplikasi:

1. **Zip seluruh folder** - User tinggal extract dan jalankan SmartTools.exe
2. **Atau buat installer** dengan tools seperti Inno Setup atau NSIS

## Requirements

- Windows 7 atau lebih baru
- Tidak perlu install apapun (standalone)

## Teknologi

- **NW.js** - Chromium-based desktop runtime
- **PDF-Lib** - PDF manipulation
- **PDF.js** - PDF rendering
- **XLSX** - Excel file handling
- **Mammoth** - DOCX parsing
- **PptxGenJS** - PowerPoint generation

## Troubleshooting

### App tidak bisa buka?
- Pastikan semua file dalam folder lengkap (jangan hapus folder `nwjs`)
- Cek antivirus (kadang false positive untuk .exe baru)

### Convert gagal?
- Pastikan file yang diupload sesuai format
- Cek koneksi internet (library dimuat dari CDN)

### File tidak bisa disimpan?
- File akan didownload ke folder Downloads default
- Gunakan "Save As" untuk pilih lokasi lain

## License

Free to use for personal and commercial projects.
