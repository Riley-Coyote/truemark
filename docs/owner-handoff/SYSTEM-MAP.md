# TrueMark on one page

For Mason. What the system is, the accounts behind it, what you can change yourself, and what should be reviewed
before it goes live. Your Codex has the technical detail in [START_HERE.md](START_HERE.md).

## What it is

One platform, four doors:

- **Website.** Shop, product pages, Verify a lot, research accounts, cart and checkout, the journal and the chat assistant.
- **Command Center** (`/admin`). Where you run the business: orders, shipping desk, products and stock, customers,
  partners, discount codes, messages, reports and settings.
- **Partner portal** (`/partners`). Partners see their code, referrals and commissions.
- **Studio.** The design presentation. It runs on sample data and is not the shop.

How an order moves: a researcher creates an account → you approve it → they order and pay → the oldest batch that
passed testing is set aside for it → you pack it and print the label in ShipStation → shipped → delivered → the certificate
appears in their order history, and any partner on the order earns commission.

Stock lives on batches (lots). A batch can't be sold until it has been received, its certificate is uploaded and its
results pass. Saving a passing certificate releases it automatically.

## The accounts behind it

| Service | What it does | Who should own it | Today |
| --- | --- | --- | --- |
| GitHub, `Riley-Coyote/truemark` | The code, and the site's current hosting | You, after the repository transfer | You're a collaborator; transfer comes later |
| Supabase, project `gydihnfzmuqmbnykaihg` | Database, sign-ins, certificate files, server functions | You | You're an Owner |
| Hosting and domain (`truemarkbiolabs.com`) | Where the real site lives | You | Not set up yet |
| Payment processor | Takes card payments | You (merchant account) | Not chosen; checkout runs on a simulator |
| Email sender | Sign-up confirmations and order emails | You | Not set up; the demo only acts out the email step |
| ShipStation | Labels, tracking, printer | You | Not connected; the demo simulates it |
| OpenRouter | Powers the chat assistant | You (billing) | Connected; billing owner still to confirm |
| Codex | Your developer assistant | You | Your own account |

Passwords and secret keys never go in the code, in a document or in a chat. Each one goes into that service's own
settings. The full checklist is in [ACCESS.md](ACCESS.md).

## Changes you can make yourself

All in Command Center, no code needed:

- **Products:** names, prices, descriptions, photos, and showing or hiding a product.
- **Stock:** receiving a batch, uploading its certificate, holding or rejecting a batch.
- **Orders:** marking paid, packing, shipping, refunding.
- **People:** approving or declining accounts, partners, staff invitations.
- **Selling:** discount codes, loyalty points, journal articles.
- **Settings:** the free shipping and free BAC Water amounts, shipping insurance, tax, and the assistant's model.

## Have these reviewed before they go live

By a developer:

- Any change to the code, to the database's structure, or to who can see what.
- Connecting or changing payments, email, shipping or the domain.
- Anything that deletes records or edits many at once.
- Secret keys and server settings.
- Publishing a new version of the site. Take a backup first; [BACKUPS-AND-UNDO.md](BACKUPS-AND-UNDO.md) has the
  steps, and how to go back if a release goes wrong.
