# Task: connect the PetWork Flutter app to the PetWork backend (same API as the web admin)

We have a React web admin (petwork-admin-ui) that already talks to our backend. Build the **service / data layer** of our Flutter (Dart) app so it calls the **same endpoints in the same way** for:

- **Login** (session + bearer token)
- **Menu** (which screens the user may open)
- **Inventory → Product Management** (list, search, filters, create, edit, delete, view product)
- **Orders → Create Order** (product list, view product, cart add/update/remove, checkout)

Use GET, POST, PATCH and DELETE exactly as described below. Do not invent endpoints: every product/order URL comes from **backend "blueprints"** (JSON that describes screens), so the app must read the blueprint first and call the URLs it contains.

---

## 1. Base configuration

```
API_BASE_URL = <same value as VITE_API_BASE_URL in the web app's .env>   // no trailing slash
API_VERSION  = v1                                                          // replaces {version} in any path
TIMEOUT      = 30 seconds per request
```

Make both configurable (e.g. `--dart-define` or a config file). Strip trailing `/` from the base URL.

### Path resolution (used everywhere)

Blueprint paths look like `products/platform/{version}/api/products`. Resolve them like this:

```dart
String resolveApiPath(String path) {
  final p = path.replaceAll('{version}', apiVersion);
  return p.startsWith('/') ? p : '/$p';
}

String resolveRecordPath(String path, String recordId) =>
    resolveApiPath(path.replaceAll('{recordId}', Uri.encodeComponent(recordId)));
```

The full URL is `API_BASE_URL + resolvedPath`.

---

## 2. HTTP client (one shared client; `dio` recommended)

Every request:
- Header `Accept: application/json`.
- JSON bodies: `Content-Type: application/json`. Multipart bodies: let the library set the multipart content type and boundary.
- Authenticated requests (everything except login/register): header `Authorization: Bearer <bearerToken>`. If there is no valid session, don't send the request: sign the user out and go to the login screen.
- Never cache responses: always fetch fresh data.
- The response body may be empty, JSON, or plain text. Parse JSON when possible, otherwise keep the text.

### Errors

On a non-2xx response, throw an `ApiException(message, statusCode)`. Build `message` from the body in this order:
1. `detail` is a string → use it.
2. `detail` is a list (FastAPI validation) → for each item use `msg`. If the last element of `loc` is one of `name/email/phone/password/profileCode`, prefix it with the label (`Name: …`). Join the items with `. `.
3. `errorMessages` is a non-empty list → join with `. `.
4. `message` is a string → use it.
5. Otherwise → `Request failed (<status>)`.

- **401 on an authenticated request:** clear the session and send the user to login.
- **Timeout:** "The server took too long to respond. Please try again." (status 0).
- **No network:** "Unable to reach the server. Check your connection and try again." (status 0).

### Concurrent duplicate requests

If the same GET (same URL) is already in flight, reuse that Future instead of firing a second request. Forget it as soon as it completes; this is **not** a cache.

---

## 3. Auth

### Login: `POST /users/api/login` (no auth header)
Body: `{ "email": "...", "password": "..." }`
Response: `{ "bearerToken": "...", "refreshToken": "...", "expiresIn": "3600" }` (`expiresIn` is **seconds, sent as a string**).
- No `bearerToken` → error "Login failed: the server did not return a token."
- `expiresAt = now + expiresIn*1000 ms`. If `expiresIn` is missing or invalid, use 1 hour.
- Store `{ email, bearerToken, refreshToken, expiresAt }` in secure storage (`flutter_secure_storage`). With "remember me", keep it across app restarts; otherwise keep it in memory only.
- When reading the session: if it's expired, or there's no token, delete it and treat the user as signed out.

### Public sign-up: `POST /users/api/CustomerRegister` (no auth header)
Body: `{ "name", "email", "phone", "password" }`. Response: `{ "message"? }`. Show `message`, or "Account created successfully.".

