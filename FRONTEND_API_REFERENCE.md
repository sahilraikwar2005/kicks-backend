# KICKS Backend API Reference

This document reflects the current repository state as inspected in the active route files, controllers, services, validators, models, and middleware. It intentionally documents only endpoints and payloads that exist in the current source.

## API base

- API version: `/api/v1`
- Development base URL example: `http://localhost:5000`
- Production base URL placeholder: `https://your-backend-domain`
- Frontend should use browser cookies for authentication with `credentials: "include"`.
- The backend accepts cookies and, for some legacy or non-browser scenarios, a bearer token in the `Authorization` header.
- The backend sets HTTP-only cookies for auth state; frontend should not read or store them in JavaScript.

## Authentication model

Authentication is cookie-based for browser requests. The backend writes `accessToken` and `refreshToken` cookies with:

- `httpOnly: true`
- `path: "/"`
- `sameSite` from `COOKIE_SAME_SITE` or default `lax`
- `secure` when running in production or when `COOKIE_SECURE=true`

The backend checks cookies first, then falls back to `Authorization: Bearer <token>` only if present.

## Common response shape

Successful responses follow this general structure:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {},
  "statusCode": 200
}
```

Actual success payloads vary by endpoint. The backend uses `apiSuccess()` to shape success responses.

Error responses follow this general structure:

```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": [],
  "requestId": "uuid-or-header-value"
}
```

Important details:

- In non-production environments, `errors` may contain stack traces.
- In production, the error middleware usually returns an empty `errors` array unless the error is a validation/Mongo/JWT error.
- Every request gets an `X-Request-Id` response header, and the backend also includes `requestId` in the error payload when available.

## HTTP status codes used by the backend

The backend commonly uses:

- `200` for successful reads and updates
- `201` for created resources
- `400` validation or bad request errors
- `401` authentication failures / expired or invalid token
- `403` forbidden / role mismatch
- `404` resource not found
- `409` duplicate values or invalid state transitions
- `429` rate limit exceeded (auth and API rate limits)
- `500` unhandled server error

## Request/response conventions

- Query validation runs through Joi and strips unknown keys.
- Body validation strips unknown keys.
- `validateQuery()` is used for query-string validation and returns `400` for invalid queries.
- `ObjectId` values are Mongo `24-character hex` IDs.
- Date values are standard ISO timestamps from Mongoose.
- File upload limits are enforced by Multer in the uploads module: `5MB`, MIME types limited to `image/jpeg`, `image/png`, `image/webp`.
- Pagination is supported by some list endpoints and returns `page`, `limit`, `total`, and `totalPages` when the service returns paginated results.

## Health

### GET /api/v1/health

**Purpose**
Returns app/database availability.

**Authentication**
- Public

**Frontend usage**
- Health-check endpoint for uptime checks and deployment validation.

**Response**
```json
{
  "success": true,
  "message": "KICKS API is running",
  "database": "connected"
}
```

**Notes**
- Status is `200` when MongoDB is connected and `503` when not.

### GET /api/v1/

**Purpose**
Root API route.

**Authentication**
- Public

**Response**
```json
{
  "success": true,
  "message": "KICKS API v1 root",
  "data": { "version": "v1" }
}
```

---

# Authentication

## POST /api/v1/auth/register

**Purpose**
Registers a new customer account.

**Authentication**
- Public

**Frontend usage**
- Account creation screen.

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| firstName | string | Yes | min 2 chars |
| lastName | string | Yes | min 2 chars |
| email | string | Yes | valid email |
| password | string | Yes | min 8 chars |

**Example Request**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "securePassword123"
}
```

**Success Response**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "ObjectId",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "role": "CUSTOMER",
      "emailVerified": false,
      "avatar": "",
      "isActive": true,
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  },
  "statusCode": 201
}
```

**Important**
- The backend also sets auth cookies on successful registration.
- The response does not expose access or refresh tokens to JavaScript; they are stored in HTTP-only cookies.

**Possible errors**
- `400` validation failed
- `409` user already exists

## POST /api/v1/auth/login

**Purpose**
Logs the user in and sets auth cookies.

**Authentication**
- Public

**Frontend usage**
- Login form.

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| email | string | Yes | valid email |
| password | string | Yes | password |

**Success Response**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "ObjectId",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "role": "CUSTOMER",
      "emailVerified": false,
      "avatar": "",
      "isActive": true,
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  },
  "statusCode": 200
}
```

**Possible errors**
- `400` validation failed
- `401` invalid email or password
- `429` rate limit exceeded

## POST /api/v1/auth/logout

**Purpose**
Logs the current user out and clears auth cookies.

**Authentication**
- Authenticated customer

**Frontend usage**
- Logout button.

**Success Response**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

## POST /api/v1/auth/logout-all

**Purpose**
Revokes all sessions for the current user.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "All sessions logged out",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

## POST /api/v1/auth/refresh

**Purpose**
Rotates refresh tokens and issues new auth cookies.

**Authentication**
- Public (uses cookie or body token)

**Frontend usage**
- Session refresh when access token expires.

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| refreshToken | string | No | Alternative token source if not sent in cookie |

**Notes**
- The backend first reads `req.cookies.refreshToken` and falls back to `req.body.refreshToken`.
- Frontend should not expose refresh tokens to JavaScript if the app uses HTTP-only cookies.
- The refresh flow rotates the refresh token and invalidates the prior session record.
- If the backend receives a replayed/invalid token, it responds with `401`.

**Success Response**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

**Possible errors**
- `401` refresh token required, invalid token, expired token, role mismatch, or refresh token reuse detected

## GET /api/v1/auth/me

