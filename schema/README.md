# Pricing rule schema

`pricing-rule.schema.json` is a JSON Schema (draft 2020-12) for one owner's service and the rules that price it. It describes the same shapes Workely's quote engine computes with, so a rule written here means the same thing in the product.

The three files in `../examples/` validate against it. Their numbers are illustrative examples, not recommended prices and not taken from any business.

## What the engine does

Per line item: start from the service base price (flat services use their price, per-unit services start at 0), apply matching rules lowest `priority` first, clamp up to the job minimum from `set_minimum`, then multiply by quantity. All money is integer cents, the same inputs always give the same quote, and the language model only extracts inputs such as square footage; it never does the math.

## Rule effects

| effect | what it does | needs |
|---|---|---|
| multiplier | price times factor | `factor` |
| flat_add | price plus a fixed amount | `amount_cents` |
| per_unit | price plus amount times the input named by `input_key` | `amount_cents`, `input_key` |
| override | price becomes the amount | `amount_cents` |
| set_minimum | the job floor becomes the amount | `amount_cents` |

A `condition` gates a rule on its input: `{ "op": "gte" | "gt" | "lte" | "lt" | "eq", "value": number }`, `{ "equals": string | number | boolean }`, an empty object, or null (always applies).

## Source in the Workely app (apps/web)

- `src/lib/engine/pricing/calculator.ts`: `RuleEffect`, `RuleCondition`, `PricingRule`, `ServiceBase` and `computeQuote`.
- `src/lib/engine/pricing/service-base.ts`: how database rows (`org_services`, `pricing_rules`) become calculator inputs, including `price_unit`, `settings.min_cents`, `settings.taxable` and the default priority of 100.
- `src/lib/engine/onboarding/templates.ts`: the `flat` and `per_sqft` units used when an owner sets up services.

Deliberate differences from the database rows: this schema is a portable document, so `service_id` is replaced by `applies_to` (a rule with no service_id applies to every service), and field names are snake_case as in the database.
