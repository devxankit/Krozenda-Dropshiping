# KROZENDA PLATFORM PRIVACY POLICY

**Document Version:** 1.0  
**Effective Date:** August 25, 2026  
**Last Updated:** August 25, 2026  
**Applicable Entity:** Krozenda Marketplace Platform (Operated by / under Appzeto)  
**Jurisdiction & Governing Law:** Republic of India (DPDP Act 2023, IT Act 2000, SPDI Rules 2011)  

---

## EXECUTIVE SUMMARY

Krozenda ("Platform", "we", "us", or "our") is committed to protecting the privacy, confidentiality, and security of personal and business data entrusted to us by our users. This Privacy Policy governs the collection, storage, processing, transfer, and protection of data across all Krozenda surfaces—including our Web Portal, Buyer Mobile Application (Android/iOS), and Seller/Supplier Management Portal.

Whether you interact with Krozenda as a **B2C Retail Customer**, **B2B Wholesale Buyer**, **Marketplace Seller**, **Manufacturer**, **Distributor**, **Dealer**, **Trader**, or **Direct Dropshipping Partner**, this document explains your privacy rights and how your data is handled in strict compliance with the **Digital Personal Data Protection (DPDP) Act, 2023**, the **Information Technology Act, 2000**, and applicable **Reserve Bank of India (RBI)** payment regulations.

---

## 1. SCOPE & APPLICABILITY

This Privacy Policy applies to all individuals and business entities accessing or utilizing the Krozenda platform across its three operational business models:
1. **Direct Dropshipping Model:** Supplier products integrated into platform catalog; customer orders auto-forwarded for supplier fulfillment.
2. **Amazon-style Marketplace Model:** Registered sellers listing products and dispatching directly or via designated logisticians.
3. **Own Stock Selling Model:** Inventory owned and fulfilled directly from Krozenda central warehouses.

### Applicable User Roles (RBAC):
- **Buyers:** B2C Retail Customers and B2B Commercial Buyers (Dealers, Wholesalers, Distributors, Traders).
- **Sellers & Partners:** Marketplace Sellers, Manufacturers, Companies, Traders, Dealers, Distributors, and Dropshipping Partners.
- **Administrative Users:** Authorized Admin and Operational Staff.

By creating an account, accessing, browsing, or conducting transactions on Krozenda, you explicitly consent to the collection, use, and disclosure of your information as described herein.

---

## 2. INFORMATION WE COLLECT

We collect personal and business information necessary to deliver marketplace services, verify legal compliance, process payments, and facilitate logistics fulfillment.

### 2.1 Information Provided Directly by You

| User Type | Category | Data Fields Collected |
| :--- | :--- | :--- |
| **All Users** | Personal Account Data | Full Name, Email Address, Mobile Phone Number, Profile Photo, Account Password (Hashed). |
| **Buyers (B2C & B2B)** | Shipping & Billing | Delivery Addresses, Recipient Contact Names & Phone Numbers, Billing Address, Tax Identification (GSTIN for B2B tax invoices). |
| **Sellers & Suppliers** | Business Identification | Legal Entity Name, Trade Name, Registered Office Address, Business Type, Date of Incorporation. |
| **Sellers & Suppliers** | Statutory & KYC Docs | Permanent Account Number (PAN), Aadhaar Card details/copy, Goods and Services Tax Identification Number (GSTIN), FSSAI License (for food products), Cancelled Cheque, Address Proof, Certificate of Incorporation / Partnership Deed. |
| **Sellers & Suppliers** | Financial & Settlement | Bank Account Number, IFSC Code, Account Holder Name, Razorpay Route Linked Account ID. |

### 2.2 Information Collected Automatically

- **Device & Technical Identifiers:** IP Address, Device Model, Operating System version, Browser type, Unique Device Identifiers (Firebase Cloud Messaging - FCM push tokens).
- **Usage & Activity Logs:** Pages viewed, search queries, cart additions, session timestamps, navigation paths, clickstream data.
- **Location Data:** Coarse geographical location based on IP address and postal pincode input for delivery feasibility checks.

### 2.3 Financial & Payment Transaction Data
- All payment processing is conducted securely via **Razorpay Software Private Limited**.
- **Payment Method Details:** Card issuer, UPI ID handle, net banking reference IDs.
- **Security Notice:** Krozenda **NEVER stores full credit card numbers, debit card numbers, PINs, or CVVs** on its servers. All sensitive financial data is tokenized and processed in full compliance with Payment Card Industry Data Security Standards (PCI-DSS) and RBI Payment Aggregator (PA) guidelines.

