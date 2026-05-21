# PROJECT CHARTER: Prepaid Virtual Card Portal (VPCard)

## 1. Project Identification
- **Project Name:** Prepaid Virtual Card Portal
- **Project Code Name:** VPCard
- **Project Manager:** [To be assigned]
- **Project Owner:** Bank Prepaid Card Program Lead
- **Project Sponsor:** Financial Services Executive Board
- **Start Date:** May 21, 2026
- **Estimated Completion Date:** September 15, 2026

---

## 2. Project Purpose & Overview
The **Prepaid Virtual Card Portal (VPCard)** project is initiated to establish a secure, automated, and fully audited digital workflow for the issuance and management of prepaid virtual cards. Currently, financial institutions face operational risks and compliance gaps due to manual or fragmented card issuance processes.

VPCard addresses these challenges by providing a centralized web application that integrates with customer lookup services and virtual card provisioning platforms (PSS). The system enforces strict role-based access control (RBAC) and a mandatory Maker-Checker workflow, ensuring that every card request is verified and approved before issuance. This digital transformation reduces processing time, enhances security for sensitive card data (PCI compliance), and provides a superior self-service experience for end customers.

---

## 3. Project Objectives & Success Criteria
### 3.1 Objectives
- **Operational Efficiency:** Reduce manual processing time for virtual card requests by automating customer verification and provisioning triggers.
- **Enhanced Security:** Implement secure JWT-based authentication and encrypt all sensitive card data (PAN, Expiry) at rest, adhering to PCI DSS standards.
- **Risk Mitigation:** Enforce a strict separation of duties through a Maker-Checker workflow, preventing unauthorized card issuance.
- **Customer Empowerment:** Provide a secure dashboard for customers to view card balances, transaction history, and submit self-service requests.
- **Auditability:** Maintain a complete, unalterable audit trail for all user actions, authentication events, and financial operations.

### 3.2 Success Criteria
- **Functional Verification:** Successful execution of the full card request lifecycle (Search -> Request -> Approval -> Provisioning).
- **Compliance:** 100% encryption of sensitive fields and zero storage of CVV codes.
- **Performance:** Customer search and request submission latency kept under 2 seconds for external API responses.
- **User Adoption:** UAT sign-off from operational staff (Makers/Checkers) and Super Admins.
- **System Integrity:** 100% accuracy in audit log generation for every status change and administrative update.

---

## 4. Project Scope
### 4.1 In-Scope (Functional)
- **Role-Based Dashboards:** Dedicated interfaces for Super Admin, Maker, and Checker roles.
- **Customer Integration:** Search and lookup of customer account details via external Prepaid APIs.
- **Maker-Checker Workflow:** Secure request initiation by Makers and mandatory review/approval by Checkers.
- **Automated Provisioning:** Integration with PSS (Prepaid Service System) for real-time virtual card generation.
- **Customer Dashboard:** Self-service views for virtual card balances and transaction history.
- **Administrative Suite:** Configuration of self-service policies, card program eligibility, and system settings.
- **Security Features:** JWT session management, account lockout, password complexity enforcement, and AES-256-GCM encryption.
- **Audit Logging:** Comprehensive tracking of all security-sensitive and business-critical actions.