### Admin creates a user: `POST /users/api/register` (auth)
Body: `{ "name", "email", "phone", "password", "profileCode" }` (e.g. `VET`, `STAFF`, `ADMIN_PROFILE`). Response: `{ "message"? }`.

### Logout
Clear the stored session locally. There is no logout endpoint.

---

## 4. Menu: `GET /users/api/menulinks` (auth)

Response:
```json
{
  "records": [
    {
      "mainMenuCode": "INVENTORY", "mainMenuName": "Inventory", "icon": "...",
      "subMenuList": [
        { "subMenuCode": "...", "subMenuName": "Product Management", "url": "...", "order": 1,
          "dataTableBluePrintUrl": "...", "searchBluePrintUrl": "..." }
      ]
    }
  ],
  "errorMessages": null
}
```
- If `errorMessages` is non-empty and `records` is empty → throw an error with the joined messages.
- Sort `subMenuList` by `order` (null = 0).
- **Product Management** and **Create Order** are sub-menus. Each carries a `dataTableBluePrintUrl` (the table screen) and an optional `searchBluePrintUrl` (its filters). Note the capital **P** in `BluePrint` in these keys.

---

## 5. Blueprints (fetch fresh every time a screen opens, never cache)

### 5.1 Loading a blueprint URL
- Normal URL → `GET resolveApiPath(url)`.
- If the URL matches `^/?([\w-]+)/blueprint/\{version\}/([\w-]+)$` (e.g. `products/blueprint/{version}/productEditForm`):
  1. `GET /api` + `resolveApiPath(url)` → `/api/products/blueprint/v1/productEditForm`
  2. If that returns **404**, retry `GET /{service}/api/blueprint/{name}` → `/products/api/blueprint/productEditForm`.

### 5.2 Data table blueprint (`GET {dataTableBluePrintUrl}`)
```json
{
  "dataGrid": [ { "field": "name", "displayName": "Name", "mobileDisplay": true, "display": true } ],
  "dataApi": "products/platform/{version}/api/products",
  "actions": [ /* header buttons: Create, Cart ... */ ],
  "rowLevelactions": [ /* per-record: view, edit, delete, add to cart ... */ ],
  "enableMultipleDisplayModes": true,
  "defaultDisplayMode": "cards",
  "availableDisplayModes": [ { "label": "Cards", "value": "cards" }, { "label": "Table", "value": "table" } ],
  "mappings": { "recordId": "sku" }
}
```
- `display: false` columns are hidden. `mappings.recordId` names the record field that is the row's id (`recordId = record[mappings.recordId]`).
- **Action object**: `{ action, displayName, iconName?, iconToolTip?, blueprintApi?, dataApi?, createApi?, display? }`.
  - The backend's casing is inconsistent. Normalise the form link from the first non-empty of these keys: `blueprintApi, bluePrintApi, blueprintUrl, bluePrintUrl, blueprintAPI, bluePrintAPI`.
  - `display: false` → no button is shown, but the action still runs (e.g. "view" when a product is tapped).
  - Icons arrive as Font Awesome names (`fa-plus`, `fa-edit`, `fa-trash`, `fa-eye`, `fa-shopping-cart`, `fa-cart-plus`…) in `iconName`, `iconToolTip` or `displayName`. Map them to Flutter icons.
  - Label = the first of `displayName` / `iconToolTip` that doesn't start with `fa-`, else `action`.