**Purpose**
Fetches the current authenticated user.

**Authentication**
- Authenticated customer

**Frontend usage**
- Hydrating app auth state after login/refresh.

**Success Response**
```json
{
  "success": true,
  "message": "Current user fetched",
  "data": {
    "user": {
      "id": "ObjectId",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "role": "CUSTOMER",
      "emailVerified": false,
      "avatar": "",
      "isActive": true,
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  },
  "statusCode": 200
}
```

**Possible errors**
- `401` if no valid access token or user inactive

## POST /api/v1/auth/forgot-password

**Purpose**
Initiates a password reset flow.

**Authentication**
- Public

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| email | string | Yes | valid email |

**Success Response**
```json
{
  "success": true,
  "message": "If the account exists, a password reset link was sent.",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

## POST /api/v1/auth/reset-password

**Purpose**
Resets a password using a reset token.

**Authentication**
- Public

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| token | string | Yes | reset token from email link |
| password | string | Yes | minimum 8 chars |

**Success Response**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

**Possible errors**
- `400` invalid or expired token

## POST /api/v1/auth/change-password

**Purpose**
Changes the logged-in user’s password and invalidates active sessions.

**Authentication**
- Authenticated customer

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| currentPassword | string | Yes | current password |
| newPassword | string | Yes | minimum 8 chars |

**Success Response**
```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

## POST /api/v1/auth/verify-email

**Purpose**
Verifies an email verification token.

**Authentication**
- Public

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| token | string | Yes | verification token |

**Success Response**
```json
{
  "success": true,
  "message": "Email verified",
  "data": {
    "user": {
      "id": "ObjectId",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "role": "CUSTOMER",
      "emailVerified": true,
      "avatar": "",
      "isActive": true,
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  },
  "statusCode": 200
}
```

## POST /api/v1/auth/resend-verification

**Purpose**
Resends a verification email for the current user.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Verification email sent",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

### Expected frontend auth flow

```text
REGISTER
  -> EMAIL VERIFICATION if required by the product flow
  -> LOGIN
  -> backend sets HTTP-only auth cookies
  -> GET /api/v1/auth/me to hydrate user state
  -> app is authenticated
```

**Frontend requirement**
- Use `fetch(..., { credentials: "include" })` for browser requests.
- Do not store refresh or access tokens in `localStorage` when the backend uses HTTP-only cookies.
- On `401 Unauthorized`, clear local auth state and prompt the user to log in again; the app may attempt a refresh flow if it has a refresh cookie, but the frontend must not read the refresh token.

---

# Products

## GET /api/v1/products

**Purpose**
Public product listing with filtering, sorting, and pagination.

**Authentication**
- Optional authentication (`optionalAuth`)

**Query Parameters**

| Parameter | Type | Required | Description | Example |
|---|---|---:|---|---|
| page | number | No | page index, minimum 1, default 1 | `1` |
| limit | number | No | items per page, 1-100, default 12 | `12` |
| category | string | No | category filter | `running` |
| brand | string | No | brand filter | `nike` |
| gender | string | No | product gender | `MEN` |
| sort | string | No | `newest`, `price_asc`, `price_desc`, `featured` | `featured` |
| search | string | No | text search across name/description/tags | `air max` |
| minPrice | number | No | minimum price | `1000` |
| maxPrice | number | No | maximum price | `5000` |
| size | string | No | variant size filter | `9` |
| color | string | No | variant color filter | `Black` |

**Success Response**
```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": {
    "items": [
      {
        "_id": "ObjectId",
        "name": "Example sneaker",
        "slug": "example-sneaker",
        "description": "",
        "shortDescription": "",
        "images": ["https://..."],
        "brand": { "_id": "ObjectId", "name": "Brand name" },
        "category": { "_id": "ObjectId", "name": "Category name" },
        "gender": "UNISEX",
        "variants": [
          {
            "_id": "ObjectId",
            "sku": "ABC-123",
            "size": "US 9",
            "color": "Black",
            "price": 4999,
            "salePrice": null,
            "stock": 10,
            "images": ["https://..."],
            "status": "ACTIVE"
          }
        ],
        "tags": ["running"],
        "price": 4999,
        "salePrice": null,
        "status": "PUBLISHED",
        "featured": false,
        "newArrival": false,
        "bestSeller": false,
        "seo": {
          "title": "",
          "description": "",
          "keywords": []
        },
        "createdAt": "ISO date",
        "updatedAt": "ISO date"
      }
    ],
    "page": 1,
    "limit": 12,
    "total": 50,
    "totalPages": 5
  },
  "statusCode": 200
}
```

**Notes**
- Product listing filters are implemented in `productService` and query validation is performed in `listProductsQuerySchema`.
- The route allows a user to fetch both public and authenticated product lists.

## GET /api/v1/products/featured

**Purpose**
Fetches featured published products.

**Authentication**
- Public

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| limit | number | No | Defaults to 12 |

**Success Response**
```json
{
  "success": true,
  "message": "Featured products fetched successfully",
  "data": {
    "items": [],
    "page": 1,
    "limit": 12,
    "total": 0,
    "totalPages": 1
  },
  "statusCode": 200
}
```

## GET /api/v1/products/:slug

**Purpose**
Fetches a single product by slug.

**Authentication**
- Optional authentication

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| slug | string | Yes | product slug |

