# Business Requirements Document (BRD)

## 1. Executive Summary

### Project overview

The project is a prepaid virtual card portal focused on card request initiation, approval workflows, and customer card dashboards. It is implemented as a Next.js web application with a PostgreSQL backend and integrates with customer lookup APIs, account list services, and virtual card provisioning services.

### Purpose of the system

The system enables bank staff to create and review prepaid card requests using Maker/Checker controls, while enabling customers to view their virtual card balances, recent transactions, and request new cards when self-service is enabled.

### Business problem being solved

Financial institutions need a secure, audited workflow for issuing prepaid virtual cards tied to customer accounts. Existing manual or fragmented processes expose the business to operational risk, poor customer experience, and compliance gaps for card issuance and approval.

### Expected business value

- Reduce manual processing time for virtual card requests.
- Improve compliance with audit trails, role-based controls, and PCI-related card data protections.
- Increase customer satisfaction through faster request submission and status transparency.
- Enable secure, supervised card creation with separation of duties.

## 2. Business Context and Objectives

### Current business situation

The product is designed to support virtual card issuance for customers linked to bank accounts customerID(CID).

### Business challenges

- Ensuring secure card issuance while preventing unauthorized requests.
- Verifying customer account details through external banking APIs.
- Tracking card creation and approval decisions in an auditable manner.
- Providing controlled self-service card requests without compromising security.
- Managing multiple card programs and ensuring proper program eligibility.

### Strategic objectives

- Establish a digital workflow for prepaid card request creation and approval.
- Enforce role-based separation of duties for request initiation and review.
- Maintain strong security controls for authentication, session management, and sensitive card data.
- Provide operational visibility through audit logs and administrative reporting.
- Support configurable self-service request policies.

### Success criteria

- Makers can create prepaid card requests after verifying customer data.
- Checkers can approve or reject requests and trigger virtual card provisioning.
- Super Admins can manage card program visibility, self-service settings, and audit logs.
- Customers can request cards when self-service is enabled and no pending requests exist.
- All operational actions generate audit logs.

### KPIs

- Number of card requests created per day.
- Average request approval turnaround time.
- Percentage of requests approved versus rejected.
- Number of self-service requests processed.
- Number of security incidents or failed authentication events.
- Application uptime and API success rate.

## 3. Project Scope

### 3.1 In Scope

- Web application for card request submission, approval, and customer dashboard views.
- Role-based Maker/Checker/Super Admin dashboards for request workflows.
- Customer-facing dashboards for virtual card balances and transaction history.
- Customer account lookup via external prepaid API.
- Card program eligibility filtering for Maker and self-service audiences.
- Self-service card request submission for customers when enabled.
- Virtual card creation through PSS / card provisioning integration on approval.
- Secure JWT authentication with token revocation and session sliding.
- Password complexity enforcement and account lockout.
- Audit logging of login, request creation, approval, rejection, and settings changes.
- Administrative settings for self-service enablement and default checker assignment.
- Support for encrypted card PAN storage and non-storage of CVV.
- Legacy phone-based auth support alongside new JWT system.
- Export of card request data from admin interface.
- Responsive UI using Tailwind CSS and component library.

### 3.2 Out of Scope

- Physical card production and delivery.
- Card funding, transaction authorization, or settlement workflows beyond issuance.
- Advanced customer onboarding or KYC beyond account lookup.
- Mobile native app development.
- Full portfolio or payment card management beyond request and dashboard views.
- Multi-currency or multi-issuer card program management.
- Multi-tenant support beyond a single institution implementation.
- Real-time card lifecycle monitoring beyond request status.

## 4. Stakeholders and Users

### Stakeholders

- Business owners: Bank prepaid card program managers.
- Operations administrators: staff responsible for card product configuration and audit oversight.
- Compliance and risk managers: maintain PCI, data protection and approval policies.
- IT and platform managers: manage deployment, infrastructure, and external system integrations.
- External systems: prepaid customer data API, PSS virtual card provisioning service, token validation endpoint, email system.
- Third-party providers: card provisioning platform providers and prepaid customer data services.

