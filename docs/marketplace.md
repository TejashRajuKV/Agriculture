# Marketplace

One marketplace, two kinds of listing.

## Fresh produce (fixed price)
- **Sellers:** farmers and FPOs. Fields: crop, title, quantity and unit, price per unit, minimum order, harvest date (at most 90 days ahead), quality grade, location and optional photo.
- **Price guidance:** the listing form shows the AGMARKNET mandi average for the crop as a reference only.
- **Buyers** (restaurant, retailer, processor, institution, wholesaler, individual) search, filter (crop, quality, seller type) and sort (price, harvest, quantity), then order a quantity at or above the minimum.
- **Inventory:** each order decrements stock atomically. Parallel orders can never oversell. At 0 the listing becomes `SOLD_OUT`, and cancelling an order puts the stock back.
- **Order flow:**

| Step | Next status | Who moves it |
|---|---|---|
| Placed | `PENDING` | buyer places the order |
| Confirm | `CONFIRMED` | seller |
| Pack | `PROCESSING` | seller |
| Ready | `READY_FOR_PICKUP` | seller |
| Collected | `PICKED_UP` | seller |
| Out for delivery | `IN_TRANSIT` | seller |
| Received | `DELIVERED` | buyer confirms receipt |

  The buyer may cancel while the order is `PENDING` or `CONFIRMED`. Payment is taken on delivery, and the wallets move when the order is delivered.

## Crop residue (bidding)
- The farmer scans residue with the on-device model, corrects the type or moisture if needed, enters tonnes, and lists the lot.
- Buyers bid with a price per tonne and a pickup date. Each buyer has one bid per lot, which they can edit or withdraw. Buyers never see other buyers' bids.
- The farmer accepts one bid, which declines the rest and reserves the lot.
- After pickup, the seller or the winning buyer marks the sale complete. The buyer's wallet pays the seller, and the seller earns carbon points (1 point per 10 kg of CO₂ not burned).