**Success Response**
```json
{
  "success": true,
  "message": "Product fetched successfully",
  "data": {
    "product": {
      "_id": "ObjectId",
      "name": "Example sneaker",
      "slug": "example-sneaker",
      "description": "",
      "shortDescription": "",
      "images": ["https://..."],
      "brand": { "_id": "ObjectId" },
      "category": { "_id": "ObjectId" },
      "gender": "UNISEX",
      "variants": [],
      "tags": [],
      "price": 0,
      "salePrice": null,
      "status": "PUBLISHED",
      "featured": false,
      "newArrival": false,
      "bestSeller": false,
      "seo": {
        "title": "",
        "description": "",
        "keywords": []
      }
    }
  },
  "statusCode": 200
}
```

**Possible errors**
- `404` product not found

## GET /api/v1/products/:slug/recommendations

**Purpose**
Returns recommendations for a product, using category/brand/gender/tag similarity.

**Authentication**
- Public

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| slug | string | Yes | product slug |

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| limit | number | No | defaults to 8 |

**Success Response**
```json
{
  "success": true,
  "message": "Recommendations fetched",
  "data": {
    "items": [
      {
        "_id": "ObjectId",
        "name": "Recommended sneaker",
        "slug": "recommended-sneaker"
      }
    ]
  },
  "statusCode": 200
}
```

## GET /api/v1/products/:productId/reviews

**Purpose**
Lists approved public reviews for a product.

**Authentication**
- Public

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| productId | string | Yes | product ObjectId |

**Success Response**
```json
{
  "success": true,
  "message": "Reviews fetched",
  "data": {
    "reviews": [
      {
        "_id": "ObjectId",
        "product": "ObjectId",
        "user": "ObjectId",
        "order": "ObjectId",
        "rating": 5,
        "title": "Great pair",
        "comment": "Comfortable and stylish",
        "images": ["https://..."],
        "status": "APPROVED",
        "createdAt": "ISO date",
        "updatedAt": "ISO date"
      }
    ]
  },
  "statusCode": 200
}
```

## POST /api/v1/products/:productId/reviews

**Purpose**
Submits a product review for moderation.

**Authentication**
- Authenticated customer

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| productId | string | Yes | product ObjectId |

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| rating | number | Yes | 1 to 5 |
| title | string | Yes | required |
| comment | string | Yes | required |
| images | string[] | No | optional URLs |

**Success Response**
```json
{
  "success": true,
  "message": "Review submitted for moderation",
  "data": {
    "review": {
      "_id": "ObjectId",
      "product": "ObjectId",
      "user": "ObjectId",
      "order": "ObjectId",
      "rating": 5,
      "title": "Great pair",
      "comment": "Comfortable and stylish",
      "images": [],
      "status": "PENDING"
    }
  },
  "statusCode": 201
}
```

**Notes**
- The review model has `status` values `PENDING`, `APPROVED`, `REJECTED`.
- Only approved reviews are listed publicly.
- Duplicate reviews are prevented by a unique index: `{ product, user, order }`.

## POST /api/v1/products

**Purpose**
Creates a product as admin.

**Authentication**
- Admin / Super Admin

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| name | string | Yes | product name |
| slug | string | No | optional slug |
| description | string | No | product description |
| shortDescription | string | No | short text |
| tags | string[] | No | array of tags |
| price | number | Yes | base product price |
| brand | ObjectId | No | brand reference |
| category | ObjectId | No | category reference |
| gender | enum | No | `MEN`, `WOMEN`, `UNISEX`, `KIDS` |
| images | string[] | No | array of URLs |
| variants | array | No | variant entries |
| status | enum | No | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| featured | boolean | No | optional |
| newArrival | boolean | No | optional |
| bestSeller | boolean | No | optional |
| seo | object | No | SEO block |

**Notes**
- `createProductSchema` only validates a small subset of fields; the real product model includes more fields.
- SKU uniqueness is enforced against the global variant SKU list.

## PATCH /api/v1/products/:id

**Purpose**
Updates a product as admin.

**Authentication**
- Admin / Super Admin

## DELETE /api/v1/products/:id

**Purpose**
Archives a product instead of deleting it from the database.

**Authentication**
- Admin / Super Admin

**Response**
```json
{
  "success": true,
  "message": "Product deleted successfully",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

### Product variant structure

The product model defines variants as nested objects with this contract:

```json
{
  "_id": "ObjectId",
  "sku": "ABC-123",
  "size": "US 9",
  "color": "Black",
  "price": 4999,
  "salePrice": 3999,
  "stock": 12,
  "images": ["https://..."],
  "status": "ACTIVE"
}
```

**Frontend guidance**
- A product variant is the actual SKU-bearing inventory unit.
- The backend uses `variantId` to identify a specific variant in cart operations.
- Frontend should send the variant `ObjectId` to cart endpoints, not a generated SKU.
- `SKU` is a server-side business identifier and should not be generated or modified by the frontend unless an admin product creation workflow explicitly asks for it.

---

# Categories and Brands

## GET /api/v1/categories

**Purpose**
Lists categories.

**Authentication**
- Public

**Success Response**
```json
{
  "success": true,
  "message": "Categories fetched successfully",
  "data": {
    "_id": "ObjectId",
    "name": "Running",
    "slug": "running",
    "description": "",
    "image": "",
    "parentId": null,
    "sortOrder": 0,
    "isActive": true
  },
  "statusCode": 200
}
```

The service returns a list-like value, not a nested `items` object for this endpoint.

## GET /api/v1/categories/:id

**Purpose**
Gets one category by id.

**Authentication**
- Public

## POST /api/v1/categories

**Purpose**
Creates a category as admin.

**Authentication**
- Admin / Super Admin

## PATCH /api/v1/categories/:id

**Purpose**
Updates a category as admin.

**Authentication**
- Admin / Super Admin

## DELETE /api/v1/categories/:id

**Purpose**
Deletes a category as admin.

**Authentication**
- Admin / Super Admin

## GET /api/v1/brands

**Purpose**
Lists brands.

**Authentication**
- Public

**Success Response**
```json
{
  "success": true,
  "message": "Brands fetched successfully",
  "data": {
    "_id": "ObjectId",
    "name": "Nike",
    "slug": "nike",
    "description": "",
    "logo": "",
    "isActive": true
  },
  "statusCode": 200
}
```

## GET /api/v1/brands/:id

**Purpose**
Gets one brand by id.

**Authentication**
- Public

## POST /api/v1/brands

**Purpose**
Creates a brand as admin.

**Authentication**
- Admin / Super Admin

## PATCH /api/v1/brands/:id

**Purpose**
Updates a brand as admin.

**Authentication**
- Admin / Super Admin

## DELETE /api/v1/brands/:id

**Purpose**
Deletes a brand as admin.

**Authentication**
- Admin / Super Admin

---

# Cart

## GET /api/v1/cart

**Purpose**
Gets the authenticated user’s cart.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Cart fetched successfully",
  "data": {
    "cart": {
      "userId": "ObjectId",
      "items": [
        {
          "_id": "ObjectId",
          "productId": "ObjectId",
          "variantId": "ObjectId",
          "size": "US 9",
          "color": "Black",
          "quantity": 1,
          "unitPrice": 4999
        }
      ],
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  },
  "statusCode": 200
}
```

