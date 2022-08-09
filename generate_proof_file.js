const fs = require('fs');
const JSONStream = require("JSONStream");
const es = require('event-stream');
const { bech32 } = require("bech32");

/// execute using node --max-old-space-size=8192 generate_proof_file.js if you get the error

let MASTER_DATA = {
  tvl: { // start with this and return for next script to use
    junoswap_lp_shares: 0, // this is retrieved in the lpers.json file under "total_supply"
    junoswap_tokens: 3438192663, // see junod q wasm contract-state all juno1e8n6ch7msks487ecznyeagmzd5ml2pq9tgedqt2u63vra0q0r9mqrjy6ys --height xx --limit 50000 -o json
    osmosis_lp_shares: "972461319594096904362423", // retrieved from osmosisd q gamm total-share 631 --height xx
    osmosis_tokens: 2299736349, // osmosisd q gamm pool 631 --height xx
  }
};

let FILE_JSON = {};
let OSMOSIS_DENOMS = ["ibc/297C64CC42B5A8D8F82FE2EBE208A6FE8F94B86037FA28C4529A23701C228F7A", "gamm/pool/631"];

let FILE_PATHS = {
  holders: "data/holders.json",
  lpers: "data/lpers.json",
  bonded: "data/bonded.json",
  osmosis: "osmosis"
};
let OSMOSIS_SNAPSHOT_FILENAME = "data/osmosis-export-5445450/export5445450.json";
let PROOF_FILENAME = "data/proof.json";

let JS_LP_TOKEN_TOTAL = 0;

function main() {
  // processes holders.json file to grab all holders in the cw20 contract
  processHolders();

  // processes normal junoswap LP's that do not have bonded tokens for RAW rewards
  processLpers();

  // process junoswap LP's that are bonded for incentivized LPs
  processBonded();

  // 2 processes here - checks the banks module balances for all accounts having the ibc/denom and gamm/pool tokens (LP)
  // also checks lockup locks for bonded LP for incentivized pools. note osmosis no longer has incentivized pools for neta and some people just never "claimed" to release those tokens
  // the processOsmosisLocks function will save the resultset update MASTER_DATA.tvl.junoswap_lp_shares = JS_LP_TOKEN_TOTAL;
  processOsmosis();
}

function processHolders() {
  openFile(FILE_PATHS.holders);
  let parseLogic = { balance: "onjuno_holder" };
  parseFile(parseLogic);
}

function processLpers() {
  openFile(FILE_PATHS.lpers);
  let parseLogic = { balance: "onjuno_lper" };
  parseFile(parseLogic, true);
}

function processBonded() {
  openFile(FILE_PATHS.bonded);
  let parseLogic = {
    staked_balances: "onjuno_bonded",
    claims: "onjuno_unbonding",
  };
  parseFile(parseLogic);
}

function processOsmosis() {
  // open the big boy
  const getStream = () => {
    const jsonData = OSMOSIS_SNAPSHOT_FILENAME;
    const stream = fs.createReadStream(jsonData, { encoding: "utf8" });
    const parser = JSONStream.parse("*");
    return stream.pipe(parser);
  };

  // process osmo bank balances and process lockups
  getStream()
  .pipe(es.mapSync(function (data) {
    if (data != null && Object.keys(data).length > 0 && data["bank"] != null) {
      processOsmosisBalances(data["bank"]["balances"]);
      processOsmosisLocks(data["lockup"]["locks"]);
    }
  }));
}

function processOsmosisBalances(balances) {
  if (balances != null && balances.length > 0) {
    balances.map((balance) => {
      // create juno addr
      let b32 = bech32.decode(balance.address);
      const newPrefix = b32.prefix.replace("osmo", "juno");
      const junoAddr = bech32.encode(newPrefix, b32.words);

      balance.coins.map((coin) => {
        if (OSMOSIS_DENOMS.includes(coin.denom)) {
          let dataValue = {};
          if (MASTER_DATA[junoAddr] != null) {
            dataValue = Object.assign({}, MASTER_DATA[junoAddr]);
          }

          // if ibc denom, then add as holder amt else add to lper amt
          if (coin.denom == "ibc/297C64CC42B5A8D8F82FE2EBE208A6FE8F94B86037FA28C4529A23701C228F7A") {
            amt = parseInt(coin.amount);
            dataValue["onosmo_holder"] = amt;
          } else if (coin.denom == "gamm/pool/631") {
            // check if lper amt exist, then add to it, else init
            if (dataValue["onosmo_lper"] != null && dataValue["onosmo_lper"] != undefined) {
              dataValue["onosmo_lper"] = (BigInt(dataValue["onosmo_lper"]) + BigInt(coin.amount)).toString();
            } else {
              dataValue["onosmo_lper"] = coin.amount;
            }
          }

          dataValue.osmosis_addr = balance.address;
          MASTER_DATA[junoAddr] = dataValue;
        }
      });
    });
  }
}