### 4.2 Out-of-Scope
- Physical card production, embossing, or mailing.
- Card funding, settlement, or clearing house workflows.
- Advanced KYC or AML onboarding (assumed handled by the bank's core systems).
- Native mobile application development (the portal is responsive web-based).
- Multi-currency or multi-tenant support.

---

## 5. Project Deliverables
- **D1: Technical Design Documentation (HLD/LLD)** - Complete architectural and component-level blueprints.
- **D2: Web Application Portal** - Next.js based platform with Maker, Checker, and Admin modules.
- **D3: Integration Layer** - Fully tested API clients for PSS and Prepaid Customer Lookup services.
- **D4: Security & Audit Engine** - Implementation of JWT auth, encryption services, and immutable audit logging.
- **D5: Reporting Module** - Admin reports for card requests with advanced filtering and export capabilities.
- **D6: User Documentation** - Detailed manuals for operational staff and system administrators.

---

## 6. Project Milestones & Timeline
| Milestone | Description | Target Duration |
|-----------|-------------|-----------------|
| **M1: Discovery & Planning** | Requirements finalization and stakeholder kickoff. | 1-2 Weeks |
| **M2: Design Phase** | UI/UX design, process flows, and technical architecture approval. | 2-3 Weeks |
| **M3: Development Phase** | Implementation of dashboards, workflows, and API integrations. | 6-8 Weeks |
| **M4: Integration & QA** | End-to-end testing with external PSS and Prepaid API sandboxes. | 2-3 Weeks |
| **M5: UAT & Training** | Stakeholder verification and staff training sessions. | 1-2 Weeks |
| **M6: Production Launch** | Final deployment and operational handover. | 1 Week |

---

## 7. Risks, Assumptions & Constraints
### 7.1 Risks
- **API Availability:** Downtime of external PSS or Prepaid APIs could halt card issuance. *Mitigation: Implement graceful error handling, retries, and user-friendly status notifications.*
- **Data Security:** Exposure of sensitive cardholder data. *Mitigation: Strict PCI compliance, AES-256-GCM encryption, and regular security audits.*
- **System Misuse:** Unauthorized access to admin or checker functions. *Mitigation: Robust RBAC, JWT revocation, and mandatory audit logging.*

### 7.2 Assumptions
- The bank's core system will provide stable customer data through the agreed Prepaid API.
- PSS service will be available for integration testing during the development phase.
- Stakeholders will assign a default checker for self-service requests as part of initial configuration.

### 7.3 Constraints
- Fixed technology stack (Next.js, Prisma, PostgreSQL).
- Web-only access (no native mobile app).
- Strict adherence to PCI DSS data handling regulations.

---

## 8. Project Roles & Responsibilities
- **Project Sponsor:** Executive oversight and budget authorization.
- **Project Manager:** Project planning, resource coordination, and timeline management.
- **Super Admin:** System configuration, user management, and audit oversight.
- **Maker:** Verification of customer accounts and initiation of card requests.
- **Checker:** Review and final approval/rejection of card requests.
- **Lead Developer:** System architecture, API integration, and code quality control.
- **Security Lead:** Encryption implementation and PCI compliance verification.

---

## 9. Communication Management Plan
| Meeting / Method | Owner | Audience | Frequency | Action Items |
|------------------|-------|----------|-----------|--------------|
| **Project Kickoff** | Project Manager | All Stakeholders | Once | Align on project scope, goals, and timeline. |
| **Sprint Review** | Lead Developer | Project Owner | Biweekly | Demo of completed features and feedback. |
| **Status Reports** | Project Manager | Sponsor / Owner | Weekly | Progress tracking, risk updates, and milestone review. |
| **UAT Sessions** | QA Lead | Makers / Checkers | Milestone | Hands-on validation of workflows and bug reporting. |

---

## 10. Stakeholder Analysis
- **Prepaid Card Program Managers:** Primary business owners focused on operational efficiency.
- **Operations Staff (Makers/Checkers):** End-users responsible for daily card issuance.
- **Compliance & Risk Team:** Stakeholders ensuring PCI and regulatory alignment.
- **IT Infrastructure Team:** Partners for deployment and network security.
- **End Customers:** Beneficiaries of the self-service dashboard and faster issuance.

---

## 11. Approvals
The signatures below indicate approval of this Project Charter and authorize the commencement of the Prepaid Virtual Card Portal project.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Business Owner** | [Name] | __________________ | __________ |
| **Project Sponsor** | [Name] | __________________ | __________ |
| **Project Manager** | [Name] | __________________ | __________ |
| **Security Lead** | [Name] | __________________ | __________ |