---

## 3. HOW WE COLLECT INFORMATION

We gather information through three principal channels:
1. **Direct User Input:** Forms submitted during account registration, seller onboarding, KYC upload, checkout, customer support inquiries, and digital agreement acceptances.
2. **Automated Technologies:** Secure HTTP cookies, local storage objects, web session tokens, and Firebase SDK integrations.
3. **Integrated Service Webhooks:** Automated callbacks from trusted third-party providers:
   - **Razorpay:** Payment capture verification, settlement confirmations, refund status updates.
   - **Shiprocket:** Shipping label generation, AWB assignment, real-time dispatch and delivery status tracking.
   - **SMS India Hub:** Delivery receipts for OTPs and transactional notifications.

---

## 4. PURPOSE & LEGAL BASIS OF DATA PROCESSING

We process your personal and business data under valid legal grounds (contractual necessity, statutory obligation, and explicit user consent) for the following specific purposes:

1. **Marketplace Fulfillment:** Processing cart items, splitting multi-vendor orders into sub-orders, routing dispatch details to respective suppliers, and facilitating Shiprocket logistics pick-ups and deliveries.
2. **Split Settlement Execution:** Calculating commissions, vendor payouts, and executing split settlements via Razorpay Route directly to vendor bank accounts in accordance with RBI guidelines.
3. **Statutory KYC & Compliance:** Verifying seller identity (PAN/GSTIN/Bank details) through human admin review to prevent fraud, tax evasion, and commercial misrepresentation (GST TCS Sec 52 and TDS Sec 194-O compliance).
4. **Transactional Communication:** Transmitting login/registration OTPs, order confirmation alerts, shipment tracking updates, and tax invoices via **SMS India Hub**, **SMTP Email**, and **Firebase FCM**.
5. **Platform Security & Auditing:** Detecting unauthorized access, preventing fraudulent transactions, enforcing Role-Based Access Control (RBAC), and maintaining immutable audit logs.
6. **Dispute Resolution & Customer Care:** Responding to queries, processing return requests, managing RTO (Return to Origin) shipments, and resolving payment discrepancies.

---

## 5. DATA SHARING & THIRD-PARTY INTEGRATIONS

Krozenda strictly prohibits the sale, rental, or commercial trade of user personal data. Information is shared strictly on a **need-to-know basis** with vetted third-party service providers required for core operation:

| Service Provider | Domain / Role | Purpose of Data Sharing | Data Shared |
| :--- | :--- | :--- | :--- |
| **Razorpay Software Pvt. Ltd.** | Payment Gateway & Route | Payment processing, fraud screening, split vendor payouts. | Order value, customer contact, vendor bank linked account ID. |
| **Shiprocket (Bigfoot Retail)** | Logistics Aggregator | Order pickup scheduling, AWB generation, courier tracking. | Delivery address, pincode, recipient name, contact phone, item weight. |
| **SMS India Hub** | Telecom / SMS Gateway | OTP delivery, critical order updates, transactional alerts. | Mobile phone number, DLT-approved template parameters. |
| **Firebase Cloud Messaging (Google)** | Mobile Push Gateway | Delivering push notifications to Android and iOS mobile applications. | Device FCM token, order notification title/body. |
| **Sellers & Suppliers (Model A & B)** | Vendor Partners | Dispatching ordered products from supplier warehouses. | Delivery address, customer recipient name, contact number, ordered items. |
| **Government & Law Enforcement** | Regulatory Authorities | Statutory compliance under Indian law or valid legal court order. | KYC records, tax invoice data, transaction logs upon legal demand. |

---

## 6. DATA STORAGE, SECURITY & RETENTION

### 6.1 Security Measures
We implement comprehensive administrative, technical, and physical safeguards designed to protect personal data against accidental loss, unauthorized access, alteration, or disclosure:
- **Encryption in Transit:** All network communication is secured using TLS 1.3 / HTTPS encryption.
- **Data Encryption at Rest:** Sensitive database fields (including user credentials and contact records in MongoDB) are stored using standard cryptographic algorithms. Passwords are cryptographically hashed using bcrypt with salt.
- **Access Control:** Restricted role-based permission system (13 distinct system roles) ensuring staff access data strictly on a job-requirement basis.
- **Network Security:** Firewalls, rate-limiting on authentication APIs, brute-force protection, and IP access restrictions.

