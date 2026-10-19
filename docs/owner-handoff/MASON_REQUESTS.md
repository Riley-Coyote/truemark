# Mason's notes and requests for TrueMark

Consolidated 18 October 2026 for Riley and anyone continuing the TrueMark work. This file combines Mason's requests from this conversation, his complete approved inventory brief, and all 14 pages of **TrueMark complete meeting notes for Riley.pdf**. The meeting document's reference pictures remain in the original PDF; their captions, page numbers and requested behavior are retained below.

This is the single requirements and continuation record requested for branch **`mason/notes`** in **`Riley-Coyote/truemark`**. Meeting requests are distinguished from work already implemented. Recording a request here does not mean it is finished, connected to production, or authorized for immediate execution. Mason remains the product owner and can make implementation and release decisions directly; references to Riley's review in the meeting notes describe the requested collaboration, not a mandatory approval dependency.

## 1. Decisions settled in this conversation

### Simple products, lots, certificates and fulfillment

Mason asked to replace confusing, disconnected Products, Inventory, Lots and Certificates pages with a single intuitive workflow. Staff should be able to add a product that does not exist yet or receive another lot of an existing product without duplicate entry. Receiving and fulfillment should be easy enough for an ordinary authorized employee to perform manually.

The concrete example is a 30 mg product with **10 units remaining in an older lot** and **100 new units under a different lot number**. These are example quantities, not a statement of real production stock. The older eligible lot sells first. If an order needs 15 units, use 10 from the older lot and 5 from the next eligible lot.

Mason explicitly settled these rules:

- Use **first actual receipt first** among eligible lots. Do not order lots by certificate upload or quarantine release time.
- **Quarantine** means supply has been physically received and is awaiting testing results.
- Stock stays unavailable until the matching certificate is uploaded and the eligibility conditions in the approved brief are met.
- Saving the matching passing certificate automatically clears testing quarantine. Do not add a separate manual release step. Other active holds still apply.
- Use Command Center for fulfillment and show actual lots and quantities to pick.
- Everything operational must be editable: names, unit amounts, lot numbers, statuses, receipt details, certificates and related product fields. Preserve relationships and history; do not let edits bypass availability or reservations.
- Keep incoming, quarantined, awaiting-certificate and otherwise held quantities understandable. Add multiple lots to one product and track them seamlessly.
- Preserve existing products, inventory, orders, certificates and completed fulfillment history.

The full implementation request supplied after those clarifications is reproduced in section 2.

### Customer retention

Mason approved building the proposed retention tools and explained that reorder timing **varies too much to use a standard timeframe**. Track useful customer and purchase interactions from the start so the history can inform decisions after roughly six months. Six months is an analysis milestone, not a deletion date or a guarantee of enough evidence.

Approved direction:

- Useful customer groups and individual customer drill-down.
- Product-specific purchase history, repeat purchases and latest purchase dates.
- A unified history of purchases, refunds, customer contacts/replies, follow-ups, consent and delivery outcomes where those sources are connected.
- Editable notes, contact/reply logs, reminders and unsent drafts.
- Outcome tracking, including purchases after a contact, without claiming that outreach caused the purchase.
- Longer/selectable history and exports that remain useful as more data accumulates.
- No universal reorder deadline or automatic assumption that a customer is overdue. Show observed gaps, sample sizes and insufficient-history states.
- Keep draft messages distinct from actual sends and simulated delivery distinct from real customer contact.

The implementation uses owner-default access to private activity with configurable staff grants, consistent with the existing communications direction. Existing purchase analytics retain their team access.

### Email delivery decision

Mason asked for the best email delivery system before implementation, then explicitly said to worry about that later and continue. **Provider selection and real email delivery are deferred.** Do not block the manual retention workflow on this decision or activate an existing adapter because its code is present.

The 17 October research checkpoint suggested evaluating Amazon SES while retaining customer history in TrueMark. This was an engineering recommendation, not Mason's provider selection. Eligibility and account readiness were unconfirmed. The same checkpoint noted Resend restrictions relevant to research-use-only product content, Klaviyo restrictions relevant to pharmaceutical products, and an unconfirmed earlier mention of Omnisend. These are dated research findings; recheck current policies and the intended catalog/use when the decision resumes. No provider was contacted or activated and no real customer messages were sent in this work.

