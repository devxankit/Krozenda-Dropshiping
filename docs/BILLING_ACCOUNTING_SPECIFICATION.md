# Krozenda Platform: Billing, Accounting & Settlement Technical Specification

> **Document Version:** 1.0  
> **Status:** Approved Architecture Specification  
> **Scope:** Backend & Frontend Implementation Blueprint for Krozenda Marketplace & Dropshipping Platform

---

## Table of Contents
1. [Executive Architectural Vision](#1-executive-architectural-vision)
2. [Example 1: Marketplace Seller Billing & Accounting Specification](#2-example-1-marketplace-seller-billing--accounting-specification)
3. [Example 2: Dropshipping Vendor Billing & Accounting Specification](#3-example-2-dropshipping-vendor-billing--accounting-specification)
4. [RazorpayX Payout System & Automated Settlement Architecture](#4-razorpayx-payout-system--automated-settlement-architecture)
5. [In-House Admin Accounting Module (Tally/Zoho Style) Specification](#5-in-house-admin-accounting-module-tallyzoho-style-specification)
6. [Role-Based Access Control (RBAC) for Finance & Accountant Roles](#6-role-based-access-control-rbac-for-finance--accountant-roles)
7. [Admin Dynamic Rule Configurator Engine](#7-admin-dynamic-rule-configurator-engine)
8. [Implementation Requirements & Functionality Matrix](#8-implementation-requirements--functionality-matrix)

---

## 1. Executive Architectural Vision

The Krozenda financial engine operates on a **Single Unified Double-Entry Accounting Engine (General Ledger)**. 

### Core Architectural Principles:
- **Single Accounting Core:** Seller mode and Dropshipping mode DO NOT require two separate accounting codebases.
- **Policy/Strategy Pattern:** A dynamic `Policy Engine` evaluates transactions based on `Vendor_Type` (`DIRECT_SELLER` vs `DROPSHIP_VENDOR`) and applies distinct invoicing, GST, commission, and payout rules.
- **Double-Entry Discipline:** Every transaction generates balanced Debit and Credit entries across sub-ledgers.
- **Automated Reconciliation:** Gateway payments, escrow holds, merchant payouts, and tax liabilities reconcile automatically in real-time.

---

## 2. Example 1: Marketplace Seller Billing & Accounting Specification

### Scenario Assumptions:
* **Product Listed Price:** ₹100.00 (Inclusive of 18% GST: Base = ₹84.75, GST = ₹15.25)
* **Shipping Charge:** ₹50.00 (Inclusive of 18% GST: Base = ₹42.37, GST = ₹7.63)
* **Krozenda Platform Commission:** 15.0% on Listed Price = ₹15.00 (+ 18% GST on Commission = ₹2.70 -> Total ₹17.70)
* **Statutory Withholdings:** TCS u/s 52 (GST) = 1.0% (₹0.85), TDS u/s 194O (IT) = 1.0% (₹0.85)

---

### Step-by-Step Functional & Accounting Rules:

#### 1. Buyer Facing Price Calculation
- `Display Price = Listed Product Price (₹100) + Applicable Shipping (₹50) = ₹150.00`
- The system must display line-item breakdowns at checkout.

#### 2. Dynamic GST & Tax Engine
- Dynamic tax calculation at Checkout based on `Seller GSTIN State` (Origin) vs `Buyer Shipping Address Pincode State` (Destination):
  - **Intra-State (Same State):** CGST (9%) + SGST (9%)
  - **Inter-State (Different State):** IGST (18%)

#### 3. Invoice Generation Entities
- **Customer Sales Tax Invoice:** Issued by **Seller Entity** (using Seller's GSTIN) to the **Buyer**. Krozenda acts purely as a marketplace facilitator.
- **Platform Commission Invoice:** Issued by **Krozenda Entity** (using Krozenda's GSTIN) to the **Seller** for ₹15.00 Commission + ₹2.70 GST.

#### 4. Seller Dashboard Invoice Visibility
- Sellers must be able to view and download two distinct PDF invoices per completed order:
  1. *Customer Sales Invoice* (Customer B2C Tax Invoice)
  2. *Krozenda Platform Fee Invoice* (For Seller's Input Tax Credit - ITC claim)

#### 5. Commission Engine Calculation
$$\text{Commission Base} = ₹100.00$$
$$\text{Commission Amount (15\%)} = ₹15.00$$
$$\text{GST on Commission (18\%)} = ₹2.70$$
$$\text{Total Commission Deduction} = ₹17.70$$

#### 6. Payment Capture (Razorpay Gateway)
- Full order amount (**₹150.00**) is captured via Razorpay Payment Gateway into Krozenda's Master Gateway Escrow Account.
- Webhook `payment.captured` transitions order state to `PAID`.

#### 7. Fund Staging & Separation
- Upon payment confirmation, the backend instantly splits the funds into 4 virtual staging buckets:
  1. `Platform Commission Pool`: ₹17.70
  2. `Logistics Carrier Pool`: ₹50.00
  3. `Statutory Hold (TCS/TDS)`: ₹1.70 (₹0.85 TCS + ₹0.85 TDS)
  4. `Seller Net Payable Staging`: ₹80.60

#### 8. Seller Net Payable Formula
$$\begin{aligned}
\text{Net Payable} &= \text{Total Buyer Payment} - \text{Logistics Charge} - \text{Commission (incl. GST)} - \text{TCS (1\%)} - \text{TDS (1\%)} \\
&= ₹150.00 - ₹50.00 - ₹17.70 - ₹0.85 - ₹0.85 \\
&= \mathbf{₹80.60}
\end{aligned}$$

#### 9. Double-Entry Seller Ledger Entries
- **Order Delivered (Credit Entry):**
  - `Credit: ACCOUNTS_PAYABLE_SELLER_{ID}` ➔ ₹150.00
- **System Deductions (Debit Entries):**
  - `Debit: LOGISTICS_PAYABLE` ➔ ₹50.00
  - `Debit: KROZENDA_COMMISSION_INCOME` ➔ ₹15.00
  - `Debit: OUTPUT_GST_COMMISSION_PAYABLE` ➔ ₹2.70
  - `Debit: TCS_PAYABLE_GST` ➔ ₹0.85
  - `Debit: TDS_PAYABLE_INCOMETAX` ➔ ₹0.85
- **Net Balance in Ledger:** ₹80.60 (Status: `LOCKED_IN_HOLD`)

#### 10. Krozenda Income & Tax Ledger Entries
- `Debit: RAZORPAY_CLEARING_ACCOUNT` ➔ ₹17.70
- `Credit: REVENUE_PLATFORM_COMMISSION` ➔ ₹15.00
- `Credit: OUTPUT_GST_COMMISSION_PAYABLE` ➔ ₹2.70

#### 11. Statutory Tax Ledger Entries
- `Credit: TCS_LIABILITY_SEC52` ➔ ₹0.85 (For GSTR-8 monthly filing)
- `Credit: TDS_LIABILITY_SEC194O` ➔ ₹0.85 (For Form 26Q quarterly filing)

#### 12. Shipping Charge Accounting
- **Platform Managed Shipping:** ₹50.00 credited to `LOGISTICS_PAYABLE_ACCOUNT` to settle carrier invoices (Shiprocket/Delhivery).
- **Seller Self Shipping:** ₹50.00 credited directly to `ACCOUNTS_PAYABLE_SELLER_{ID}`.

#### 13. Refund, Return & Chargeback Handling
- **Credit Note Generation:** System issues a Credit Note to the Buyer against the original Tax Invoice.
- **Commission Reversal:** Krozenda issues a Debit/Credit Note to the Seller reversing the ₹17.70 commission.
- **Ledger Reversal:**
  - `Debit: ACCOUNTS_PAYABLE_SELLER_{ID}` (Reversed)
  - `Credit: CUSTOMER_REFUND_PAYABLE` ➔ ₹150.00
  - `Credit: KROZENDA_COMMISSION_INCOME` (Reversed ₹15.00)

#### 14. 30-Day Hold Period Lifecycle
- Seller Dashboard displays the amount under `Pending Settlement (Escrow Hold)`.
- Status lifecycle: `ORDER_DELIVERED` ➔ `LOCKED_IN_HOLD` (Days 1–30) ➔ `ELIGIBLE_FOR_PAYOUT` (Day 31+).

#### 15. Final Payout Execution Ledger Entries
- Executed via RazorpayX Payout API:
  - `Debit: ACCOUNTS_PAYABLE_SELLER_{ID}` ➔ ₹80.60
  - `Credit: KROZENDA_BANK_ACCOUNT` ➔ ₹80.60
- **Post-Payout Ledger Balance:** **₹0.00**

---

## 3. Example 2: Dropshipping Vendor Billing & Accounting Specification

### Scenario Assumptions:
* **Vendor Base Price (Cost Price):** ₹100.00
* **Krozenda Retail Margin:** 25.0% (₹25.00)
* **Customer Facing Price:** ₹125.00 (Inclusive of GST)
* **Shipping Fee:** ₹50.00

---

### Key Operational Rules & Architecture:

```
[Buyer Pays ₹175] ➔ [Razorpay Gateway] ➔ [Krozenda (Merchant of Record)]
                                              ├── 1. B2C Invoice to Buyer (₹175)
                                              ├── 2. Retains Margin (₹25)
                                              └── 3. B2B Purchase Order to Vendor (₹100 + GST)
```

#### 1. Invoicing & Entity Model
- Krozenda acts as **Merchant of Record (MoR)**.
- **Customer B2C Invoice:** Issued by **Krozenda Entity** (with Krozenda GSTIN) to the Buyer for ₹125.00 + ₹50.00 = **₹175.00**.
- **Vendor B2B Invoice:** Dropshipping Vendor issues a B2B Tax Invoice (Base ₹100.00 + Applicable GST) to **Krozenda Entity**.

#### 2. Krozenda Margin Calculation
$$\text{Margin} = \text{Customer Selling Price (₹125.00)} - \text{Vendor Cost Price (₹100.00)} = \mathbf{₹25.00}$$
- Recorded as `RESELLER_RETAIL_MARGIN_INCOME`.

#### 3. Two-Tier GST & Input Tax Credit (ITC) Handling
- **Tier 1 (B2B - Vendor ➔ Krozenda):** Vendor charges GST (e.g., 18% = ₹18.00) on ₹100.00. Krozenda claims **Input Tax Credit (ITC)**.
- **Tier 2 (B2C - Krozenda ➔ Buyer):** Krozenda collects GST (18% = ₹22.50) on ₹125.00 from Buyer.
- **Net GST Payable to Govt:** `Output GST (₹22.50) - Input GST (₹18.00) = ₹4.50`.

#### 4. Vendor Ledger Entries
- **Order Dispatched:**
  - `Credit: ACCOUNTS_PAYABLE_DROPSHIP_VENDOR_{ID}` ➔ ₹100.00 (+ GST)
- **30-Day Payout:**
  - `Debit: ACCOUNTS_PAYABLE_DROPSHIP_VENDOR_{ID}` ➔ ₹100.00 (+ GST)
  - `Credit: KROZENDA_BANK_ACCOUNT` ➔ ₹100.00 (+ GST)

#### 5. Return to Vendor (RTV) Adjustment
- On customer return, Krozenda issues a **Return to Vendor (RTV) Debit Note** to the Vendor, reversing the ₹100.00 (+ GST) ledger credit.

---

## 4. RazorpayX Payout System & Automated Settlement Architecture

### Integration Workflow:

#### 1. Vendor Onboarding & Account Linkage
- On bank detail submission, backend invokes:
  - `POST /v1/contacts` ➔ Generates `cont_...` ID.
  - `POST /v1/fund_accounts` ➔ Links bank account/UPI (`fa_...`).
- Optional **Penny Drop Verification API** validates account holder name matching KYC.

#### 2. Automated Payout Cron Engine
- Runs on scheduled intervals (e.g., Daily at 00:00 UTC).
- Scans `sub_orders` where `status = DELIVERED` and `delivered_at <= NOW() - 30 DAYS`.
- Groups eligible unsettled amounts per vendor into a settlement batch.

#### 3. RazorpayX Payout API Execution
- System executes `POST /v1/payouts` with payload:
  ```json
  {
    "account_number": "233445566778899",
    "fund_account_id": "fa_00000000000001",
    "amount": 8060,
    "currency": "INR",
    "mode": "IMPS",
    "purpose": "vendor_bill",
    "reference_id": "STL_20260902_VND101",
    "narration": "Krozenda Settlement"
  }
  ```

#### 4. Webhook Handling & Auto-Reconciliation
- **`payout.processed` Webhook:**
  - Stores UTR (Unique Transaction Reference) number in `settlement_records`.
  - Sets Order Settlement Status to `SETTLED`.
  - Triggers automated Email/WhatsApp notification to Vendor.
- **`payout.failed` / `payout.reversed` Webhook:**
  - Automatically reverses the payout debit, crediting funds back to `ACCOUNTS_PAYABLE_SELLER_{ID}`.
  - Flags account on Vendor Dashboard: `BANK_DETAILS_UPDATE_REQUIRED`.

#### 5. Approval Mode Controls
- **Mode A (Fully Automated):** System executes payouts automatically upon expiry of hold period.
- **Mode B (Maker-Checker Approval):** System generates payout drafts; Admin approves batches via 2FA OTP in Admin Panel or RazorpayX portal.

---

## 5. In-House Admin Accounting Module (Tally/Zoho Style) Specification

The Admin Panel includes a full-featured Financial Accounting Suite:

### Key Sub-Modules:

#### 1. Financial Statements Dashboard
- **Profit & Loss (P&L) Statement:** Real-time net margin tracking.
  - *Income:* Platform Commissions + Dropshipping Retail Margins + Logistics Fees.
  - *Expenses:* Gateway Charges + Carrier Expenses + Server Costs + Marketing + Refunds.
- **Balance Sheet:** Real-time view of Assets (Gateway Escrow, Bank Balances) vs Liabilities (Vendor Payables, Statutory Tax Payables).
- **Trial Balance & Cash Flow Statements:** Filterable by date ranges.

#### 2. Manual Journal Vouchers (JV) & Expense Management
- Ability to post custom Journal Entries (`Debit` and `Credit` with line descriptions).
- Categorized Operational Expenses: Hosting/Server, Office Expenses, Staff Payroll, Marketing.

#### 3. Tax & Statutory Compliance Export Module
- **GSTR-8 Export (TCS 1% u/s 52):** 1-Click JSON/CSV export for direct GST Portal upload.
- **GSTR-1 & GSTR-3B Summary:** Detailed tax breakdown of B2C sales and B2B commission invoices.
- **Form 26Q Export (TDS 1% u/s 194O):** Quarterly TDS report for Income Tax compliance.

#### 4. Vendor Sub-Ledger Statement Generator
- Comprehensive ledger view per vendor with date filter, debit/credit audit trail, running balance, and downloadable PDF/Excel statement.

---

## 6. Role-Based Access Control (RBAC) for Finance & Accountant Roles

The system enforces strict Granular Permissions for Financial Roles:

### Role Matrix:

| Feature / Module | Super Admin | Accountant / Finance Manager | CA / Auditor (Read-Only) |
| :--- | :--- | :--- | :--- |
| **Financial Statements (P&L, BS)** | Full Access | Full Access | Read-Only View |
| **Ledgers & Journal Vouchers** | Full Access | Create / Edit / View | Read-Only View |
| **Tax Reports (GSTR-8, TDS)** | Full Access | Export & View | Export & View |
| **Payout Approval** | Approve / Execute | Prepare Drafts Only | No Access |
| **User / Vendor Management** | Full Access | **No Access** | **No Access** |
| **Product / Order Deletion** | Full Access | **No Access** | **No Access** |
| **System Settings Configuration** | Full Access | **No Access** | **No Access** |

---

## 7. Admin Dynamic Rule Configurator Engine

To avoid hardcoding financial logic, all parameters are stored in MongoDB configuration schema (`platform_configurations`) and editable via Admin UI:

```json
{
  "fee_rules": {
    "SELLER_MODEL": {
      "commission_type": "PERCENTAGE",
      "commission_rate": 15.0,
      "gst_on_commission_rate": 18.0,
      "tcs_sec52_rate": 1.0,
      "tds_sec194o_rate": 1.0,
      "settlement_hold_days": 30,
      "shipping_bearer": "BUYER"
    },
    "DROPSHIP_MODEL": {
      "default_margin_percentage": 25.0,
      "settlement_hold_days": 30,
      "merchant_of_record": "KROZENDA",
      "b2b_gst_credit_enabled": true
    }
  },
  "logistics_rules": {
    "default_flat_shipping_rate": 50.0,
    "free_shipping_threshold": 499.0
  },
  "payout_rules": {
    "auto_payout_enabled": true,
    "approval_mode": "MAKER_CHECKER",
    "minimum_payout_amount": 100.0
  }
}
```

---

## 8. Implementation Requirements & Functionality Matrix

| Module | Sub-System | Required Feature / API Endpoints | Status |
| :--- | :--- | :--- | :--- |
| **Checkout** | Tax Engine | Dynamic CGST/SGST/IGST breakdown at checkout | Required |
| **Order Processing** | Splitter Engine | Instant fund bucket separation (Commission, Shipping, Tax, Vendor) | Required |
| **Invoicing** | PDF Generator | Dual PDF Generation (Customer Tax Invoice & Commission Invoice) | Required |
| **Settlement** | Hold Manager | 30-Day Hold Staging State Machine (`LOCKED_IN_HOLD` ➔ `ELIGIBLE`) | Required |
| **Payouts** | RazorpayX | Integration with Contacts, Fund Accounts, and Payout API (`payout.processed` webhook) | Required |
| **Accounting** | General Ledger | Double-entry ledger engine with P&L, Balance Sheet, and Trial Balance | Required |
| **Accounting** | Expense & JV | Journal Voucher posting UI for manual expenses | Required |
| **Tax** | Statutory Reports | GSTR-8 (TCS 1%) & Form 26Q (TDS 194O) CSV/JSON export | Required |
| **RBAC** | Security | `ACCOUNTANT` and `CA_AUDITOR` roles with strict route/permission gates | Required |

---
*End of Technical Specification Document.*
