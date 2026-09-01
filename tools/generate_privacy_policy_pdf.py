import os
import sys
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to add headers and 'Page X of Y' footers dynamically.
    """
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Colors
        primary_navy = colors.HexColor("#0F172A")
        accent_blue = colors.HexColor("#2563EB")
        light_slate = colors.HexColor("#94A3B8")
        
        page_w, page_h = A4
        margin = 40

        # Top Banner Line
        self.setFillColor(primary_navy)
        self.rect(margin, page_h - 25, page_w - (2 * margin), 3, fill=True, stroke=False)
        self.setFillColor(accent_blue)
        self.rect(margin, page_h - 25, 80, 3, fill=True, stroke=False)

        # Running Header (pages > 1)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#475569"))
            self.drawString(margin, page_h - 20, "KROZENDA PLATFORM PRIVACY POLICY")
            self.setFont("Helvetica", 8)
            self.drawRightString(page_w - margin, page_h - 20, "COMPLIANCE & LEGAL DOCUMENT")

        # Bottom Footer Line
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(margin, 40, page_w - margin, 40)

        # Footer Text
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(margin, 28, "Confidential — Krozenda Platform (Appzeto) — DPDP Act 2023 Compliant")
        
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(page_w - margin, 28, page_str)

        self.restoreState()


def build_pdf(pdf_filename):
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=45,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    c_primary = colors.HexColor("#0F172A")      # Slate 900
    c_secondary = colors.HexColor("#1E293B")    # Slate 800
    c_brand = colors.HexColor("#2563EB")        # Royal Blue
    c_text = colors.HexColor("#334155")         # Slate 700
    c_bg_light = colors.HexColor("#F8FAFC")     # Slate 50
    c_border = colors.HexColor("#E2E8F0")       # Slate 200
    c_callout_bg = colors.HexColor("#EFF6FF")   # Blue 50

    # Custom Typography Styles
    doc_title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=c_primary,
        spaceAfter=4
    )

    doc_subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=c_brand,
        spaceAfter=12
    )

    meta_key_style = ParagraphStyle(
        'MetaKey',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=c_secondary
    )

    meta_val_style = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=c_text
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_primary,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=c_brand,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_text,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    callout_text = ParagraphStyle(
        'Callout_Text',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E3A8A")
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=c_text
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=c_primary
    )

    story = []

    # Title & Subtitle Header
    story.append(Paragraph("KROZENDA PLATFORM PRIVACY POLICY", doc_title_style))
    story.append(Paragraph("DATA PROTECTION, PRIVACY & COMPLIANCE POLICY FOR USERS & CLIENTS", doc_subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=0, spaceAfter=8))

    # Metadata Table Block
    meta_data = [
        [
            Paragraph("Document Version:", meta_key_style), Paragraph("1.0", meta_val_style),
            Paragraph("Effective Date:", meta_key_style), Paragraph("August 25, 2026", meta_val_style)
        ],
        [
            Paragraph("Applicable Entity:", meta_key_style), Paragraph("Krozenda Platform (Appzeto)", meta_val_style),
            Paragraph("Governing Regulations:", meta_key_style), Paragraph("DPDP Act 2023 / IT Act 2000 (India)", meta_val_style)
        ],
        [
            Paragraph("User Roles Covered:", meta_key_style), Paragraph("Buyers (B2C/B2B), Sellers, Suppliers, Dropshippers", meta_val_style),
            Paragraph("Document Classification:", meta_key_style), Paragraph("Public / Client Sharing Document", meta_val_style)
        ]
    ]

    t_meta = Table(meta_data, colWidths=[105, 155, 110, 145])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_bg_light),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#F1F5F9")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # Executive Summary Box
    summary_html = """<b>EXECUTIVE SUMMARY:</b><br/>
    Krozenda is committed to safeguarding personal and commercial data across its multi-model marketplace (Direct Dropshipping, Seller Marketplace, Own Stock Selling). This policy outlines how user and client data is collected, stored, processed, and secured in compliance with India's <b>Digital Personal Data Protection (DPDP) Act 2023</b>, <b>IT Act 2000</b>, and <b>RBI Payment Aggregator</b> guidelines.
    """
    t_summary = Table([[Paragraph(summary_html, callout_text)]], colWidths=[515])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_callout_bg),
        ('BOX', (0,0), (-1,-1), 1, c_brand),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 10))

    # 1. Scope & Applicability
    story.append(Paragraph("1. SCOPE & APPLICABILITY", h1_style))
    story.append(Paragraph(
        "This Privacy Policy applies to all individuals, B2C retail customers, B2B wholesale buyers, marketplace sellers, manufacturers, distributors, dealers, traders, and direct dropshipping partners using Krozenda's Web Portal and Mobile Applications (Android & iOS).",
        body_style
    ))
    story.append(Paragraph("Krozenda operates three integrated business models on a unified platform core:", body_style))
    story.append(Paragraph("• <b>Direct Dropshipping (Model A):</b> Onboarded suppliers list products; customer orders are auto-forwarded to suppliers for direct dispatch.", bullet_style))
    story.append(Paragraph("• <b>Marketplace (Model B):</b> Registered sellers operate independent storefronts, managing stock, pricing, and fulfillment.", bullet_style))
    story.append(Paragraph("• <b>Own Stock Selling (Model C):</b> Platform-owned inventory listed and fulfilled directly from Krozenda central warehouses.", bullet_style))

    # 2. Information We Collect
    story.append(Paragraph("2. INFORMATION WE COLLECT", h1_style))
    story.append(Paragraph("To deliver marketplace services, execute split payouts, and satisfy statutory KYC requirements, Krozenda collects the following data categories:", body_style))

    coll_table_data = [
        [Paragraph("Category", table_header_style), Paragraph("User Types Covered", table_header_style), Paragraph("Data Fields Collected", table_header_style)],
        [
            Paragraph("Personal Account Data", table_cell_bold),
            Paragraph("All Users (Buyers, Sellers, Staff)", table_cell_style),
            Paragraph("Full Name, Email Address, Mobile Phone Number, Profile Photo, Account Password (Encrypted/Hashed).", table_cell_style)
        ],
        [
            Paragraph("Shipping & Delivery Data", table_cell_bold),
            Paragraph("B2C & B2B Buyers", table_cell_style),
            Paragraph("Recipient Name, Phone Number, Delivery Address, Pincode, Billing Address, GSTIN (for B2B tax invoices).", table_cell_style)
        ],
        [
            Paragraph("Statutory & KYC Data", table_cell_bold),
            Paragraph("Sellers, Vendors, Dropshippers", table_cell_style),
            Paragraph("Company Name, PAN Card, Aadhaar, GSTIN, FSSAI License, Cancelled Cheque, Address Proof, Trade License.", table_cell_style)
        ],
        [
            Paragraph("Financial & Settlement", table_cell_bold),
            Paragraph("Sellers & Dropshippers", table_cell_style),
            Paragraph("Bank Account Number, IFSC Code, Account Holder Name, Razorpay Route Linked Account ID.", table_cell_style)
        ],
        [
            Paragraph("Technical & Telemetry", table_cell_bold),
            Paragraph("App & Web Users", table_cell_style),
            Paragraph("IP Address, Device Model, OS Version, Firebase FCM Push Tokens, Session Logs, Cookie Identifiers.", table_cell_style)
        ],
    ]

    t_coll = Table(coll_table_data, colWidths=[110, 125, 280])
    t_coll.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_secondary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_coll)
    story.append(Spacer(1, 10))

    # Financial Data Security Banner
    fin_sec_text = "<b>CRITICAL PAYMENT SECURITY NOTICE:</b> Krozenda <b>DOES NOT</b> store full credit/debit card numbers, CVVs, or bank PINs on its servers. All payments and split settlements are processed via <b>Razorpay Software Pvt. Ltd.</b> in compliance with PCI-DSS standards and RBI Payment Aggregator frameworks."
    t_fin = Table([[Paragraph(fin_sec_text, callout_text)]], colWidths=[515])
    t_fin.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF3C7")), # Light amber
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#D97706")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_fin)
    story.append(Spacer(1, 10))

    # 3. How We Collect Information
    story.append(Paragraph("3. HOW WE COLLECT INFORMATION", h1_style))
    story.append(Paragraph("We collect information via three primary operational flows:", body_style))
    story.append(Paragraph("1. <b>Direct User Input:</b> Data submitted during account setup, checkout, KYC submission, digital policy acceptance, and customer service requests.", bullet_style))
    story.append(Paragraph("2. <b>Automated App/Web Sync:</b> Session cookies, browser local storage, and FCM device tokens.", bullet_style))
    story.append(Paragraph("3. <b>Integrated Third-Party Webhooks:</b> Payment status callbacks from Razorpay, shipping updates from Shiprocket, and delivery receipts from SMS India Hub.", bullet_style))

    # 4. Purpose & Legal Basis of Data Processing
    story.append(Paragraph("4. PURPOSE & LEGAL BASIS OF DATA PROCESSING", h1_style))
    story.append(Paragraph("Krozenda processes personal and commercial data strictly for legitimate operational purposes:", body_style))
    story.append(Paragraph("• <b>Order & Cart Splitting:</b> Splitting multi-vendor cart orders into vendor-specific sub-orders for independent dispatch and GST invoicing.", bullet_style))
    story.append(Paragraph("• <b>Split Vendor Settlement:</b> Auto-transferring vendor earnings net of platform commission via Razorpay Route.", bullet_style))
    story.append(Paragraph("• <b>Logistics Management:</b> Transmitting shipping labels, pickup manifests, and AWB tracking via Shiprocket.", bullet_style))
    story.append(Paragraph("• <b>KYC Human Verification:</b> Admin verification of vendor PAN, GSTIN, FSSAI, and bank details prior to onboarding.", bullet_style))
    story.append(Paragraph("• <b>Transactional Alerts:</b> Sending OTPs, order updates, and invoices via SMS India Hub (DLT registered) and SMTP email.", bullet_style))
    story.append(Paragraph("• <b>Tax & Statutory Compliance:</b> Complying with Indian GST TCS (Sec 52), TDS (Sec 194-O), and statutory audit laws.", bullet_style))

    # 5. Data Sharing & Third-Party Service Providers
    story.append(Paragraph("5. DATA SHARING & THIRD-PARTY INTEGRATIONS", h1_style))
    story.append(Paragraph("Krozenda does <b>NOT</b> sell or monetize user data. Information is shared strictly on a need-to-know basis with approved integrations:", body_style))

    third_party_data = [
        [Paragraph("Integration Partner", table_header_style), Paragraph("Role / Domain", table_header_style), Paragraph("Purpose & Data Shared", table_header_style)],
        [
            Paragraph("Razorpay Software Pvt. Ltd.", table_cell_bold),
            Paragraph("Payment Gateway & Route", table_cell_style),
            Paragraph("Processes customer payments and routes split settlements to vendor linked bank accounts.", table_cell_style)
        ],
        [
            Paragraph("Shiprocket (Bigfoot Retail)", table_cell_bold),
            Paragraph("Logistics Aggregator", table_cell_style),
            Paragraph("Generates AWBs, pickup manifests, and courier tracking using buyer delivery addresses.", table_cell_style)
        ],
        [
            Paragraph("SMS India Hub", table_cell_bold),
            Paragraph("Telecom / SMS Gateway", table_cell_style),
            Paragraph("Delivers mobile OTPs, order alerts, and registration notifications via DLT approved templates.", table_cell_style)
        ],
        [
            Paragraph("Firebase (Google Cloud)", table_cell_bold),
            Paragraph("Push Notification Service", table_cell_style),
            Paragraph("Pushes real-time order alerts to Android and iOS mobile devices via FCM device tokens.", table_cell_style)
        ],
        [
            Paragraph("Vendors & Dropshippers", table_cell_bold),
            Paragraph("Fulfillment Partners", table_cell_style),
            Paragraph("Receives delivery address and recipient details strictly for dispatching ordered items.", table_cell_style)
        ],
        [
            Paragraph("Law Enforcement & Regulatory", table_cell_bold),
            Paragraph("Statutory Authorities", table_cell_style),
            Paragraph("Data disclosed only upon receipt of official court orders or statutory legal mandates in India.", table_cell_style)
        ]
    ]

    t_tp = Table(third_party_data, colWidths=[120, 110, 285])
    t_tp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_secondary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_tp)
    story.append(Spacer(1, 10))

    # 6. Data Storage, Security & Retention
    story.append(Paragraph("6. DATA STORAGE, SECURITY & RETENTION", h1_style))
    story.append(Paragraph("• <b>Encryption & Access Controls:</b> Data in transit is protected using TLS 1.3/HTTPS. Passwords are hashed using bcrypt. Access is regulated across 13 system roles via granular Role-Based Access Control (RBAC).", body_style))
    story.append(Paragraph("• <b>Data Retention Schedules:</b> Account data is stored during account lifetime. Order, tax, and GST settlement records are retained for <b>7 years</b> as mandated by Indian financial laws.", body_style))

    # 7. User Rights under DPDP Act 2023
    story.append(Paragraph("7. USER RIGHTS UNDER DPDP ACT 2023", h1_style))
    story.append(Paragraph("Under India's Digital Personal Data Protection Act (DPDP Act 2023), users (Data Principals) hold the following enforceable rights:", body_style))
    story.append(Paragraph("1. <b>Right to Access:</b> Right to request a summary of personal data processed and third parties shared with.", bullet_style))
    story.append(Paragraph("2. <b>Right to Correction:</b> Right to request correction or updating of inaccurate personal or business records.", bullet_style))
    story.append(Paragraph("3. <b>Right to Erasure:</b> Right to request account deletion, subject to statutory tax retention rules.", bullet_style))
    story.append(Paragraph("4. <b>Right to Withdraw Consent:</b> Right to revoke consent for non-essential processing at any time.", bullet_style))
    story.append(Paragraph("5. <b>Right to Nominate:</b> Right to nominate an individual to exercise data rights in case of incapacity.", bullet_style))

    # 8. Children's Privacy & Age Limit
    story.append(Paragraph("8. CHILDREN'S PRIVACY & ELIGIBILITY", h1_style))
    story.append(Paragraph("Krozenda services are strictly reserved for individuals aged <b>18 years or older</b> and legally registered business entities. We do not knowingly collect personal data from minors.", body_style))

    # 9. Grievance Redressal & Contact Details
    story.append(Paragraph("9. GRIEVANCE REDRESSAL & CONTACT DETAILS", h1_style))
    story.append(Paragraph("In compliance with the IT Act 2000 and DPDP Act 2023, Krozenda has appointed a Grievance Officer to address user data concerns:", body_style))

    grievance_data = [
        [Paragraph("Grievance Office Field", table_header_style), Paragraph("Official Details", table_header_style)],
        [Paragraph("Designation:", table_cell_bold), Paragraph("Grievance Officer & Data Protection Officer", table_cell_style)],
        [Paragraph("Operating Entity:", table_cell_bold), Paragraph("Krozenda Platform (Appzeto)", table_cell_style)],
        [Paragraph("Official Privacy Email:", table_cell_bold), Paragraph("privacy@krozenda.com / support@appzeto.com", table_cell_style)],
        [Paragraph("Escalation Email:", table_cell_bold), Paragraph("grievance@krozenda.com", table_cell_style)],
        [Paragraph("Acknowledgment SLA:", table_cell_bold), Paragraph("Within 48 hours of receipt", table_cell_style)],
        [Paragraph("Resolution SLA:", table_cell_bold), Paragraph("Within 30 calendar days", table_cell_style)],
    ]
    t_griev = Table(grievance_data, colWidths=[150, 365])
    t_griev.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_brand),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_griev)
    story.append(Spacer(1, 14))

    # Client / Partner Acceptance Box
    sign_box_html = """<b>CLIENT / PARTNER ACKNOWLEDGEMENT:</b><br/>
    By sharing, accepting, or integrating with the Krozenda Platform, client entities and platform users confirm agreement to the terms outlined in this Privacy Policy.
    <br/><br/>
    <b>Authorized Signatory / Client Signature:</b> ___________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Date:</b> ______________
    """
    t_sign = Table([[Paragraph(sign_box_html, body_style)]], colWidths=[515])
    t_sign.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_bg_light),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_sign)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated at: {pdf_filename}")

if __name__ == "__main__":
    output_pdf = os.path.join("tools", "Krozenda_Privacy_Policy.pdf")
    build_pdf(output_pdf)