function processOsmosisLocks(locks) {
  if (locks != null && locks.length > 0) {
    locks.map((lock) => {
      // create juno addr
      let b32 = bech32.decode(lock.owner);
      const newPrefix = b32.prefix.replace("osmo", "juno");
      const junoAddr = bech32.encode(newPrefix, b32.words);

      lock.coins.map((coin) => {
        if (OSMOSIS_DENOMS.includes(coin.denom)) {
          let dataValue = {};
          if (MASTER_DATA[junoAddr] != null) {
            dataValue = Object.assign({}, MASTER_DATA[junoAddr]);
          }

          if (coin.denom == "gamm/pool/631") {
            // check if lper amt exist, then add to it, else init
            if (dataValue["onosmo_lper"] != null && dataValue["onosmo_lper"] != undefined) {
              dataValue["onosmo_lper"] = (BigInt(dataValue["onosmo_lper"]) + BigInt(coin.amount)).toString();
            } else {
              dataValue["onosmo_lper"] = coin.amount;
            }
          }

          dataValue.osmosis_addr = lock.owner;
          MASTER_DATA[junoAddr] = dataValue;
        }
      });
    });

    MASTER_DATA.tvl.junoswap_lp_shares = JS_LP_TOKEN_TOTAL;
    fs.writeFile(PROOF_FILENAME, JSON.stringify(MASTER_DATA), 'utf8', () => {});
  }
}

function openFile(filePath) {
  FILE_JSON = null;

  let fileData = fs.readFileSync(filePath);
  FILE_JSON = Object.assign({}, JSON.parse(fileData));
  fileData = null;
}

/*
  check if key exists for the model, then strip some junk and use that key
  if object is an array, then we need to go find an "amount"
*/

function parseFile(parseLogic, checkLPTokenBalance) {
  let keys = Object.keys(parseLogic)
  if (FILE_JSON["models"] != null && FILE_JSON["models"].length > 0) {
    for (let i = 0; i < FILE_JSON["models"].length; i++) {
      let data = FILE_JSON["models"][i];
      let amount = 0; // store tokens/lp shares in this var

      let convertedKey = Buffer.from(data.key, 'hex').toString('ascii');
      let convertedValue = Buffer.from(data.value, "base64").toString('ascii');

      convertedKey = convertedKey.replace(/[^\x20-\x7E]/g, '');
      convertedValue = convertedValue.replace(/[^\x20-\x7E]/g, '');
      convertedValue = JSON.parse(convertedValue);

      keys.map((key) => {
        let dataValue = {};
        // only perform this on keys in parseLogic
        if (convertedKey.startsWith(key)) {

          // if this may be an array, so we'll go get the coin amounts
          if (typeof convertedValue == "object") {
            let val = 0;
            for (let j = 0; j < convertedValue.length; j++) {
              let amt = convertedValue[j]["amount"];
              // strip the \" from b64 conversion
              amt = amt.replace(/\"/g, '');
              // parseInt and use uneta value until final

              val += parseInt(amt)
            }

            amount += val;
          } else {
            // parseInt and use uneta/lpshare value until final
            amount = parseInt(convertedValue);
          }

          // parseInt and use uneta/lpshare value until final
          amount = parseInt(amount)

          // key has prefix of "balancejuno1..." or similar so we strip
          convertedKey = convertedKey.replace(key, "");

          if (MASTER_DATA[convertedKey] != null) {
            dataValue = Object.assign({}, MASTER_DATA[convertedKey]);
          }

          dataValue[parseLogic[key]] = amount;

          MASTER_DATA[convertedKey] = dataValue;
        }
      });

      // one off, grab token info and store in master value
      if (checkLPTokenBalance && convertedKey == "token_info") {
        let total_supply = convertedValue['total_supply'];
        JS_LP_TOKEN_TOTAL += parseInt(total_supply);
      }
    }
  }
}

main();
