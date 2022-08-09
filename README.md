# Overview

## LEG WORK
You'll need to execute a few queries to generate some files and populate data for the following objects:
- generate_proof_file.js

```
let MASTER_DATA = {
  tvl: {
    junoswap_lp_shares: 0, // this is retrieved in the lpers.json file under "total_supply"
    junoswap_tokens: 3438192663, // see junod q wasm contract-state all juno1e8n6ch7msks487ecznyeagmzd5ml2pq9tgedqt2u63vra0q0r9mqrjy6ys --height xx --limit 50000 -o json
    osmosis_lp_shares: "972461319594096904362423", // retrieved from osmosisd q gamm total-share 631 --height xx
    osmosis_tokens: 2299736349, // osmosisd q gamm pool 631 --height xx
  }
};
```

```

# holders
junod q wasm contract-state all juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr --height xx --limit 50000 -o json >> data/holders.json

# LPers
junod q wasm contract-state all juno1jmechmr7w6kwqu8jcy5973rtllxgttyetarys60rtsu0g675mkjsy96t8l --height xx --limit 50000 -o json >> data/lpers.json

# bonded LPers
junod q wasm contract-state all juno12sulrvp220gpsp8jsr7dpk9sdydhe8plasltftc6fnxl7yukh24qjvqcu9 --height xx --limit 50000 -o json >> data/bonded.json

# MISC queries
osmosisd q gamm total-share 631 --height xx
osmosisd q gamm pool 631 --height xx
junod q wasm contract-state all juno1e8n6ch7msks487ecznyeagmzd5ml2pq9tgedqt2u63vra0q0r9mqrjy6ys --height xx --limit 50000 -o json

```

## NOTES while building
```
  generate_proof_file.js

  bonded lp tags:
  staked_balancesjuno10t89wdy6n9gt4ujc4rdq9qnehj9xpj9c8wch2m
  claimsjuno13ml8ncuzcecwq5mxpk2n3lef8pckr588wnws6r

  lp tags:
  balancejuno109jutq7jyxqycls4fpn9shp9ep8370vyhgc92t
  ["token_info"]["total_supply"] which encapculates both bonded and lp tags

  holder tags:
  balancejuno109jutq7jyxqycls4fpn9shp9ep8370vyhgc92t

  osmosis
  { ..., "bank": {"balances": []}, ...}
  //ibc/297C64CC42B5A8D8F82FE2EBE208A6FE8F94B86037FA28C4529A23701C228F7A
  "coins":[{"amount":"000000","denom":"ibc/297C64CC42B5A8D8F82FE2EBE208A6FE8F94B86037FA28C4529A23701C228F7A"}, {"amount", "denom": "gamm/pool/631"}]
  
  for our case, osmosis gov removed incentives for osmo/neta pool 631 and some users have no claimed, so we need to add these balances to their LP balance
  { ... "lockup": {"locks": [{ "owner": "ADDRESS", "coins": [{ "denom": "DENOM", "amount": "AMOUNT" }] }]}, ...}
```

```
  generate_airdrop_list.js

  /*
  KEYS
  onjuno_holder
  onjuno_lper
  onjuno_bonded
  onosmo_holder
  onosmo_lper

  TVL: {
    "junoswap_lp_shares":160384275098,
    "junoswap_tokens":3438192663,
    "osmosis_lp_shares":"972461319594096904362423",
    "osmosis_tokens":2299736349
  }

  LP calcs:
  osmosis - (user's gamms / total gamm for pool (631) ) * (TOTAL TOKENS IN POOL)
  junoswap - ((user's share of wslpt + user's bonded tokens) / total tokens) * (TOTAL TOKENS IN POOL)
  */
```

## Steps to run

1. download the osmosis snapshot
2. grab the 3 needed files (juno contract snapshot - holders.json, junoswap lp contract snapshot - lpers.json, and junoswap lp bonded snapshot - bonded.json)
3. populate this object
```
let MASTER_DATA = {
  tvl: {
    junoswap_lp_shares: 0, // this is retrieved in the lpers.json file under "total_supply"
    junoswap_tokens: 3438192663, // see junod q wasm contract-state all juno1e8n6ch7msks487ecznyeagmzd5ml2pq9tgedqt2u63vra0q0r9mqrjy6ys --height xx --limit 50000 -o json
    osmosis_lp_shares: "972461319594096904362423", // retrieved from osmosisd q gamm total-share 631 --height xx
    osmosis_tokens: 2299736349, // osmosisd q gamm pool 631 --height xx
  }
};
```
4. execute generate_proof_file.js
- You may need to run it with 
```

node --max-old-space-size=8192 generate_proof_file.js

```
5. execute generate_airdrop_list.js
