# AJ SPORTS Backend

A production-ready Node.js + Express.js + MongoDB backend for a sneaker e-commerce platform.

## Overview

This project implements a modular backend architecture for the AJ SPORTS brand covering authentication, products, cart, checkout, payments, orders, shipping, audits, analytics, and admin APIs.

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT auth with secure cookies
- Express security middleware
- Cloudinary for media uploads
- Razorpay for payments
- Nodemailer for transactional emails
- Joi validation
- Structured logging

## Folder Structure

```text
kicks-backend/
├── src/
│   ├── config/
│   ├── modules/
│   ├── middleware/
│   ├── services/
│   ├── utils/
│   ├── routes/
│   ├── app.js
│   └── server.js
├── tests/
├── uploads/
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Requirements

- Node.js 18+
- MongoDB 6+
- No Redis required for this project
- Cloudinary account
- Razorpay account
- SMTP email provider
- Shiprocket credentials (for live shipment creation)

## Installation

```bash
npm install
cp .env.example .env
```

## Environment Setup

Update `.env` with your credentials.

Shipping package defaults are configured with `SHIPPING_WEIGHT_KG`, `SHIPPING_LENGTH_CM`, `SHIPPING_BREADTH_CM`, and `SHIPPING_HEIGHT_CM`. Provider credentials are optional for boot, but provider endpoints return configuration errors when unavailable.

## Scripts

```bash
npm run dev
npm start
npm test
npm run test:watch
npm run lint
```

## Development

```bash
npm run dev
```

## Health Check

```http
GET /api/v1/health
```

The endpoint reports `database: connected` with HTTP 200 only when MongoDB is ready. Without a database it returns HTTP 503 and `database: unavailable`.

## Admin Creation

Create an admin manually in MongoDB or through a seed script using the user model.

## Security Summary

- Helmet
- CORS allowlist
- rate limiting
- request sanitization
- HPP protection
- JWT rotation
- secure cookies in production
- password hashing
- admin-only APIs protected via RBAC
- hashed refresh-token sessions with rotation and logout-all
- request IDs and Origin checks for cookie-authenticated writes
- server-owned checkout address, price, payment, and inventory state

## Testing

```bash
npm test
```

The test suite includes health behavior, authentication protection, admin authorization, payment endpoint protection, invoice/tracking ownership boundaries, and review route protection. Full database/provider integration tests require configured services.

## API Overview

Public browsing: products, featured products, brands, categories, published blog posts, active CMS content, and approved reviews.

Authenticated customer APIs: auth/session management, addresses, cart, wishlist, checkout, payment verification, orders, cancellation, tracking, invoices, reviews, recently viewed products, notifications, and recommendations.

Admin APIs: dashboard metrics, product/catalog management, shipment creation, invoice access/resend, CMS/blog management, uploads, and audit-backed sensitive actions. The launch Admin Panel exposes only Dashboard, Products, Inventory, Orders, Customers, Shipping, and Settings.

Payment flow: the backend creates a Razorpay order, verifies the returned signature and gateway payment details, independently verifies webhooks, then marks payment/order state and decrements stock idempotently. Frontend totals and payment status are not trusted.

Invoices are commercial invoices, not fabricated GST tax invoices. Returns and exchanges are intentionally not implemented; refunds are not exposed in the launch Admin Panel.

## Production Deployment Checklist

- Use environment variables only
- Enable TLS and secure cookies
- Use MongoDB Atlas or managed DB
- Configure Cloudinary and payment webhooks
- Use reverse proxy / load balancer
- Add monitoring and alerting
- Keep secrets outside source control

## Sample API Requests

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "StrongPass123!"
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "StrongPass123!"
}
```

### Health

```http
GET /api/v1/health
```

## Notes

Redis is not required. External integrations for MongoDB, Cloudinary, Razorpay, Shiprocket, and SMTP require real credentials for live execution. The application does not report simulated provider success. Local startup requires a reachable MongoDB instance.