### 5.3 Search blueprint (`GET {searchBluePrintUrl}`)
```json
{ "searchForm": [
  { "field": "q", "displayName": "Search Products", "fieldType": "textBox", "quickSearchFilter": true,
    "placeholder": "Search by name", "rules": [ { "minSize": "2", "maxSize": "100" } ] },
  { "field": "brandName", "displayName": "Brand", "fieldType": "cascadeDropDown",
    "api": "catalog/platform/{version}/api/brands?size=50&page=0",
    "dropdownCode": "brandName", "dropdownValue": "brandName" },
  { "field": "productType", "fieldType": "dropDown", "quickSearchFilter": true,
    "staticDropDownValues": [ { "productType": "Food", "productTypeName": "Food" } ],
    "dropdownCode": "productType", "dropdownValue": "productTypeName" }
] }
```
- If the search blueprint fails to load, show the list without search (don't fail the screen).
- `quickSearchFilter: true` → shown inline in the search bar. **All other fields** go in a separate "More filters" sheet behind a filter button, and new non-quick fields the backend adds later must appear there automatically.
- Text fields apply only once the trimmed text length is ≥ `rules[0].minSize` (default 1). Debounce typing by ~350 ms. Dropdown picks apply immediately.

### 5.4 Dropdown options (search and forms)
- `fieldType` is `dropDown` or `cascadeDropDown`.
- If `api` is non-empty → `GET resolveApiPath(api)` (the URL already has its own page/size; don't add any).
- Otherwise use `staticDropDownValues`.
- Map each row to `value = row[dropdownCode ?? 'code']`, `label = row[dropdownValue ?? 'name'] ?? value`. Skip rows whose code is null.

---

## 6. Records, pagination and search

**Response envelope (everywhere):** a list response is either a bare JSON array or `{ "records": [ ... ] }`. Anything else → empty list.

### 6.1 Unfiltered list: `GET {dataApi}?page={page}&size=24`
- Pages start at **0**. Page size is **24**. Use `&` instead of `?` if `dataApi` already has a query.
- `hasNext`, in priority order: `body.hasNext` (bool) → `page + 1 < body.totalPages` → `(page + 1) * 24 < body.total` → `records.length == 24`.
- UI: Previous / Next paging.

### 6.2 Filtered search: `GET {dataApi}?field1=value1&field2=value2&page={page}&size=24`
- Send every active filter (quick and "more" filters together) as query params with trimmed values. The backend does the filtering.
- `hasMore = results.length == 24`. UI: a "Load more" button appends the next page.
- If filters change while a request is in flight, ignore the older response (keep a request counter).
- When all filters are cleared, go back to the unfiltered list.

---

## 7. Product Management: create / edit / delete

### 7.1 Opening a form
- **Create:** a header action with a `blueprintApi` → load that form blueprint, start with empty or default values.
- **Edit:** a row action with a `blueprintApi` (action is `edit`, or its label is "Edit", or its icon is an edit icon) → load the form blueprint, then prefill.

Form blueprint (`GET {blueprintApi}`):
```json
{
  "displayName": "Update Product",
  "editForm": [ /* field definitions */ ],
  "createApi": "products/platform/{version}/api/products",
  "dataApi":   "products/platform/{version}/api/products/{recordId}",
  "mappings":  { "recordId": "productId" },
  "refreshOnSave": true,
  "resetButton": true
}
```

**Prefill on edit:**
- `recordId = record[form.mappings.recordId]`, else the table row's id.
- If `dataApi` and `recordId` exist → `GET resolveRecordPath(dataApi, recordId)` and merge the result over the table row. If that GET fails, prefill from the table row alone.
- The single-record response may be bare, `[ {...} ]`, `{ "records": [ {...} ] }`, `{ "record": {...} }` or `{ "data": {...} }`; unwrap it.

### 7.2 Field definitions
`{ field, displayName, fieldType, placeholder?, toolTip?, editable?, api?, values?: [{radioValue}], visibilityCriteria?, valuesDependOnField?, dropdownCode?, dropdownValue?, rules: [ { mandatory?, minSize?, maxSize?, allowValues?, default?, multiple?, minItems?, maxItems?, uniqueBy?, uniqueTogether?, singleTrueField? } ], childFields?, addButtonLabel? }`. All rule numbers arrive as **strings**.

`fieldType` values:
- `textBox`, `checkBox`, `radioButton` (`values`), `dropDown`, `cascadeDropDown` (options as in §5.4).
- `fileUpload`: `rules.multiple` = several files. `allowValues` = allowed extensions (comma separated). `maxSize` = max file size, e.g. `"2MB"`.
- `repeatableGroup`: a list of rows, each row being `childFields` (e.g. product **variants**: unitSize, mrp, isDefault, mainImage, subImages).
  - Start with `minItems` rows. Rows can be added (button text = `addButtonLabel` or "Add") up to `maxItems`, and removed down to `minItems`.
  - `singleTrueField` (e.g. `isDefault`): turning it on in one row turns it off in all others.
  - `uniqueBy` / `uniqueTogether` (comma separated): those child values must not repeat across rows.
- `nonrepeatableGroup`: exactly **one** row of `childFields`, with no add/remove. It's sent as a single object (see §7.4).

Other rules:
- `editable: false` → can only be set when creating; read-only when editing.
- `visibilityCriteria` such as `field.petType =='Cat' && field.productType == 'Food'`: only `field.x == 'v'` / `field.x != 'v'` clauses joined with `&&` / `||` are supported. Anything unparseable → hidden. Hidden fields aren't validated.
- `valuesDependOnField` (comma-separated field names): when any of those fields changes, reset this field to its default.
- Validation: `mandatory`, text length `minSize`/`maxSize`, file extension and size, group rules. Errors for group children are keyed `group.index.child` (e.g. `variants.0.mrp`).

### 7.3 Saving
- **Create:** `POST resolveApiPath(createApi)`.
- **Edit:** `PATCH resolveRecordPath(dataApi, recordId)`. **Updates are PATCH, not PUT.**
- **Body type:** if any field, or any group child field, is `fileUpload` → **always multipart**, even when no new file was picked. Otherwise → **JSON**.
- Every field in the blueprint is sent (empty text as `""`).

### 7.4 Body format

**JSON** (`toJson`):
- Text: trimmed. Unset values: `null`. File fields: omitted.
- `repeatableGroup`: a list of row objects. `nonrepeatableGroup`: one object.
- If any existing images were removed → `"removeImages": [urls...]`.

**Multipart** (`FormData`):
- Text fields → trimmed string parts. Checkboxes → `"true"` / `"false"`.
- Top-level file field → part named `<field>`, repeated once per file when `multiple`.
- `repeatableGroup` → part `<group>` = **JSON string** of the rows. New files go as parts `<group>[<i>][<child>]`, e.g. `variants[0][mainImage]`, and `variants[0][subImages]` repeated once per file.
- `nonrepeatableGroup` → part `<group>` = **JSON string** of the one object. Files go as `<group>[<child>]`.
- In the rows' JSON:
  - Leave out file children of **new** rows.
  - For a row **loaded from the server**, set each file child to the image URLs it still keeps: a string (or null) for single-file fields, a list for `multiple` ones.
- Each removed server image URL → its own part `removeImages=<url>`.

### 7.5 Delete
A row action with `action == "delete"` and a `dataApi`:
1. Ask the user to confirm.
2. `DELETE resolveRecordPath(dataApi, recordId)`.
3. On success, refresh the list.

---

## 8. Create Order: view product, cart, checkout

### 8.1 Variant id of a product row
Take `record.variants` (a list): use the one with `isDefault == true`, else the first, else the record itself. Read the id from the first non-null of `variantId, varientId, variant_id, id, _id, variantCode`. (`varientId` is a real backend spelling.)

### 8.2 View product
A row action with `action == "view"` (case-insensitive) and a `dataApi`, usually `display: false`, so it runs when a product card is tapped:
- `GET resolveApiPath(dataApi)`, after replacing the first `{variantId}`, `{varientId}`, `{recordId}` or `{id}` placeholder (case-insensitive) with the url-encoded variant id.
- Unwrap the single record as in §7.1.
- The response holds the product and its variants: unit selector, price/MRP/discount, images.

### 8.3 Cart
- **Add-to-cart action:** a row action with a `createApi` whose `action`, `displayName`, `iconName` or `iconToolTip` contains "cart" (case-insensitive).
- **Cart header action:** a header action whose name contains "cart", with a `dataApi` and no `blueprintApi`.
- **Read the cart:** `GET resolveApiPath(cartHeader.dataApi ?? addAction.createApi)`. Load it when the screen opens (so product cards show their current quantities) and again whenever the cart screen opens.
- **Set quantity** (on "Add to cart" and on every +/−, always sending the **new total quantity**, not a delta):
  `POST resolveApiPath(addAction.createApi)` with body `{ "variantId": "<id>", "quantity": <int> }`.
- **Remove** (when the quantity reaches 0; the POST does **not** accept 0):
  `DELETE resolveApiPath(addAction.createApi)` without its trailing `/`, plus `/<urlEncoded variantId>`.
- If there's no add action, use the cart header's `dataApi` as the `createApi` for these calls.

**Parsing the cart response.** Its shape isn't fixed, so walk the whole JSON (up to depth 6). Any object that has a variant id and a quantity > 0 is a cart line:
- Variant id: `variantId | varientId | variant_id` on the object, else `variant.id | variant._id | …` on a nested `variant`.
- Quantity: `quantity | qty | cartQuantity | count`.
- For the other values, look on the object, then on its nested `variant`, then on `product`:
  - name: `productName | name | title | displayName`
  - size: `unitSize | size | packSize | weight`, plus `unitType | unit` appended if it's not already in the text
  - price: `finalPrice | unitPrice | sellingPrice | salePrice | price`
  - mrp: `mrp | mrpPrice | maximumRetailPrice`
  - image: the first URL under any key matching `/image|img|photo|picture|thumb/i`, preferring keys containing "main"
- Numbers may arrive as strings like `"₹660"`. Strip everything except digits, `.` and `-` before parsing.
- Bill amounts are read from the top level merged over the first object among `data`, `cart` and `records[0]`:
  - charges: `deliveryCharge` / `deliveryFee` (Delivery charge), `handlingCharge` / `handlingFee` (Handling charge), `tax`, `gst`, `discount`. Show only the non-zero ones.
  - grand total: `grandTotal | totalAmount | total | payableAmount`.

### 8.4 Checkout (current web behaviour, do not invent APIs)
- **Delivery addresses:** there is **no address API yet**. The web keeps them on the device: `{ id, tag: Home|Work|Other, name, phone, line1, line2?, city, state, pincode }`. Use local storage (e.g. `shared_preferences`) the same way until the backend adds an endpoint.
- **Payment mode:** cash on delivery only, UI only.
- **Place order / invoice:** there is **no place-order endpoint wired in the web app yet**; the invoice is generated on the client. Build the checkout UI, but leave `placeOrder()` as a clearly marked TODO stub in the service layer. Do **not** guess an endpoint.

---

## 9. What to deliver

1. `ApiClient` (dio): base URL, bearer token, timeout, error mapping (§2), 401 → logout, in-flight GET de-duplication.
2. `AuthService` + `SessionStore` (§3).
3. `MenuService` (§4).
4. `BlueprintService` (§5): table, search and form blueprints with the `/api` → fallback rule and action-key normalisation.
5. `RecordService` (§6–7): `fetchPage`, `search`, `fetchOptions`, `fetchRecord`, `create`, `update` (PATCH), `delete`, plus JSON/multipart body builders that follow §7.4 exactly.
6. `ProductService.fetchVariantDetails` (§8.2).
7. `CartService` (§8.3): `fetchCart`, `setQuantity`, `remove`, with the tolerant parser.
8. Typed Dart models for blueprints, actions, fields and rules, cart and cart line. Keep records as `Map<String, dynamic>`, because their shape is defined by the blueprint columns.
9. Unit tests for: path resolution, error-message extraction, `hasNext` logic, the record unwrapping variants, cart parsing (nested `variant`, string prices), and the multipart part names (`variants[0][mainImage]`, `group[child]`, `removeImages`).

Rules: no hardcoded product/order URLs (they all come from blueprints), no caching, page size 24, pages start at 0, and updates use PATCH.