### 6.2 Data Retention Policy
- **Active Accounts:** Personal data associated with active user accounts is retained for the duration of the account lifecycle.
- **Financial & Tax Records:** Transaction histories, invoices, GST compliance records, and settlement data are retained for **7 (seven) years** in accordance with Indian tax laws (Income Tax Act & CGST Act).
- **KYC Documentation:** Vendor KYC documentation is retained for the duration of the vendor relationship plus 5 years following account termination.
- **Deleted Accounts:** Upon account deletion request, personal identification data is scrubbed or anonymized, except where statutory retention is legally mandated.

---

## 7. USER RIGHTS UNDER INDIAN PRIVACY LAWS (DPDP ACT 2023)

In accordance with the Digital Personal Data Protection Act, 2023, users (Data Principals) possess the following rights regarding their personal data:

1. **Right to Information & Summary:** Request a summary of personal data being processed, processing activities, and identities of third parties with whom data has been shared.
2. **Right to Correction & Completion:** Request correction, updating, or completion of inaccurate, misleading, or incomplete personal or business information.
3. **Right to Erasure / Account Deletion:** Request the deletion of your personal data when processing is no longer necessary for the purpose collected, subject to statutory retention obligations.
4. **Right to Withdraw Consent:** Revoke previously granted consent for data processing at any time. Withdrawal does not affect the lawfulness of processing conducted prior to revocation.
5. **Right of Grievance Redressal:** Access ready means of grievance redressal provided by Krozenda regarding any act or omission respecting your data rights.
6. **Right to Nominate:** Nominate another individual to exercise your data protection rights in the event of death or incapacity.

To exercise any of these rights, please submit a formal request to our designated Grievance Officer using the contact details provided in Section 10.

---

## 8. COOKIES & TRACKING TECHNOLOGIES

Krozenda uses essential session cookies, local browser storage, and secure authentication tokens to:
- Maintain active user login sessions across page navigations.
- Retain shopping cart state for B2C and B2B users.
- Remember user preferences and pincode delivery feasibility choices.
- Safeguard against Cross-Site Request Forgery (CSRF) and automated bot access.

Users may adjust browser settings to reject non-essential cookies; however, disabling essential cookies will impair key functionality such as checkout and account access.

---

## 9. CHILDREN'S PRIVACY

The Krozenda platform is strictly intended for use by individuals who have attained the age of majority (**18 years or older**) and legal business entities capable of forming legally binding contracts under the Indian Contract Act, 1872. We do not knowingly collect or solicit personal data from minors under the age of 18. If we become aware that a minor has provided us with personal data, such information will be promptly deleted from our servers.

---

## 10. GRIEVANCE REDRESSAL & CONTACT DETAILS

In accordance with the Information Technology Act, 2000, the IT Rules 2011, and the Digital Personal Data Protection Act, 2023, Krozenda has appointed a designated **Grievance Officer** to address privacy concerns, data protection inquiries, and statutory complaints.

### Grievance Officer Contact Details:
- **Title / Designation:** Grievance Officer & Data Protection Officer
- **Entity:** Krozenda Marketplace Platform (Operated by Appzeto)
- **Official Email:** `privacy@krozenda.com` / `support@appzeto.com`
- **Helpdesk Escalation:** `grievance@krozenda.com`
- **Registered Office Address:** Appzeto Development Headquarters, India
- **Support Hours:** Monday to Friday, 09:30 AM to 06:30 PM IST

### Statutory Escalation & Resolution Timelines:
- **Acknowledgment SLA:** Within **48 hours** of receiving the complaint.
- **Resolution SLA:** Within **30 calendar days** from receipt of complete grievance details.

---

## 11. POLICY UPDATES & MODIFICATIONS

Krozenda reserves the right to update, modify, or revise this Privacy Policy at any time to reflect operational changes, platform enhancements, or evolving legal and regulatory mandates. 

When material changes are made, we will notify users via prominent notices on our website portal, in-app notifications, or direct email alerts. The "Effective Date" at the top of this document indicates the latest revision timestamp. Continued use of the platform following notification constitutes acceptance of the updated policy terms.

---

### ACKNOWLEDGEMENT & DIGITAL ACCEPTANCE
*By registering an account, clicking "I Agree", onboarding as a Seller/Supplier, or completing a transaction on Krozenda, you acknowledge that you have read, understood, and agreed to be bound by all terms outlined in this Privacy Policy.*