## POST /api/v1/cart/items

**Purpose**
Adds a product variant to the cart.

**Authentication**
- Authenticated customer

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| productId | string | Yes | product ObjectId |
| variantId | string | Yes | variant ObjectId |
| quantity | number | Yes | positive integer, max 99 |

**Validation**
- `quantity` must be a positive integer.
- Product and variant must exist.
- Stock is checked on the server side.

**Success Response**
```json
{
  "success": true,
  "message": "Item added to cart",
  "data": {
    "cart": {
      "userId": "ObjectId",
      "items": []
    }
  },
  "statusCode": 200
}
```

## PATCH /api/v1/cart/items/:variantId

**Purpose**
Updates cart item quantity.

**Authentication**
- Authenticated customer

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| variantId | string | Yes | cart item variant ObjectId |

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| quantity | number | Yes | positive integer, max 99 |

**Success Response**
```json
{
  "success": true,
  "message": "Cart item updated",
  "data": {
    "cart": {
      "userId": "ObjectId",
      "items": []
    }
  },
  "statusCode": 200
}
```

**Important**
- Frontend must not trust its own calculated total or price.
- The backend validates stock and calculates the price server-side.

## DELETE /api/v1/cart/items/:variantId

**Purpose**
Removes a specific item from the cart.

**Authentication**
- Authenticated customer

## DELETE /api/v1/cart

**Purpose**
Clears the cart.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Cart cleared",
  "data": {
    "cart": {
      "userId": "ObjectId",
      "items": []
    }
  },
  "statusCode": 200
}
```

**Frontend guidance**
- Cart belongs to the authenticated user and is not a guest cart.
- Do not trust local pricing or direct client-side totals for checkout.

---

# Wishlist

## GET /api/v1/wishlist

**Purpose**
Fetches the authenticated user’s wishlist.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Wishlist fetched successfully",
  "data": {
    "wishlist": {
      "userId": "ObjectId",
      "productIds": ["ObjectId"],
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  },
  "statusCode": 200
}
```

## POST /api/v1/wishlist

**Purpose**
Adds a product to the wishlist.

**Authentication**
- Authenticated customer

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| productId | string | Yes | product ObjectId |

**Success Response**
```json
{
  "success": true,
  "message": "Product added to wishlist",
  "data": {
    "wishlist": {
      "userId": "ObjectId",
      "productIds": ["ObjectId"]
    }
  },
  "statusCode": 200
}
```

## DELETE /api/v1/wishlist/:productId

**Purpose**
Removes a product from the wishlist.

**Authentication**
- Authenticated customer

---

# Addresses

## GET /api/v1/addresses

**Purpose**
Lists the authenticated user’s addresses.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Addresses fetched",
  "data": {
    "addresses": [
      {
        "_id": "ObjectId",
        "user": "ObjectId",
        "firstName": "Jane",
        "lastName": "Doe",
        "phone": "+91 99999 99999",
        "addressLine1": "123 Main Street",
        "addressLine2": "",
        "landmark": "",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postalCode": "560001",
        "country": "India",
        "isDefault": true
      }
    ]
  },
  "statusCode": 200
}
```

## GET /api/v1/addresses/:id

**Purpose**
Gets one address by id for the authenticated user.

**Authentication**
- Authenticated customer

## POST /api/v1/addresses

**Purpose**
Creates an address.

**Authentication**
- Authenticated customer

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| firstName | string | Yes | min 2 max 80 |
| lastName | string | Yes | min 2 max 80 |
| phone | string | Yes | phone pattern `+?[0-9 ()-]{8,20}` |
| addressLine1 | string | Yes | min 3 max 180 |
| addressLine2 | string | No | max 180 |
| landmark | string | No | max 120 |
| city | string | Yes | min 2 max 80 |
| state | string | Yes | min 2 max 80 |
| postalCode | string | Yes | regex `^[0-9A-Za-z -]{3,12}$` |
| country | string | No | default `India` |
| isDefault | boolean | No | default `false` |

**Success Response**
```json
{
  "success": true,
  "message": "Address created",
  "data": {
    "address": {
      "_id": "ObjectId",
      "firstName": "Jane",
      "lastName": "Doe",
      "phone": "+91 99999 99999",
      "addressLine1": "123 Main Street",
      "addressLine2": "",
      "landmark": "",
      "city": "Bengaluru",
      "state": "Karnataka",
      "postalCode": "560001",
      "country": "India",
      "isDefault": false
    }
  },
  "statusCode": 201
}
```

## PATCH /api/v1/addresses/:id

**Purpose**
Updates an address.

**Authentication**
- Authenticated customer

## DELETE /api/v1/addresses/:id

**Purpose**
Deletes an address.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Address deleted",
  "data": {
    "ok": true
  },
  "statusCode": 200
}
```

