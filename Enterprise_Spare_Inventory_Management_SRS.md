# Enterprise Spare Inventory Management System (Version 1.0)
## Software Requirements Specification (SRS)

# Project Name

Enterprise Spare Inventory Management System (Delhi & Bengaluru)

---

# Project Objective

Develop a professional, secure, multi-user web-based Spare Inventory Management System for Proactive Data Systems to manage BHEL spare parts.

The application will primarily track spare inventory movement (IN/OUT) between Delhi Spare Store and various BHEL Sites.

This application is NOT an ERP.

It should be lightweight, simple, fast, easy to use, and optimized for approximately 4–5 users.

---

# Technology Stack

## Frontend

- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- React Query
- React Router
- Recharts

---

## Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL

---

## Authentication

- JWT Authentication
- Role Based Access
- Secure Password Hashing
- Session Management

---

# Deployment

Develop for Windows 11.

Initially run locally.

Future deployment should support:

- Local Network (LAN)
- Different Network (Internet)
- VPS
- Cloud Hosting

No code changes should be required during deployment.

---

# User Roles

## Admin

Full Access

- Dashboard
- Inventory
- Import Excel
- Dispatch
- Pickup
- Reports
- Users
- Activity Logs
- Comments
- Settings

---

## Inventory User

Allowed:

- View Dashboard
- Inventory
- Dispatch
- Pickup
- Reports
- Add Comments

Not Allowed:

- User Management
- Delete Records
- System Settings

---

## Read Only User

Can only

- View Dashboard
- Search Inventory
- Download Reports

Cannot edit anything.

---

# Multi User Support

Support minimum 5 concurrent users.

Every action should record

- User Name
- Date
- Time
- Action
- IP Address (optional)

---

# Dashboard

Create a modern enterprise dashboard.

Dashboard must include

## Inventory Summary

- Total Spare Parts
- Total Serialized Parts
- Total Non-Serialized Parts
- Total OEMs
- Delhi Total Stock
- Bengaluru Total Stock
- Low Stock Count
- Out of Stock Count

---

## Stock Summary

Separate cards

Delhi Spare Store

Bengaluru Spare Store

Each should display

- Total Items
- Total Quantity
- Available Quantity
- Reserved Quantity (Future)
- Low Stock

---

## Quick Actions

Buttons

- Import Excel
- Dispatch Spare
- Pickup Spare
- Reports
- Search Spare

---

## Dashboard Widgets

Recent Dispatch

Recent Pickup

Recent Activity

Low Stock Alert

Most Frequently Used Spare

OEM Distribution Chart

Monthly Dispatch Chart

Monthly Pickup Chart

---

# Inventory Module

Inventory data must NEVER be hardcoded.

Inventory should always come from imported Excel.

---

## Delhi Inventory

Import Delhi Spare Excel.

Application must read Excel properly.

Maintain all columns exactly as present in Excel.

Do NOT remove any OEM or fields.

---

## Bengaluru Inventory

Separate Inventory.

Initially empty.

Later administrator can import Bengaluru Excel.

Application should automatically create Bengaluru inventory after import.

---

# Excel Import

Support

.xlsx

.xls

During import

Validate

Duplicate Records

Missing Values

Invalid Data

Ignore Blank Rows

Show Summary

Example

Total Rows

Imported

Updated

Skipped

Failed

---

# Inventory Details

Each Spare must contain

OEM

Part Name

Part Number

Description

Category

Model

Serial Number (if available)

Quantity

Available Quantity

Location

Store

Condition

Remarks

Created Date

Updated Date

---

# Serialized Parts

If Serial Number exists

Treat as Serialized Inventory.

Every Serial Number should be unique.

Dispatch only selected serial number.

---

# Non-Serialized Parts

If no serial number

Treat as Quantity Based Inventory.

Dispatch by Quantity.

Quantity should automatically reduce.

---

# Search

Search by

OEM

Part Number

Part Name

Serial Number

Model

Description

Location

Store

---

# Filters

OEM