### User Roles

#### Super Admin

- Responsibilities: configure system settings, enable self-service requests, assign default checker, view audit logs, manage users.
- Permissions: full access to admin dashboard, audit logs, settings, user lists, card request reports.
- Main workflows: configure card program availability, set default checker, review audit history.

#### Maker

- Responsibilities: initiate new prepaid card requests for customers, search customer accounts, select card programs, assign a checker.
- Permissions: access Maker dashboard, create card requests, view own requests, search customers, select eligible card programs.
- Main workflows: verify customer account, submit card request, monitor request status.

#### Checker

- Responsibilities: review and approve or reject card requests assigned by Makers or self-service flows.
- Permissions: access Checker dashboard, view assigned requests, approve or reject requests.
- Main workflows: evaluate request details, approve or reject with review notes, trigger PSS card creation on approval.

#### Customer / Self-Service User

- Responsibilities: initiate card requests through the Nibtera SuperApp if enabled.
- Permissions: view customer dashboard, request card products, receive request status and notifications.
- Main workflows: select eligible account, choose card program, submit request, wait for review.

#### External Systems

- Prepaid API provider: validates customer account details and returns account metadata.
- PSS virtual card service: provisions virtual card PAN and expiry details on approval.
- Token validation endpoint: supports legacy auth by validating external bearer tokens and returning phone identifiers.

## 5. Business Requirements

### 5.1 Functional Requirements

- BR-FR-001: The system shall allow Makers to log in using secure credentials and access a Maker dashboard.
  - Priority: High
  - Actors: Maker
  - Preconditions: User exists with MAKER role and valid credentials.
  - Postconditions: Maker is authenticated and can access request creation UI.

- BR-FR-002: The system shall allow Checkers to log in and access a Checker dashboard.
  - Priority: High
  - Actors: Checker
  - Preconditions: User exists with CHECKER role.
  - Postconditions: Checker is authenticated and can review assigned requests.

- BR-FR-003: The system shall allow Super Admins to log in and access administrative dashboards.
  - Priority: High
  - Actors: Super Admin
  - Preconditions: User exists with SUPER_ADMIN role.
  - Postconditions: Super Admin can view settings, audit logs, and admin reports.

- BR-FR-004: The system shall support JWT authentication with secure, HttpOnly cookies.
  - Priority: High
  - Actors: All authenticated users
  - Preconditions: JWT secret configured.
  - Postconditions: Authenticated sessions are maintained and renewed on activity.

- BR-FR-005: The system shall enforce password complexity and lock accounts after repeated failed login attempts.
  - Priority: High
  - Actors: All users
  - Preconditions: User authentication configured.
  - Postconditions: Weak passwords are rejected; after 5 failed attempts account is locked for 30 minutes.

- BR-FR-006: The system shall allow Makers to search customer accounts using a 13-digit bank account number.
  - Priority: High
  - Actors: Maker
  - Preconditions: Maker is authenticated.
  - Postconditions: Customer account data is retrieved from external API and displayed.

- BR-FR-007: The system shall allow Makers to create virtual card requests with verified customer data, selected card program, and assigned Checker.
  - Priority: High
  - Actors: Maker
  - Preconditions: Maker is authenticated; customer account verified; eligible card program available.
  - Postconditions: Card request is persisted and assigned to a Checker.

- BR-FR-008: The system shall prevent duplicate pending requests for the same CID and card program.
  - Priority: High
  - Actors: Maker, Customer
  - Preconditions: New card request submission.
  - Postconditions: Duplicate submissions are blocked with an error message.

- BR-FR-009: The system shall allow Checkers to approve or reject assigned card requests.
  - Priority: High
  - Actors: Checker
  - Preconditions: Checker is authenticated; request status is PENDING; request assigned to current checker.
  - Postconditions: Request status changes to APPROVED or REJECTED; review notes are recorded.