## PATCH /api/v1/addresses/:id/default

**Purpose**
Sets an address as default.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Default address updated",
  "data": {
    "address": {
      "_id": "ObjectId",
      "isDefault": true
    }
  },
  "statusCode": 200
}
```

---

# Checkout and Orders

## POST /api/v1/orders/checkout

**Purpose**
Creates an order from the authenticated user’s cart.

**Authentication**
- Authenticated customer

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| addressId | string | Yes | address ObjectId |

**Success Response**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "_id": "ObjectId",
      "user": "ObjectId",
      "orderNumber": "KICKS-1234567890",
      "items": [
        {
          "productId": "ObjectId",
          "variantId": "ObjectId",
          "productName": "Example sneaker",
          "sku": "ABC-123",
          "size": "US 9",
          "color": "Black",
          "quantity": 1,
          "unitPrice": 4999,
          "discount": 0,
          "finalPrice": 4999
        }
      ],
      "shippingAddress": {},
      "customerSnapshot": {},
      "subtotal": 4999,
      "discountAmount": 0,
      "shippingCharge": 0,
      "tax": 0,
      "grandTotal": 4999,
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "paymentId": ""
    }
  },
  "statusCode": 201
}
```

**Order_status values implemented**
- `PENDING`
- `CONFIRMED`
- `PROCESSING`
- `PACKED`
- `SHIPPED`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- `CANCELLED`
- `REFUNDED`

**Payment status values**
- `PENDING`
- `PAID`
- `FAILED`
- `REFUNDED`

## GET /api/v1/orders/me

**Purpose**
Lists the authenticated user’s orders.

**Authentication**
- Authenticated customer

## GET /api/v1/orders/me/:id

**Purpose**
Fetches one order for the authenticated user.

**Authentication**
- Authenticated customer

## POST /api/v1/orders/me/:id/cancel

**Purpose**
Customer cancellation for specific unpaid pending orders only.

**Authentication**
- Authenticated customer

**Notes**
- Only `PENDING` orders with `paymentStatus === 'PENDING'` can be cancelled by a customer.

## GET /api/v1/orders/:id/tracking

**Purpose**
Fetches tracking data for an order, customer-facing.

**Authentication**
- Authenticated customer

## GET /api/v1/orders/:id/invoice

**Purpose**
Fetches a PDF invoice for the customer.

**Authentication**
- Authenticated customer

**Response**
- A PDF stream (`application/pdf`) from the invoice file path.
- Frontend should open/download it as a binary file.

## GET /api/v1/orders

**Purpose**
Lists all orders as admin.

**Authentication**
- Admin / Super Admin

## PATCH /api/v1/orders/:id/status

**Purpose**
Updates order status as admin.

**Authentication**
- Admin / Super Admin

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| status | string | Yes | valid order status transition |

**Notes**
- Status transitions only allow specific valid flows defined in the source.
- Some invalid transitions return `409`.

---

# Payments and Razorpay

## POST /api/v1/payments/orders/:orderId

**Purpose**
Creates a Razorpay order payload for a customer’s order.

**Authentication**
- Authenticated customer

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| orderId | string | Yes | order ObjectId |

**Success Response**
```json
{
  "success": true,
  "message": "Payment order created",
  "data": {
    "order": {
      "_id": "ObjectId",
      "orderNumber": "KICKS-1234567890",
      "grandTotal": 4999
    },
    "payment": {
      "_id": "ObjectId",
      "order": "ObjectId",
      "user": "ObjectId",
      "gatewayOrderId": "razorpay_order_id",
      "amount": 4999
    },
    "gatewayOrder": {
      "id": "razorpay_order_id",
      "amount": 499900,
      "currency": "INR",
      "receipt": "KICKS-1234567890"
    }
  },
  "statusCode": 201
}
```

**Frontend notes**
- The frontend should use the returned `gatewayOrder` object to initialize Razorpay Checkout.
- The exact Razorpay SDK payload needs the Razorpay `id`, `amount`, and `currency` values returned by the backend.

## POST /api/v1/payments/verify

**Purpose**
Verifies Razorpay payment signature and marks the order paid.

**Authentication**
- Authenticated customer

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| razorpay_order_id | string | Yes | Razorpay order id |
| razorpay_payment_id | string | Yes | Razorpay payment id |
| razorpay_signature | string | Yes | signature returned by Razorpay |

**Success Response**
```json
{
  "success": true,
  "message": "Payment verified",
  "data": {
    "payment": {
      "_id": "ObjectId",
      "status": "PAID",
      "paymentId": "razorpay_payment_id"
    }
  },
  "statusCode": 200
}
```

**Possible errors**
- `400` invalid signature, mismatch, or malformed payload
- `404` payment order not found
- `503` Razorpay not configured

## POST /api/v1/payments/webhook

**Purpose**
Razorpay webhook endpoint for backend/provider processing.

**Authentication**
- Provider webhook / backend only

**Notes**
- Frontend must not call this endpoint.
- The backend validates `x-razorpay-signature` and stores event idempotency records.

# Reviews

## GET /api/v1/products/:productId/reviews

