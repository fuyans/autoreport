# Batch DOCX Generator

Generate multiple documents from one template and a CSV or XLSX data file. The template uses placeholders in double braces (e.g. `{{name}}`, `{{date}}`). Each row in the data file becomes one document; column headers must match the placeholder names. You can output **DOCX**, **PDF**, or **both**. Output filenames are taken from the **first column** of your data (e.g. first column `Name` with value `Alice` → `Alice.docx` / `Alice.pdf`).

## How it works

1. **Template DOCX**: A Word document with placeholders like `{{name}}` and `{{title}}`.
2. **Data file**: CSV or XLSX with a header row. Column names must match the placeholders (e.g. column `name` for `{{name}}`). The **first column** is used as the base name for each generated file.
3. **Output format**: Choose DOCX only, PDF only, or both. The app produces one file (or two when “both”) per data row and returns them in a ZIP file (`reports.zip`).

Use **UTF-8** encoding for CSV files. **PDF output requires LibreOffice to be installed on the machine running the backend** (e.g. [LibreOffice](https://www.libreoffice.org/) on Windows/Mac/Linux).

## Run the app

### Backend

```bash
cd backend
npm install
npm run dev
```

Server runs at `http://localhost:3000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api` to the backend.

Open `http://localhost:5173` in a browser, upload the template and data file, choose output format (DOCX / PDF / both), then click **Generate files** to download the ZIP.

**Deploy on AWS EC2 (Amazon Linux):** see [DEPLOY.md](DEPLOY.md).

## Placeholder convention

- In the template, use `{{placeholderName}}` (double curly braces).
- In the CSV/XLSX, the first row is the header. Use the same names as the placeholders (without the braces). The **first column** is used as the output file name (e.g. first column `name`, value `Alice` → `Alice.docx`). For example:
  - Template: `Hello {{name}}, date: {{date}}.`
  - Data columns: `name`, `date`
  - Row 1: `Alice`, `2025-01-15` → file `Alice.docx` (and/or `Alice.pdf`) with "Hello Alice, date: 2025-01-15."

Column names are trimmed; empty or missing values are replaced with an empty string. If the first column is empty for a row, the file is named `report_1`, `report_2`, etc. Duplicate first-column values get a suffix (e.g. `Alice_2.docx`).