- BR-FR-010: The system shall provision virtual cards through the external PSS system when requests are approved.
  - Priority: High
  - Actors: Checker, System
  - Preconditions: Request approved; external PSS integration configured.
  - Postconditions: Card PAN and expiry date are stored encrypted; CVV is handled in memory only.

- BR-FR-011: The system shall allow customers to submit self-service card requests if self-service is enabled.
  - Priority: Medium
  - Actors: Customer
  - Preconditions: Self-service setting enabled; eligible card programs available; no pending request.
  - Postconditions: Self-service request is created and assigned to default Checker.

- BR-FR-012: The system shall allow Super Admins to configure self-service enablement and the default Checker for self-service requests.
  - Priority: Medium
  - Actors: Super Admin
  - Preconditions: Super Admin is authenticated.
  - Postconditions: Settings are persisted and apply to future self-service requests.

- BR-FR-013: The system shall provide a Super Admin report of card requests with filtering by status, account number, customer details, checker, PAN, and date range.
  - Priority: Medium
  - Actors: Super Admin
  - Preconditions: Super Admin is authenticated.
  - Postconditions: Filtered request list is displayed.

- BR-FR-014: The system shall maintain audit logs for user actions, authentication events, request creation, approval, rejection, and admin changes.
  - Priority: High
  - Actors: System, All users
  - Preconditions: Audit logging configured.
  - Postconditions: Audit log records are persisted in the audit_logs table.

- BR-FR-015: The system shall support customer phone-based legacy authentication via token validation endpoint and encrypted phone cookie.
  - Priority: Low
  - Actors: Customer, System
  - Preconditions: Legacy auth endpoint configured.
  - Postconditions: Phone-based auth is accepted for non-dashboard routes.

- BR-FR-016: The system shall allow customers to view virtual card balances and recent transactions through a dashboard.
  - Priority: Medium
  - Actors: Customer
  - Preconditions: Customer has linked card accounts and is authenticated.
  - Postconditions: Card balance and transaction history are displayed in the dashboard.

### 5.2 Non-Functional Requirements

- Security
  - Use secure JWT tokens with revocation support.
  - Enforce HTTP-only, secure, SameSite cookie settings.
  - Implement account lockout after repeated failed login attempts.
  - Enforce password strength rules and discourage weak patterns.
  - Use TLS and corporate CA validation for external PSS connectivity.
  - Encrypt PAN and expiry dates at rest; do not store CVV.
  - Apply strong CSP, referrer, permissions, and transport headers.

- Scalability
  - Design API routes for stateless request handling.
  - Support scaling of the Next.js application and PostgreSQL backend.
  - External integrations should be loosely coupled through configurable environment variables.

- Availability
  - Ensure high availability of the web portal and external API dependencies.
  - Support graceful error handling when external services are unavailable.

- Reliability
  - Validate all inbound data using schema validation.
  - Maintain request state consistency between card requests and audit logs.

- Performance
  - Keep dashboard data loads efficient with indexed queries on card requests and users.
  - Minimize end-user latency for customer searches and request submissions.

- Audit logging
  - Log all security-sensitive actions including login, logout, request operations, and admin configuration changes.
  - Provide Super Admin access to audit history and exportable request data.

- Maintainability
  - Use modular API routes and reusable backend libraries.
  - Keep business logic separated from UI implementation.

- Compliance
  - Follow PCI-related controls for card data encryption and CVV handling.
  - Preserve audit trails for financial operations.

- Accessibility
  - Use responsive, accessible UI components.
  - Maintain clear form labels, alerts, and feedback flows.

- Localization
  - No explicit multilingual support is implemented; UI currently uses English.

- Backup and recovery
  - Database backup and recovery mechanisms should be in place for PostgreSQL.
  - Critical configuration data and audit logs must be protected.

## 6. Assumptions, Dependencies, and Constraints

### Assumptions