Reference pages recorded for future verification: [Amazon SES](https://aws.amazon.com/ses/), [production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html), [SES events](https://docs.aws.amazon.com/ses/latest/dg/event-destinations-manage.html), [Resend policy](https://resend.com/legal/acceptable-use), and [Klaviyo policy](https://www.klaviyo.com/legal/acceptable-use-policy).

## 2. Complete approved inventory implementation brief

The following is Mason's supplied inventory brief, preserved verbatim. Its examples define the intended behavior; they are not production fixtures to import.

Redesign the Command Center’s Products, Inventory, Lots, and Certificates pages into one intuitive product and inventory workspace.

Inspect the existing application, inventory logic, checkout, and fulfillment workflow before implementing. Use the existing architecture and design. Preserve existing products, inventory, certificates, orders, and fulfillment history.

### 1. One product, multiple lots

A product can have multiple lots. Each lot has its own:
- Lot number.
- Received quantities and remaining inventory.
- Actual receipt date.
- Testing status.
- Certificate of analysis.
- Inventory and fulfillment history.

For example, a 30 mg product has 10 available units from an older lot. A new shipment contains 100 units of the same product under a different lot number.

Show:
- Before arrival: 10 available and 100 incoming.
- After receipt, while testing is pending: 110 on hand, consisting of 10 available and 100 in quarantine.
- After uploading the new lot’s passing test certificate: 110 available, assuming no reservations or other holds.

### 2. Receiving, quarantine, and automatic release

Use these clear stages:

**Incoming:** The shipment has not arrived. Its units cannot be sold or allocated.

**Quarantine:** The shipment has arrived and is awaiting testing results. Its units count as inventory on hand but cannot be sold or allocated.

**Awaiting certificate:** Testing has been recorded as passed, but the certificate has not been uploaded. Its units remain unavailable.

**Available:** The lot has been received, testing has passed, and its certificate is uploaded, with no other active hold.

Uploading a passing test certificate for a lot must automatically clear its testing quarantine and make its eligible received units available. Do not require a separate “Release from quarantine” action or manual status change.

Capture any necessary confirmation that the certificate represents passing results within the upload flow. An arbitrary attachment or failed test result must not release inventory.

Uploading a certificate before arrival must not make incoming units available. A passing certificate clears the testing restriction only; it must not override other active holds.

If a required certificate is removed, make the remaining stock unavailable and clearly flag affected unshipped allocations for resolution. Preserve completed shipment history and its associated certificate records.

Enforce these rules throughout the application, including checkout, allocation, fulfillment, and manual inventory edits.

### 3. Sell the first received lot first

Use first received, first sold (FIFO), based on actual receipt date and time.

Preserve the original receipt date when a lot leaves quarantine. Do not base FIFO on certificate upload, quarantine release, expected arrival, or record creation dates.

Only eligible inventory enters the sales queue. Skip incoming, quarantined, held, certificate-missing, and exhausted stock.

Automatically split orders across lots when needed. If an order requires 15 units and the older eligible lot has 10, allocate those 10 plus 5 from the next eligible lot.

Integrate reservations with the existing order lifecycle so concurrent orders cannot claim the same units.

### 4. One straightforward workspace

Create a product list showing:
- Product name, strength, and variant.
- Available and reserved quantities.
- Incoming quantities.
- Quantities in quarantine, awaiting certificates, or otherwise held.
- Product status.
- Clear actions to view, edit, or receive inventory.

Opening a product should show its lots, certificates, incoming shipments, and inventory history together.

Clearly identify which eligible lot is selling now and which comes next. Explain why unavailable lots cannot be sold.

Consolidate navigation so staff can complete a task without moving through disconnected pages. Keep appropriate underlying data relationships; a unified interface does not require one combined database table.

### 5. Easy product creation and receiving

Provide obvious actions:

**Add new product**
Create a product and optionally enter its first incoming shipment or received lot in the same guided flow.

**Receive inventory**
Choose an existing product, select an existing lot or add a new lot, enter quantity and receipt details, and optionally upload its certificate.

Newly received stock awaiting testing enters quarantine. If the exact lot already has passing results and its uploaded certificate, received units can become available once other eligibility conditions are satisfied.

Support incoming shipments, expected arrival dates, partial receipts, and outstanding quantities.

Prevent accidental duplicate products or lots. Additional receipts for an existing lot must preserve its identity and history. Repeated submissions must not add inventory twice.

### 6. Everything editable, with history

Allow staff to edit product names, strengths, variants, lot numbers, unit amounts, receiving details, expected quantities, statuses, certificates, and other existing product fields.

Provide clear inventory adjustments for:
- Count corrections.
- Damaged units.
- Samples.
- Returns.
- Other additions or deductions.

Record previous and updated values, adjustment reasons, timestamps, and the staff member making each change.

Use stable internal identifiers so renaming a product or correcting a lot number does not disconnect inventory, orders, or certificates.

Edits must maintain accurate inventory. If a change conflicts with reservations or active fulfillment, explain the issue and guide staff through resolving it. Status edits must not bypass testing or certificate requirements.

Allow archiving while preserving historical records.

### 7. Fulfillment and customer certificates

Command Center fulfillment must show the product, the lot or lots to pick, and the quantity required from each lot.

Record the actual lots shipped. If staff substitute a lot, provide an explicit action that updates allocations, verifies eligibility, and records the reason.

Customers must receive or access the certificate for each lot actually shipped. An order containing two lots must support both certificates with clear lot associations.

Never substitute another lot’s certificate or assume a product-level certificate covers all lots.

Handle cancellations, reservation releases, returns, and shipment completion without duplicate deductions or additions. Restore canceled allocations to their original lots. Returned units must be confirmed suitable for resale and satisfy all availability rules before becoming available.

### 8. Keep the interface simple

Use familiar labels, short forms, sensible defaults, and obvious next steps.

Receiving should feel like one task:

Choose product → enter lot and quantity → add receiving details and optional certificate → save.

After saving, clearly show what changed, the updated quantities, and any next action. For quarantined stock, explain that it is awaiting testing results. Make uploading its certificate easy to find.

### 9. Migration and verification

Preserve existing inventory quantities, relationships, and historical orders. Identify existing lots with missing testing or certificate information without inventing passing results. Flag affected open orders for resolution rather than silently canceling them.

Verify:
1. Incoming units remain unavailable.
2. Receiving 100 units awaiting testing adds 100 to quarantine and on-hand inventory, but not available inventory.
3. Uploading that lot’s passing certificate automatically releases its testing quarantine without another action.
4. Failed results or unrelated attachments do not release stock.
5. Other active holds remain effective after certificate upload.
6. FIFO uses original receipt dates and splits a 15-unit order into 10 older units plus 5 newer units when appropriate.
7. Partial receipts update quantities correctly.
8. Fulfillment tracks actual shipped lots and their matching certificates.
9. Edits preserve relationships and history.
10. Concurrent orders, cancellations, and repeated receipt submissions do not oversell or double-count.
11. Removing a required certificate prevents further sale or shipment and flags affected open allocations.
12. Existing historical orders and completed shipments remain intact.

Implement the complete workflow, including underlying inventory behavior. Explain the resulting experience, verification performed, and any remaining limitations.

## 3. Complete meeting notes for Riley

Source: **TrueMark complete meeting notes for Riley.pdf**, supplied by Mason. The 14 page sections below retain the extracted wording, headings, numbers, captions and remaining questions, with repeated page branding removed. Visual screenshots are references from that original document; this text file does not reproduce the image pixels. The supplied disclaimer text is a content request, not a statement that legal review has been completed. The remaining-input section on page 14 is retained in full.

### PDF page 1: Backend & system connections


**Confirm the backend works from start to finish**

Walk through customers, account creation, logins, tracking, and the connection between the backend and the
customer-facing website. Show how changes reach the front end. Review our latest backend updates, what is
already working, and what remains unfinished or disconnected.

**Where everything is saved**

Explain where everything is saved, including customer records, account information, orders, tracking, site
content, and agent information.

**How GitHub, Supabase, and the TrueMark brain connect**

Show me the complete system and data flow: what runs on the front end, what runs on the backend, what
Supabase stores or controls, what GitHub contains, and how a change moves from the code to the live site.
Explain how the TrueMark brain connects to the backend, database, and agents.

**Where I should make future changes**

Show me where I should make future changes, how GitHub and Supabase should be updated together, and
which changes can affect customer data, logins, orders, tracking, website content, or the AI brain.

**A safe process for adding features**

Give me a safe process for adding features: create a separate GitHub branch, preview and test the change,
review any Supabase database or permission changes, approve the update, deploy it, and verify the live result.

**Checks and balances**

Set up checks and balances so I do not accidentally break the live site or data. Cover backups, database
migrations, access permissions, automated checks, a staging or preview environment, deployment approval,
monitoring, and rollback.

**Written system handoff**

Leave me with a simple written map of the system, the accounts and access I need, the changes I can safely
make myself, and the changes Riley should review before they go live.

### PDF page 2: AI agents & integrations


**Customer agent**

Connect the customer agent to the TrueMark brain so it can learn and improve over time, use its capabilities to
help customers thoughtfully, and avoid repeating the same canned answers. Agree on how learning and
memory will work.

**Partner agent**

Make the partner agent useful and capable of taking action, beyond answering from fixed chatbot data. Review
the partner capabilities we already discussed and confirm they are connected.

**My personal agent and working demonstrations**

My personal agent already has a running version. Review its existing setup and connections. Demonstrate a
complete task for the customer and partner agents and confirm their data access and permissions.

**Software, analytics, and email flows**

Identify every software tool and account needed for backend connectivity. Connect Google Analytics and
confirm that tracking works. Review email flows and the email-flow agent we discussed. Identify the software,
triggers, and backend connections needed.

**Website URL and payment processor**

Confirm the website URL we need so we can move forward with a payment processor. Identify anything still
needed before we can apply or connect it.

**Questions to settle with Riley**

Which parts of the backend and integrations can we demonstrate working now, and which still need to be built
or connected? How will the customer agent learn through the TrueMark brain and give more thoughtful help?
Which previously discussed partner actions will it perform, and how does the existing personal agent connect?
What website URL and remaining setup are needed for payment processing? What exact settings should we
use for shipping statuses, large-order reviews, discounts, rewards, and profit calculations?

### PDF page 3: Operations & business tools


**ShipStation and the shipping desk**

Walk through the shipping workflow in depth and agree on the exact status names and triggers.

**01 Packed**

Print a label and mark the order “Packed.”

**02 Dropping off**

Use “Dropping off” for the stage before the carrier confirms shipment, instead of marking it “Shipped” too early.

**03 Shipped**

Automatically mark the order “Shipped” once UPS or FedEx scans the package and tracking confirms the
handoff.

**Mobile shipping desk**

Fix the mobile shipping desk view where content is cut off below the fulfillment queue.

**Command Center**

Orders and overview: remove the “Placed” state because the intended flow treats placed orders as paid.
Confirm the payment behavior before changing the status logic. Risk review: set up automatic review triggers
for large orders. Agree on the quantity thresholds. Lots and certificates: refine lot management and certificate
tracking views. Products and inventory: improve inventory synchronization and management. Combine inboxes
and allow messages to customer accounts directly from the dashboard.

**Research Blog**

Rename “Journal” to “Research Blog.” Make it possible to publish new posts so they appear automatically and
manually edit existing copy.

**Profit planner**

Add testing costs, affiliate costs, and discount percentage. Agree on how each affects the profit calculation.

### PDF page 4: Homepage & collection display


**Brand placement**

“Verified” was changed to “TRUEMARK.” Position “TRUEMARK”
slightly behind the vials, as in the original design, rather than above
them.

**Hero copy**

Retain “RESEARCH PEPTIDES” beneath “True precision.” Change
remaining “Research Compounds” wording to “Research Peptides.”

**Shop Peptides button**

“View catalog” was changed to “Shop Peptides.” Make the “Shop
Peptides” button reappear lower down after the “Organized by
compound class” section.

**Promotions**

Clean up the placement of the free-shipping offer and “10% off your
first order.” Use $200 for free shipping. The original screenshot still
shows the older $150 offer.

*Reference: Original homepage reference*


**Look Closer and compound classes**

Look Closer: skip step 01 and go straight to step 02 so the feature shows its function instead of only zooming in
on the vial. Compound classes: make the peptides clickable so they lead to the relevant categories. Add
continuous carousel scrolling in class order and automatic sliding.

**Desktop and mobile animation**

Fix the desktop compound-class animation. It moves up and down and currently needs an exact scroll position
to display and work properly. Add animation on mobile when scrolling down from the homepage. Review the
spotlight collection carousel: I like it on desktop, but it is not intuitive on mobile.

### PDF page 5: Promotion timing & About page


**First-order promotion**

Show this popup only after the visitor has scrolled down
a little. Agree on the point at which it should appear.

*Reference: First-order offer popup*


**Mobile About page**

Resolve the layout and function bugs on the About
page. The purity animation overlaps the text on mobile.

*Reference: Purity animation overlaps the copy*


### PDF page 6: Accounts, products & verification


**Research account application**

Discuss the research account application flow in depth and rethink how the overall process should work.

**First-visit guidelines and verification**

Review the first-visit research guidelines and verification flow, including how the guidelines open and how the
CAPTCHA works. Mimic the first-visit researcher verification screen shown on the following page.

**Application wording**

Change the account application action from “Apply” to “Create.”

**Vial options and discounts**

Show 1-vial, discounted 2-vial, and discounted 3-vial options. Confirm the discount amounts. Mimic the
quantity-pricing layout in the reference on page 10.

**Purity results for stacks**

For stacks, show all relevant purity results on the product page and the Verify page. Remove the limitation that
prevents all purity percentages from reaching the main site.

**GLP-1 names**

Change the GLP-1 names. Confirm the exact replacement names before making the edits.

**Verify page animation**

Revisit the Verify page animation. I preferred the original animation, but want it to fit the current visual style.

**Product-image positioning bug**

On the products page, clicking products appears to open the product image at the middle position for all
products except NAD and BPC157. Investigate this inconsistent behavior and compare those two exceptions
with the other products.

**Preserve the animation; check optimization**

I love the existing animation. It is slightly glitchy, so check performance and optimization to make it run
smoothly. Preserve its visual design and motion; do not replace or redesign it.

### PDF page 7: First-visit verification & disclaimer


**Researcher verification on first visit**

Mimic the first image’s researcher verification
screen when someone first enters the site, using
TrueMark branding and styling.

**Confirmation flow**

Include separate confirmations for age 21 or older
and qualified-researcher status for in vitro /
laboratory research only. Match the reference’s
entry button, disclaimer link, and exit option.
Enable entry after both confirmations.

**Add a disclaimer page**

Add a dedicated TrueMark disclaimer page using
the supplied Amino Club page as the reference for
the content and structure to copy and adapt.
Connect it to the first-visit verification screen.

**Amino Club disclaimer reference**

aminoclub.com/disclaimer/disclaimer

*Reference: First image: first-visit researcher verification*


### PDF page 8: Research-use entry screen


**Crush Research examples**

Use these examples alongside the Amino Club reference: a “Research use only” label, two explicit
confirmations, a confirmation count, an entry button, and an expandable disclaimer. Keep the TrueMark visual
style.

*Reference: IMG_1771: expanded disclaimer, beginning*


*Reference: IMG_1772: expanded disclaimer, continuation*


### PDF page 9: First-visit copy & behavior


**Research-use disclaimer copy**

Use the supplied Crush Research wording below with the brand changed to TrueMark. Keep the full text
available from the entry screen and on the dedicated disclaimer page.

**TrueMark copy**

All products sold by TrueMark are intended strictly for in-vitro laboratory research and educational purposes
only. They are not intended for human or animal consumption, medical use, therapeutic application, or any
diagnostic purpose.
By entering this site you confirm that you are at least 21 years of age and that any products purchased will be
used solely for legitimate research purposes. You agree not to misrepresent the intended use of any product
purchased from our site. See our Terms of Service for the complete terms.

**Confirmation labels**

“I am at least 21 years of age.” “I am a qualified researcher purchasing for in vitro or laboratory research only,
not for human or veterinary use.”

**Entry-screen behavior**

Show this verification on first view. Start with both confirmations unchecked and the entry button disabled.
Update the confirmation count as each box is checked. Enable “Enter TrueMark” only when both are selected.
Include a clear exit option for visitors who do not qualify.

**Disclaimer and Terms links**

Include a show/hide disclaimer control with readable full copy, as in the screenshots. Keep a link to the
dedicated disclaimer page and make “Terms of Service” a working link. Ensure the entry screen and expanded
text work on mobile and desktop.

**Details to settle with Riley**

Confirm how long the site remembers the visitor’s confirmation and when it should appear again. Fit this entry
screen into the existing research guidelines, CAPTCHA, and account-creation flow.

### PDF page 10: One-, two- & three-vial discounts


**Mimic the quantity-pricing layout**

Use the second image as the reference for clear,
selectable one-vial, two-vial, and three-vial
discount options on product pages.

**One vial**

Show the standard single-vial option and price.

**Two vials**

Show a discounted two-vial option with the
savings visible. Mimic the reference’s “Most
popular” emphasis.

**Three vials**

Show a discounted three-vial option with the
savings visible. Mimic the reference’s “Best value”
emphasis.

**Discount amounts**

The reference shows 3.6% off for two units and
5.3% off for three or more. Confirm the final
TrueMark percentages and whether the third tier
applies to three vials or three-plus.

*Reference: Second image: vial quantity and discount options*


### PDF page 11: Cart, checkout & rewards

**$75 — FREE BAC WATER · $200 — FREE SHIPPING**

**Revamp the cart box and popup**

Use the same add-to-cart popup on desktop as on mobile. Revamp the cart box and clean up the popup
animation on both mobile and desktop. Make it mimic the homepage slider.

**Clearer, slower add-to-cart animations**

Fix the mobile cart animations and slow down the add-to-cart animations on both mobile and desktop. Make the
movement, timing, and confirmation polished and consistent so customers can clearly see that the item was
added. Preserve the clear confirmation currently more apparent on desktop.

**Progress bar styling and animations**

Improve the cart progress bar using the end-to-end lot explanation as the visual reference. Revamp its
animations so progress moves smoothly toward free Bac Water at $75 and free shipping at $200.

**Consistent reward thresholds**

Apply $75 for free Bac Water and $200 for free shipping across the cart, homepage messaging, and checkout.
Replace older $150 free-shipping wording.

**Shipping insurance**

Add shipping insurance to the cart, enabled by default with an option for the customer to turn it off.

**Loyalty points**

Integrate the loyalty points system and agree on the earning and redemption rules.

### PDF page 12: Background & scroll behavior


**Refresh flicker and background jumps**

Fix the background changing or jumping from dark to light on initial refresh and while scrolling.

*Reference: Original background state*


*Reference: Original background after scrolling*


**Moving background light**

Make the background hue and light effect move smoothly during scrolling, as it does on desktop. It currently
jumps after scrolling stops.

**Compound-class transition**

Check the transition into the compound-class section alongside the desktop animation fix in the homepage
section.

### PDF page 13: Spacing, navigation & Windows


**Unexpected empty space**

Fix empty-space glitches across pages, including the Coenzymes & cofactors section.

*Reference: Original spacing gap above the lot traceability explanation*


**Returning to the homepage**

The homepage loads correctly on the first visit. After opening another page, returning home through the
navigation logo or the browser Back button produces a glitchy load. Reproduce and fix both return paths.

**HP Envy on Windows**

On my mom’s HP Envy, the site shows the desktop layout and navigation, but behaves as though it loaded the
mobile version: no animation on scroll, a carousel that is not continuous, and a glitchy background. Investigate
why these mobile-style issues appear in the desktop view. Confirm the browser, affected pages, and steps to
reproduce.

### PDF page 14: Review & handoff checks


**Backend and future updates**

Demonstrate the customer, login, order, tracking, and data-saving flows. Show how changes reach the front
end. Provide the system map, software/account list, GitHub and Supabase update process, and the checks,
backups, and rollback steps described on page 1.

**Agents and connected tools**

Demonstrate the customer and partner agents completing real tasks through the TrueMark brain. Explain
learning and memory, data access, and the existing personal agent connection. Confirm analytics, email flows,
the email agent, and the URL/payment-processing setup.

**Operations**

Walk through Packed, Dropping off, and carrier-confirmed Shipped states. Review the mobile shipping desk,
Command Center changes, customer messaging, Research Blog editing, and profit-planner inputs.

**Entry, products, and cart**

Check the first-visit confirmations, disabled/enabled entry button, expanded disclaimer, exit, and working
disclaimer/Terms links. Review the account and verification flows, vial tiers, purity results, and GLP-1 names.
Confirm cart animations, shipping insurance, loyalty points, free Bac Water at $75, and free shipping at $200.

**Visual issues and reference photos**

Compare each fix with its attached reference. Check homepage placement and copy, collection behavior,
promotion timing, About-page overlap, background motion, spacing, and both homepage return paths.
Reproduce the HP Envy issue and review mobile and desktop behavior.

**Remaining inputs**

Settle partner-agent actions already discussed, learning/memory behavior, large-order review quantities, vial
discount percentages and the three-plus rule, loyalty earning/redemption, profit calculations, GLP-1
replacement names, popup timing, the Verify animation reference, and entry-confirmation duration. Identify the
browser and pages affected on the HP Envy.

## 4. What has already been done, and what has not

This is an implementation checkpoint, separate from the requests above. A local preview or passing test is not proof of a live provider connection or deployment.

### Implemented in this workspace

**Product and lot inventory — local commit `31a8eaf09fceea37d7efe5c0c06babf44b2c93b1`.** Built a unified Products & inventory workspace with product creation, multiple lots, incoming supply, partial receipts, editable counts and details, testing/certificate eligibility, automatic testing release, FIFO reservations, split-lot picking, explicit substitution, inspected returns and history. Product availability is derived from eligible lot stock. Shipped lot labels and certificate versions are preserved; removing a current certificate blocks affected unshipped allocations without rewriting completed shipments. Duplicate receipts, stale/conflicting edits and inappropriate stock restoration are guarded.

**Customer retention — local commit `7b137fdfe5cce694e264ecfb79debc5c5a5153cb`.** Built product/customer filters, customer groups, observed purchase gaps without a fixed reorder interval, 6/12/24-month comparisons, customer/order/product history, editable notes and contact/reply logs, reminders, unsent drafts, exports and owner-controlled staff access. History distinguishes unknown dates, incomplete months, refunds, simulated messages and actual contacts. Only authenticated live customer chat is associated with a customer; anonymous, preview, owner/partner-internal and tool messages are excluded. Drafts never queue delivery.

**Handoff documentation.** The earlier consolidated inventory/retention handoff was committed locally as `790a87b`; the unchanged 14-page PDF and links were added locally as `c37e4cd`. This single file consolidates the notes for the specifically requested `mason/notes` branch. Those local implementation IDs identify the source work; publication of this notes file does not mean the feature commits were merged into main or deployed.

### Existing and separately reported work

**Shipping foundation already in the delivered source.** The recorded local shipping correction separates label creation from shipment, keeps orders in Shipping Desk, separates ready-to-pack and packed queues, and removes the cold-pack confirmation requirement. It does not establish a real carrier-scan connection. The PDF's exact “Dropping off” state and carrier-confirmed transition still require review against the actual implementation and provider behavior.

**Rewards, memberships and marketing foundations.** Existing project documentation describes shared program/consent records and simulated marketing delivery. Do not rebuild these blindly. Mason's final earning/redemption rules, quantity discounts and live provider acceptance are still inputs or integration work. A simulated outbox is not a real email system.

**Other workspace's UI update.** On 18 October, shared `main` was observed at `117997da5e5868a8a97c4940a99d96c2b1ae9a81`, “Polish Website, Partners and Command Center interactions.” Its continuation notes report search improvements, mobile menu/search/cart gesture fixes, focus/notification changes, partner feedback/recovery improvements and homepage loading work. Those notes report Chrome/WebKit and local regression checks. This is another workspace's recorded evidence, not a new acceptance test performed here. Compare it with the PDF's issues before repeating or overwriting fixes; it is separate from the local inventory/retention branch. No hosted deployment identity was verified in preparing this file.

### Verification recorded for this workspace's features

- Inventory: four new inventory/customer tests, 59 existing adapter/shipping/message regressions, and local SQL coverage of receipts, certificates, holds, FIFO split allocation, conflicts, cancellation, substitutions, returns, roles and populated legacy migration preservation.
- Retention: seven new model/adapter tests, 23 existing business-intelligence tests, and local SQL checks for permissions, grants/revocation/demotion, duplicate/stale writes, history preservation, reminders, draft non-delivery, purchase/refund/consent/contact capture and customer-only chat.
- Portable checks: TypeScript; preview/live/launch builds; 29 release/security/routing checks; all local SQL validators, increasing from eight to nine when retention was added; five function bundles; browser artifact audit.
- Browser checks: desktop and 390 px layouts; partial receiving and automatic certificate release; product-specific versus latest-anything purchase dates; monthly customer drill-down; empty searches; reminder completion; unsent draft and contact persistence; edit history; Escape/focus return.
- Test records and quantities were synthetic. Local SQL used PGlite with auth/storage stubs; this does not establish native PostgreSQL simultaneous-transaction behavior or hosted Realtime. Multi-session behavior, real provider flows and production-volume performance still need connected acceptance.

### Work still required before shared live operation

1. Verify the actual checkout, remote/deployed state and usable owner access. Retain Supabase project **`gydihnfzmuqmbnykaihg`**. Reported GitHub/Supabase invitation acceptance does not establish the separate TrueMark application-owner role; do not ask for invitations again.
2. Inspect migration history and recoverable backups. Reconcile real lot counts, receipt dates and missing certificate/testing evidence with staff. Never reset hosted data or invent the split of a product total across lots.
3. Apply outstanding prerequisites and the matching inventory migration **`20261017000000_lot_inventory.sql`** and retention migration **`20261017000100_retention.sql`** through an authorized rollout. Deploy the matching frontend and inventory-affected shipping/messages functions together.
4. Check owner, permitted/denied staff and customer behavior in connected sessions, including simultaneous allocation, certificate removal, actual shipped certificates, stale edits and cross-session retention updates.
5. Real shared retention collection starts only after its migration is active. The chart's ability to display six or 24 months does not mean that history already exists. Keep collecting relevant evidence over time.
6. Resume provider selection and sending only when Mason returns to that decision. Do not infer permission to send messages, charge payments, purchase labels, activate services or change production records from this notes file.

The attached meeting requests about agents/brain connections, analytics, payment readiness, unified messaging, Research Blog, profit inputs, entry verification, storefront copy, quantity pricing, insurance, final rewards rules and the remaining visual/browser issues are **not marked completed by this handoff**. Review the current source and demonstrate each result before changing its status.

## 5. Remaining decisions to resolve with Mason, one at a time

These are the outstanding inputs from the meeting notes and implementation boundaries, not a request to ask every question in one session:

- The exact shipping status names and actual carrier scan that proves shipment; how the physical handoff and label synchronization work.
- Payment behavior before removing “Placed”; large-order quantity/review thresholds.
- Which customer/partner-agent actions are intended, how learning/memory will work, the existing personal agent's connections and the access limits for each agent.
- Software/account ownership, analytics verification, final website URL/payment requirements and business sending identities. Email-provider selection remains deferred.
- Costs included in profit: testing, affiliate costs, discounts and other actual versus assumed expenses; how overlapping discounts/commissions are handled.
- The account-creation/researcher-verification process, CAPTCHA interaction, how long first-visit confirmation is remembered and when it appears again.
- Final two- and three-vial discount percentages, whether the third tier means three or three-plus, and how the tiers combine with rewards/promotions. Reference percentages are not final approved pricing.
- Exact replacement GLP-1 names; all purity results for stacks; the preferred original Verify animation reference.
- First-order-popup timing after scrolling; keep the requested $75 free Bac Water and $200 free-shipping thresholds consistent across the intended surfaces.
- Shipping-insurance product, price and checkout treatment for the requested default-on/opt-out behavior; final loyalty earning/redemption rules.
- Browser, affected pages and repeatable steps on the reported HP Envy Windows device; physical-device checks versus simulator results.

Preserve approved TrueMark artwork and the animation Mason wants retained. Reproduce bugs before replacing behavior. Keep manual employee workflows usable; barcode scanning and a full accounting replacement are outside the current dependency chain.

## 6. How to use this handoff

Start with Mason's current priority and the recorded completed work above. Review the relevant PDF-page requests and demonstrate the current behavior before implementing a change. Use a separate branch, preserve unrelated work, preview and test, review database/permission changes, and verify the deployed result after an authorized release. Record evidence and unresolved limits rather than calling a request complete because an adapter, demo or screen exists.

This file is the notes-only deliverable requested for **`mason/notes`**, not **`main`**. Publishing it does not merge or deploy application changes.