Store

Serialized

Non Serialized

Available

Out of Stock

Low Stock

---

# Spare Details Page

When user clicks any spare

Open Details Page.

Display

Complete Spare Information

Current Stock

Movement History

Comments

Dispatch History

Pickup History

---

# Comments Section (Very Important)

Every Spare must have its own Comments section.

This is mandatory.

Users should be able to

Add Comment

Edit Own Comment

View History

Each comment must contain

User Name

Date

Time

Comment

Comments should never be deleted automatically.

Maintain complete history.

---

# Dispatch Module

User selects Spare.

Then system opens Dispatch Form.

User selects

BHEL Site

Application should automatically populate

Site Name

Address

Contact Person

Phone Number

Email

City

State

PIN Code

No manual typing required.

---

Dispatch Form

Dispatch Date

Courier

Tracking Number

Engineer Name

Remarks

Attachment (Optional)

Dispatch Quantity

Serial Number (if Serialized)

Submit

Inventory should automatically reduce.

Movement history should update automatically.

---

# Pickup Module

Same functionality as Dispatch.

User selects Spare.

Select Site.

Site details auto populate.

Pickup Date

Courier

Tracking Number

Remarks

Submit

Inventory should automatically increase after pickup confirmation.

---

# Site Master

Administrator will upload

BHEL SPOC Excel

Application should import

Site Name

Address Line 1

Address Line 2

City

State

PIN

Contact Person

Phone

Email

Remarks

---

Whenever Dispatch or Pickup happens

System should automatically use Site Master.

---

# OEM Master

Automatically generate OEM list from imported inventory.

Example

Samsung

Dell

Crestron

Lumens

Jabra

Cisco

Kramer

TP-Link

Softindia

LG

Biamp

Others

No duplicate OEMs.

---

# Reports

Professional Reports

Download

Excel

PDF

CSV

Reports

Inventory Report

Dispatch Report

Pickup Report

Movement Report

Low Stock Report

OEM Report

User Activity Report

Comments Report

Site Wise Inventory Report

Store Wise Inventory Report

---

# Alerts

Dashboard Alerts

Low Stock

Out of Stock

Recent Dispatch

Recent Pickup

Pending Pickup (Future)

Popup notification on Dashboard.

---

# Activity Logs

Maintain complete audit trail.

Capture

User

Action

Date

Time

Module

Old Value

New Value

IP Address (Optional)

---

# User Management

Admin can

Create User

Edit User

Disable User

Reset Password

Assign Role

Maximum users

5-10 users

---

# Data Security

Never delete inventory permanently.

Use Soft Delete.

Maintain complete audit history.

---

# Database

Use PostgreSQL

Tables

Users

Inventory

InventoryMovement

Dispatch

Pickup

SiteMaster

OEMMaster

Comments

Reports

ActivityLogs

Settings

---

# Dashboard Design

Professional Enterprise UI

Theme

Clean

Modern

Responsive

Fast

Dark Mode

Light Mode

Collapsible Sidebar

Top Navigation

Breadcrumb

Notification Bell

Profile Menu

---

# Performance

Load Dashboard within 2 seconds.

Search within 1 second.

Support 20,000+ inventory records.

---

# Future Ready

Architecture should support

RMA Module

Reservation Module

Barcode

QR Code

Email Notification

WhatsApp Notification

Cloud Hosting

Mobile App

without changing existing database structure.

---

# Final Development Requirements

The application must be production-ready.

Do NOT generate placeholder pages.

Do NOT use dummy buttons.

Every module must be fully functional.

Fix all build errors.

Fix all TypeScript errors.

Fix all API errors.

Fix all Prisma errors.

Fix all authentication issues.

Verify frontend and backend start successfully.

Verify PostgreSQL connectivity.

Verify Excel import.

Verify reports.

Verify multi-user login.

Verify complete inventory workflow.

Deliver a stable, professional enterprise application that can be used immediately by Proactive Data Systems for managing Delhi and Bengaluru spare inventory.