- The business requires Maker/Checker separation for card issuance.
- Customer account data and card provisioning are available through external APIs.
- The portal is primarily intended for bank employees and optionally for authenticated customers.
- Super Admin users will manage settings and audit oversight.
- Existing infrastructure supports HTTPS, PostgreSQL, and external API connectivity.
- There is a defined default checker for self-service request approval.

### Dependencies

- PostgreSQL database managed through Prisma.
- External API for customer account lookup.
- External PSS virtual card provisioning API.
- External token validation endpoint for legacy auth.
- SMTP or email provider for password resets and notifications (implicit via `nodemailer`).
- Corporate CA certificate for PSS TLS agent (`certs/pss.crt`).
- Environment variables for secrets, API URLs, and integration credentials.

### Constraints

- Only web browser access is supported; no mobile native app.
- Card request approval depends on external PSS availability.
- Customer self-service is conditional on admin settings.
- Sensitive data handling must comply with PCI requirements.
- The system is constrained by the availability of card programs enabled for specific audiences.
- Lack of explicit multi-language support.

## 7. High-Level Business Process

### Current State Process

Based on system implementation, the existing manual customer onboarding process is likely:

- Customer or Maker identifies a need for a virtual card.
- Maker obtains customer account details.
- Maker submits a request to a Checker for approval.
- Checker manually reviews request details and contacts card backend for issuance.
- Audit data is recorded in spreadsheets or separate logs.

Current pain points:

- Manual request assignment and tracking.
- Lack of centralized approval and audit tracking.
- Potential delays due to manual verification.
- Inconsistent card program eligibility enforcement.

### Future State Process

The proposed automated workflow is:

1. Maker logs in and searches customer account by account number.
2. System verifies customer details via external API.
3. Maker selects an eligible card program and assigns a Checker.
4. Maker submits the request; system persists it and logs the action.
5. Checker reviews the pending request and approves or rejects it.
6. On approval, system calls PSS to create a virtual card and stores encrypted PAN/expiry.
7. Customer or Maker can view request status through NIBtera SuperApp.
8. Super Admin reviews audit logs and configures self-service behavior.

## 8. System Overview

### High-level architecture summary

- Frontend: Next.js application with React components and Tailwind UI.
- Backend: API routes implemented in Next.js server runtime.
- Database: PostgreSQL accessed through Prisma ORM.
- External integrations: Account lookup API, PSS virtual card provisioning, token validation endpoint, email service.
- Authentication: JWT-based dashboard sessions and legacy phone-token auth for other routes.

### Core modules

- Authentication: `/api/auth/login`, `/api/auth/logout`, JWT generation, token revocation, cookie management.
- Request workflows: `/api/card-requests`, `/api/card-requests-self`, `/api/customer/search`.
- Administration: `/api/admin/settings`, `/api/admin/requests`, `/api/users/checkers`, `/api/audit-logs`.
- Card programs: `/api/card-programs` and business logic to filter by maker/self audiences.
- Audit logging: centralized recording of user and system actions.
- Card provisioning: PSS integration via secure fetch and encrypted data storage.

### External integrations

- Account Lookup API: Customer lookup by account number.
- PSS virtual card service: Virtual card issuance upon request approval.
- Token validation endpoint: Legacy bearer token authentication for customers.
- Corporate CA certificate for secure PSS TLS.
- Email service: implied for password reset flows.

### Authentication flow

- Users enter credentials on login.
- Successful login generates a JWT stored in `auth-token` cookie.
- Middleware verifies JWT and refreshes cookie expiry on each request.
- Logout revokes JWT and removes auth cookies.
- Legacy routes may validate an external bearer token and set encrypted phone cookie for customer identity.

### Data flow overview

- Customer account search triggers external account lookup API.
- Card requests are stored in `card_requests` with maker/checker associations.
- Approval invokes PSS and stores encrypted PAN and expiry details.
- Settings and user assignments are persisted in `settings` and `users` tables.
- Audit actions are stored in `audit_logs`.