See earlier section under products.

## POST /api/v1/products/:productId/reviews

See earlier section under products.

**Rules from source**
- Review model includes `rating` (1–5), `title`, `comment`, `images`, and `status`.
- Public listing shows only approved reviews.
- Duplicate reviews are prevented by a unique compound index on `{ product, user, order }`.

---

# Blog and CMS

## GET /api/v1/blog

**Purpose**
Lists public blog posts.

**Authentication**
- Public

**Success Response**
```json
{
  "success": true,
  "message": "Blog posts fetched",
  "data": {
    "posts": [
      {
        "_id": "ObjectId",
        "title": "Blog title",
        "slug": "blog-title",
        "content": "HTML/string content",
        "excerpt": "",
        "coverImage": "",
        "author": "ObjectId",
        "tags": ["news"],
        "seo": {
          "title": "",
          "description": ""
        },
        "status": "PUBLISHED",
        "publishedAt": "ISO date"
      }
    ]
  },
  "statusCode": 200
}
```

## GET /api/v1/blog/:slug

**Purpose**
Fetches one public blog post by slug.

**Authentication**
- Public

## GET /api/v1/blog/admin/all

**Purpose**
Admin list of blog posts.

**Authentication**
- Admin / Super Admin

## POST /api/v1/blog

**Purpose**
Creates a blog post as admin.

**Authentication**
- Admin / Super Admin

## PATCH /api/v1/blog/:id

**Purpose**
Updates a blog post as admin.

**Authentication**
- Admin / Super Admin

## GET /api/v1/cms

**Purpose**
Lists public CMS content.

**Authentication**
- Public

**Success Response**
```json
{
  "success": true,
  "message": "CMS content fetched",
  "data": {
    "items": [
      {
        "_id": "ObjectId",
        "key": "homepage-hero",
        "type": "HERO",
        "content": {},
        "sortOrder": 0,
        "active": true
      }
    ]
  },
  "statusCode": 200
}
```

## GET /api/v1/cms/admin/all

**Purpose**
Admin list of CMS content.

**Authentication**
- Admin / Super Admin

## POST /api/v1/cms

**Purpose**
Creates CMS content as admin.

**Authentication**
- Admin / Super Admin

## PATCH /api/v1/cms/:id

**Purpose**
Updates CMS content as admin.

**Authentication**
- Admin / Super Admin

---

# Notifications

## GET /api/v1/notifications

