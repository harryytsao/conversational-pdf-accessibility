# Accessible PDF Converter

This project is a **Next.js application** for making PDF files fully accessible. It extracts reading order, alternative text for images, tables as HTML, and math content as MathML. Users can then export PDFs into accessible formats like HTML, Word, or EPUB.  

The goal is to **empower blind and low-vision users** to access PDF content in a way that is compatible with screen readers and other assistive technology.

---

## **Repository**

[https://github.com/harryytsao/conversational-pdf-accessibility](https://github.com/harryytsao/conversational-pdf-accessibility)

---

## **Features**

- Upload PDFs via a drag-and-drop interface.  
- Analyze PDFs to determine reading order and detect content types:  
  - Text layers  
  - Images (generate alt text)  
  - Tables (export as HTML tables)  
  - Mathematical content (export as MathML)  
- Export processed PDFs to:  
  - **HTML**  
  - **Word (.docx)**  
  - **EPUB**  
- Accessible UI with keyboard support and screen reader compatibility.  

---

## **Tech Stack**

- **Next.js 15+ (App Router)** – backend + frontend framework  
- **React** – frontend UI  
- **pdf-lib** – PDF parsing and metadata extraction  
- **react-dropzone** – drag-and-drop file uploads  
---

## **Prerequisites**

- Node.js v20+  
- npm  
- Git (if cloning the repository)  

---

## **Installation**

1. **Clone the repository**

```bash
git clone https://github.com/harryytsao/conversational-pdf-accessibility.git
cd conversational-pdf-accessibility
2. **Install dependencies**

```bash
npm install

3. Create required folders
Upload
Data

They may already exist.