## 9. Risks and Mitigation

| Risk                                   | Impact | Probability | Mitigation strategy                                                |
| -------------------------------------- | ------ | ----------- | ------------------------------------------------------------------ |
| External prepaid API unavailability    | High   | Medium      | Implement retry, error handling, and user-friendly messages.       |
| PSS card provisioning failure          | High   | Medium      | Validate response codes, log failures, and escalate to support.    |
| Weak password or credential compromise | High   | Medium      | Enforce password complexity, lockout, and audit failed logins.     |
| Unauthorized access to admin functions | High   | Low         | Enforce RBAC, verify roles server-side, and protect admin routes.  |
| Card data leak                         | High   | Low         | Encrypt PAN, never store CVV, use secure cookies and TLS.          |
| Missing default checker configuration  | Medium | Medium      | Validate settings and block self-service if no checker configured. |
| Inconsistent card program eligibility  | Medium | Medium      | Apply server-side audience filtering for card programs.            |
| Legacy auth token misuse               | Medium | Medium      | Validate token endpoint and encrypt phone cookie.                  |

## 10. Benefits and Expected Outcomes

### Operational benefits

- Streamlined card request processing.
- Clear, auditable workflows and approvals.
- Reduced manual handoffs and operational risk.

### Financial benefits

- Faster issuance leads to increased prepaid card adoption.
- Reduced cost of manual processing and error remediation.

### User benefits

- Makers and Checkers get dedicated dashboards and workflows.
- Customers receive guided self-service card request capability.
- Improved transparency for pending requests.

### Technical benefits

- Modular architecture with configurable external integrations.
- Secure session management and data encryption.
- Audit logging for governance and compliance.

## 11. High-Level Timeline

| Phase       | Duration  | Activities                                                               |
| ----------- | --------- | ------------------------------------------------------------------------ |
| Discovery   | 1-2 weeks | Requirements gathering, stakeholder interviews, system inventory.        |
| Design      | 2-3 weeks | UI/UX design, process flows, data model review, security plan.           |
| Development | 6-8 weeks | Build dashboards, API workflows, integrations, auth, and audit features. |
| Testing     | 2-3 weeks | Functional QA, security testing, integration tests, user acceptance.     |
| Deployment  | 1 week    | Infrastructure provisioning, environment setup, release to production.   |
| Training    | 1-2 weeks | Training sessions for makers, checkers, admins, and support staff.       |
| Maintenance | Ongoing   | Monitoring, support, bug fixes, enhancements.                            |

## 12. Acceptance Criteria

- AC-001: Maker can log in, search a customer account, and submit a card request with valid customer data.
- AC-002: Checker can view assigned pending requests and approve or reject them.
- AC-003: Approved requests trigger a PSS provisioning call and store encrypted PAN/expiry values.
- AC-004: Duplicate pending requests for the same account number are rejected.
- AC-005: Self-service card requests are only accepted when enabled and assigned to configured Checker.
- AC-006: Super Admin can update self-service settings and view audit logs.
- AC-007: All sensitive operations are logged in the audit trail.
- AC-008: Invalid logins are tracked and account lockout is enforced after repeated failures.

## 13. Approval and Sign-Off

| Stakeholder name     | Role                      | Signature | Date |
| -------------------- | ------------------------- | --------- | ---- |
| [Business Owner]     | Prepaid Card Program Lead |           |      |
| [Operations Manager] | Card Operations           |           |      |
| [Compliance Officer] | Risk & Compliance         |           |      |
| [IT Sponsor]         | Delivery Sponsor          |           |      |

---

## Appendix: Missing Information and Assumptions

- Exact stakeholder names and business unit ownership are not available in the codebase.
- Production infrastructure details are inferred from `next.config.ts`, `apphosting.yaml`, and typical Next.js deployment patterns.
- Regulatory and localization requirements are not explicitly defined and should be validated with stakeholders.