**Purpose**
Fetches notifications for the authenticated user.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Notifications fetched",
  "data": {
    "notifications": [
      {
        "_id": "ObjectId",
        "user": "ObjectId",
        "type": "ORDER",
        "title": "Order update",
        "message": "Your order has been shipped",
        "data": {},
        "readAt": null,
        "createdAt": "ISO date",
        "updatedAt": "ISO date"
      }
    ]
  },
  "statusCode": 200
}
```

## PATCH /api/v1/notifications/:id/read

**Purpose**
Marks a notification as read.

**Authentication**
- Authenticated customer

**Success Response**
```json
{
  "success": true,
  "message": "Notification marked read",
  "data": {
    "notification": {
      "_id": "ObjectId",
      "readAt": "ISO date"
    }
  },
  "statusCode": 200
}
```

---

# Recently Viewed and Recommendations

## POST /api/v1/products/:id/view

**Purpose**
Records a product view for the authenticated user.

**Authentication**
- Authenticated customer

## GET /api/v1/users/me/recently-viewed

**Purpose**
Lists recently viewed products for the authenticated user.

**Authentication**
- Authenticated customer

## DELETE /api/v1/users/me/recently-viewed

**Purpose**
Clears recently viewed products for the authenticated user.

**Authentication**
- Authenticated customer

---

# Invoices

## GET /api/v1/orders/:id/invoice

**Purpose**
Customer invoice PDF stream.

**Authentication**
- Authenticated customer

**Response**
- `Content-Type: application/pdf`
- The backend streams a PDF file directly from disk.
- Frontend should treat this as a binary PDF response and open or download it.

## GET /api/v1/admin/orders/:id/invoice

**Purpose**
Admin invoice fetch.

**Authentication**
- Admin / Super Admin

## POST /api/v1/admin/orders/:id/invoice/resend

**Purpose**
Resends an invoice as admin.

**Authentication**
- Admin / Super Admin

---

# Shipping and Tracking

## GET /api/v1/orders/:id/tracking

Customer-facing tracking endpoint.

**Authentication**
- Authenticated customer

**Response**
```json
{
  "success": true,
  "message": "Tracking fetched",
  "data": {
    "shipment": {
      "_id": "ObjectId",
      "order": "ObjectId",
      "provider": "shiprocket",
      "shipmentId": "",
      "awb": "",
      "trackingUrl": "",
      "status": "CREATED",
      "events": []
    }
  },
  "statusCode": 200
}
```

## POST /api/v1/shipments/webhook

**Purpose**
Shipping provider webhook endpoint for backend validation.

**Authentication**
- Provider webhook / backend only

**Notes**
- Frontend must not call this endpoint.
- It validates a shipping provider signature and records webhook idempotency.

## POST /api/v1/admin/orders/:id/ship

**Purpose**
Creates shipment for an order as admin.

**Authentication**
- Admin / Super Admin

---

# Uploads and Cloudinary

## POST /api/v1/uploads/images

**Purpose**
Uploads a product image to Cloudinary as admin.

**Authentication**
- Admin / Super Admin

**Request Headers**
- `Content-Type: multipart/form-data`

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| image | file | Yes | uploaded image file |

**Validation**
- Multer memory storage
- `fileSize` limit: 5MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

**Success Response**
```json
{
  "success": true,
  "message": "Image uploaded",
  "data": {
    "url": "https://res.cloudinary.com/...",
    "publicId": "folder/filename",
    "width": 1200,
    "height": 800
  },
  "statusCode": 201
}
```

## DELETE /api/v1/uploads/images/:publicId

**Purpose**
Deletes a Cloudinary image by public ID as admin.

**Authentication**
- Admin / Super Admin

## PUT /api/v1/uploads/images/:publicId

**Purpose**
Replaces a Cloudinary image as admin.

**Authentication**
- Admin / Super Admin

**Request Headers**
- `Content-Type: multipart/form-data`

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| image | file | Yes | replacement image |

---

# Inventory

## GET /api/v1/inventory

**Purpose**
Lists inventory entries as admin.

**Authentication**
- Admin / Super Admin

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| page | number | No | page index |
| limit | number | No | max 100 |
| lowStock | boolean | No | `true` for low stock filter |
| productId | string | No | product filter |

## GET /api/v1/inventory/low-stock

**Purpose**
Lists low-stock inventory as admin.

**Authentication**
- Admin / Super Admin

## GET /api/v1/inventory/:variantId

**Purpose**
Fetches inventory item for a variant.

**Authentication**
- Admin / Super Admin

## POST /api/v1/inventory/:variantId/adjust

**Purpose**
Adjusts stock for a variant as admin.

**Authentication**
- Admin / Super Admin

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| delta | number | Yes | inventory delta |
| reason | string | No | adjustment reason |
| referenceId | string | No | optional reference |

## GET /api/v1/inventory/:variantId/movements

**Purpose**
Lists stock movement history for a variant as admin.

**Authentication**
- Admin / Super Admin

---

# Admin API

## ⚠️ ADMIN ONLY

The following routes are guarded by `protect` + `isAdmin`:

### GET /api/v1/admin/dashboard

**Purpose**
Fetches admin dashboard metrics.

**Authentication**
- Admin / Super Admin

### GET /api/v1/admin/users

**Purpose**
Lists users.

**Authentication**
- Admin / Super Admin

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| page | number | No | default 1 |
| limit | number | No | default 20 |
| role | string | No | `CUSTOMER`, `ADMIN`, `SUPER_ADMIN` |
| isActive | boolean | No | filter active users |

### GET /api/v1/admin/users/:id

**Purpose**
Gets one user by id.

**Authentication**
- Admin / Super Admin

### PATCH /api/v1/admin/users/:id/status

**Purpose**
Activates or deactivates a user.

**Authentication**
- Admin / Super Admin

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| isActive | boolean | Yes | activate/deactivate |

### GET /api/v1/admin/inventory

**Purpose**
Admin inventory listing.

### GET /api/v1/admin/inventory/low-stock

**Purpose**
Lists items below stock threshold.

### GET /api/v1/admin/inventory/:variantId

**Purpose**
Gets inventory item by variant id.

### POST /api/v1/admin/inventory/:variantId/adjust

**Purpose**
Adjusts stock and logs movement.

### GET /api/v1/admin/inventory/:variantId/movements

**Purpose**
Shows stock movements for a variant.

### GET /api/v1/admin/settings

**Purpose**
Lists admin settings.

### PATCH /api/v1/admin/settings/:key

**Purpose**
Updates an admin setting.

**Request Body**

| Field | Type | Required | Description |
|---|---|---:|---|
| value | any | Yes | new value |
| description | string | No | optional description |

### GET /api/v1/admin/audit-logs

**Purpose**
Lists audit logs.

Removed from the launch Admin Panel (no longer present in source): `GET /api/v1/admin/notifications`, `PATCH /api/v1/admin/notifications/:id`, `POST /api/v1/admin/ai/*`, `POST /api/v1/admin/orders/:id/refund`, `GET /api/v1/admin/reviews`, `PATCH /api/v1/admin/reviews/:id/approve`, `PATCH /api/v1/admin/reviews/:id/reject`.

### POST /api/v1/admin/orders/:id/ship

**Purpose**
Creates a shipping record for an order.

### GET /api/v1/admin/orders/:id/invoice

**Purpose**
Gets invoice as admin.

### POST /api/v1/admin/orders/:id/invoice/resend

**Purpose**
Resends invoice as admin.

---

# Backend / Provider Webhooks

## 🚫 FRONTEND MUST NOT CALL THESE

### POST /api/v1/payments/webhook

**Purpose**
Razorpay webhook processing for payment events.

**Authentication**
- Backend / provider only

**Notes**
- Signature validation is required.
- Duplicate events are idempotent.

### POST /api/v1/shipments/webhook

**Purpose**
Shipping provider webhook processing.

**Authentication**
- Backend / provider only

**Notes**
- Signature validation is required.
- Duplicate shipping events are protected by dedupe logic.

---

# Error handling

The backend uses a centralized error middleware with this general shape:

```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": [],
  "requestId": "uuid-or-header-value"
}
```

## Actual error patterns

### 400 Bad Request

Examples:
- validation failure
- malformed payload
- invalid quantity
- invalid payment/request shape

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [""],
  "requestId": "uuid-or-header-value"
}
```

### 401 Unauthorized

Examples:
- missing or invalid access token
- expired JWT
- forged role mismatch
- invalid refresh token

```json
{
  "success": false,
  "message": "Authentication failed",
  "errors": ["Invalid or expired token"],
  "requestId": "uuid-or-header-value"
}
```

### 403 Forbidden

Examples:
- regular customer tries to access admin routes
- token role not allowed for route

```json
{
  "success": false,
  "message": "Forbidden",
  "errors": ["You do not have permission to perform this action"],
  "requestId": "uuid-or-header-value"
}
```

### 404 Not Found

Examples:
- product missing
- order missing
- inventory missing
- brand/category missing

```json
{
  "success": false,
  "message": "Product not found",
  "errors": [],
  "requestId": "uuid-or-header-value"
}
```

### 409 Conflict

Examples:
- duplicate SKU
- invalid order transition
- duplicate event or state mismatch

```json
{
  "success": false,
  "message": "Duplicate value detected",
  "errors": ["Duplicate field: sku"],
  "requestId": "uuid-or-header-value"
}
```

### 429 Too Many Requests

Auth / API rate limits:

```json
{
  "success": false,
  "message": "Too many authentication attempts. Please try again later.",
  "errors": ["Rate limit exceeded"]
}
```

### 500 Internal Server Error

For unexpected server errors, the backend returns:

```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": [],
  "requestId": "uuid-or-header-value"
}
```

**Request ID behavior**
- Response header: `X-Request-Id`
- Response payload includes `requestId` when available

---

# Pagination

Pagination is implemented in the products and admin inventory/user/audit log endpoints. The backend’s service returns `page`, `limit`, `total`, and `totalPages` values.

Example:

```json
{
  "items": [],
  "page": 1,
  "limit": 12,
  "total": 50,
  "totalPages": 5
}
```

Not every endpoint uses the same paginated shape; some endpoints intentionally return `items` or `posts` arrays without pagination metadata.

---

# Frontend API client recommendation

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || 'Request failed';
    throw new Error(message);
  }

  return (payload?.data ?? payload) as T;
}
```

**Important**
- For file/PDF responses, do not parse as JSON. Handle those as binary downloads or streams.
- For browser auth, rely on HTTP-only cookies and `credentials: 'include'`.
- The frontend should not store JWTs in localStorage or sessionStorage if the backend is using cookies.

---

# Frontend route → API mapping

| Frontend Page | API Endpoint | Method | Auth | Purpose |
|---|---|---|---|---|
| Home | `/api/v1/products` | GET | Public | storefront listing |
| Shop | `/api/v1/products` | GET | Public | filters/search/listing |
| Product Detail | `/api/v1/products/:slug` | GET | Public / optional auth | product detail |
| Search | `/api/v1/products` | GET | Public | search/filter results |
| Login | `/api/v1/auth/login` | POST | Public | login |
| Register | `/api/v1/auth/register` | POST | Public | register |
| Account | `/api/v1/auth/me` | GET | Customer | hydrate user |
| Wishlist | `/api/v1/wishlist` | GET / POST / DELETE | Customer | wishlist operations |
| Cart | `/api/v1/cart` | GET / POST / PATCH / DELETE | Customer | cart operations |
| Checkout | `/api/v1/orders/checkout` | POST | Customer | create order |
| Orders | `/api/v1/orders/me` | GET | Customer | list orders |
| Order Detail | `/api/v1/orders/me/:id` | GET | Customer | order detail |
| Tracking | `/api/v1/orders/:id/tracking` | GET | Customer | shipment tracking |
| Invoice | `/api/v1/orders/:id/invoice` | GET | Customer | PDF invoice |
| Reviews | `/api/v1/products/:productId/reviews` | GET / POST | Public / Customer | review listing and submission |
| Blog | `/api/v1/blog` | GET | Public | blog listing |
| CMS/Homepage | `/api/v1/cms` | GET | Public | homepage content |
| Notifications | `/api/v1/notifications` | GET / PATCH | Customer | notifications |
| Admin Dashboard | `/api/v1/admin/dashboard` | GET | Admin | dashboard |
| Admin Products | `/api/v1/products` | POST / PATCH / DELETE | Admin | product admin operations |
| Admin Orders | `/api/v1/orders` | GET / PATCH | Admin | order management |
| Admin Inventory | `/api/v1/inventory` | GET | Admin | inventory management |

---

# Frontend integration checklist

- [ ] API base URL configured
- [ ] Browser requests send `credentials: "include"`
- [ ] Login flow implemented using `/api/v1/auth/login`
- [ ] Refresh flow implemented using `/api/v1/auth/refresh`
- [ ] Auth state initialized using `/api/v1/auth/me`
- [ ] Logout implemented
- [ ] Product listing connected
- [ ] Filters connected
- [ ] Search connected
- [ ] Product detail connected
- [ ] Wishlist connected
- [ ] Cart connected
- [ ] Address CRUD connected
- [ ] Checkout connected
- [ ] Razorpay connected
- [ ] Order listing connected
- [ ] Order detail connected
- [ ] Tracking connected
- [ ] Invoice connected
- [ ] Reviews connected
- [ ] Notifications connected
- [ ] Blog connected
- [ ] CMS connected
- [ ] Admin APIs separated from customer APIs
- [ ] Provider webhooks are never called from frontend

---

# Important source-based notes

- Auth uses cookies and does not require frontend token storage when using browser fetches.
- The backend accepts `Authorization: Bearer ...` in middleware, but the normal browser flow is cookie-based and should not expose refresh tokens to JavaScript.
- Frontend should treat server responses as source of truth for price, stock, discount, and final payable amount.
- Cloudinary upload endpoints are admin-only and require multipart upload with a single file named `image`.
- Payment and shipment webhook routes are backend/provider-only.
- Some admin endpoints exist in route files but require additional provider credentials to execute against live systems.
- Where the source was not explicit enough to document a response or payload with high confidence, the doc calls out the limitation rather than guessing.

This reference was created from the current source code and does not modify backend application logic.
