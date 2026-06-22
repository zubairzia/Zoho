# Resolution Voting Engine

## What this does
Aggregates shareholder votes per resolution using weighted shares.

## Logic
- Filters invalid votes
- Groups by resolution
- Calculates:
  - Approve shares
  - Reject shares
  - Abstain shares
  - Represented shares
- Outputs final summary per resolution

## Key concept
Raw → Filter → Group → Aggregate → Output
