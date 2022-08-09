const fs = require('fs');

let FILE_JSON = {}; // stores JSON from proof.json file
let TVL = {}; // stores data from TVL row
let MASTER_DATA = {}; // creates juno1addr: token list
let DECIMALS = Math.pow(10, 6); // to convert tokens to full neta
let DECIMALS_MULTIPLIER = Math.pow(10, 10); // BIG INT multiplier and divider per...somewhere on stackoverflow NOTE YOU CAN INCREASE THE PRECISION ON THIS BUT IT WILL BRING THE TOTAL COUNT OVER MAX TOTAL SUPPLY
let BIGDECIMALS = 10000000000n; // see top

let total_tokens = 0; // for logging
let ADDRESSES_TO_EXCLUDE = [
  "juno1e8n6ch7msks487ecznyeagmzd5ml2pq9tgedqt2u63vra0q0r9mqrjy6ys", // JS neta/juno pool
  "juno12sulrvp220gpsp8jsr7dpk9sdydhe8plasltftc6fnxl7yukh24qjvqcu9", // JS bonded LPs
  "juno1v4887y83d6g28puzvt8cl0f3cdhd3y6y9mpysnsp3k8krdm7l6jqgm0rkn", // osmosis bridge
  "juno1yn7z42al3mafmztjayjduz42a8at3whyd279fkdsyumzar83x8mq6e3v3y", // osmo1yn7z42al3mafmztjayjduz42a8at3whyd279fkdsyumzar83x8mqvpw83x osmosis LP module
  "juno1njty28rqtpw6n59sjj4esw76enp4mg6gq37gxk", // osmo1njty28rqtpw6n59sjj4esw76enp4mg6g7cwrhc osmosis bonded LP
];

let SUMMARY = {
  total_tokens_for_juno_holders: 0,
  total_tokens_for_juno_lpers: 0,
  total_tokens_for_juno_bonded_lper: 0,
  total_tokens_for_osmo_holders: 0,
  total_tokens_for_osmo_lpers: 0,
  junoswap_lp_shares: 0n,
  onosmo_lper_shares: 0n,
  junoswap_lp_shares_lp: 0n,
  junoswap_lp_shares_bonded: 0n,
  junoswap_lp_shares_unbonding: 0n,
};

let AIRDROP_FILENAME = "data/airdrop.json";
let PROOF_FILENAME = "data/proof.json";

function main() {
  openFile(PROOF_FILENAME);

  // set tvl via object and remove
  TVL = Object.assign({}, FILE_JSON["tvl"]);
  delete FILE_JSON["tvl"];

  Object.keys(FILE_JSON).map((key) => {
    let data = FILE_JSON[key];
    let user_total_tokens = 0; // use var to store total amount of tokens per juno addr

    /// calculate JUNO holder
    if (data["onjuno_holder"] != null && data["onjuno_holder"] != undefined && data["onjuno_holder"] > 0) {
      user_total_tokens += customParseFloat(data["onjuno_holder"]);
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.total_tokens_for_juno_holders += customParseFloat(data["onjuno_holder"]);
      }
    }

    /// next section calculates JS lper + JS bonded + JS unbonding amounts
    let junoswap_lp_shares = 0n;

    // JS base lper
    if (data["onjuno_lper"] != null && data["onjuno_lper"] != undefined && data["onjuno_lper"] > 0) {
      junoswap_lp_shares += BigInt(data["onjuno_lper"]);
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.junoswap_lp_shares_lp += BigInt(data["onjuno_lper"]);
      }
    }

    // JS bonded
    if (data["onjuno_bonded"] != null && data["onjuno_bonded"] != undefined && data["onjuno_bonded"] > 0) {
      junoswap_lp_shares += BigInt(data["onjuno_bonded"]);
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.junoswap_lp_shares_bonded += BigInt(data["onjuno_bonded"]);
      }
    }

    // JS unbonding
    if (data["onjuno_unbonding"] != null && data["onjuno_unbonding"] != undefined && data["onjuno_unbonding"] > 0) {
      junoswap_lp_shares += BigInt(data["onjuno_unbonding"]);
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.junoswap_lp_shares_unbonding += BigInt(data["onjuno_unbonding"]);
      }
    }

    // total bonding shares -> calculate user's share
    if (junoswap_lp_shares > 0n) {
      let user_lp_share = Number(((junoswap_lp_shares*BIGDECIMALS) / BigInt(TVL.junoswap_lp_shares)))/DECIMALS_MULTIPLIER;
      let asset_val = user_lp_share * TVL.junoswap_tokens;
      user_total_tokens += customParseFloat(asset_val);

      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.total_tokens_for_juno_lpers += customParseFloat(asset_val);
        SUMMARY.junoswap_lp_shares += junoswap_lp_shares;
      }
    }

    /// calculate OSMO holder
    if (data["onosmo_holder"] != null && data["onosmo_holder"] > 0) {
      user_total_tokens += customParseFloat(data["onosmo_holder"]);
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.total_tokens_for_osmo_holders += customParseFloat(data["onosmo_holder"]);
      }
    }

    /// calculate OSMO LPer
    if (data["onosmo_lper"] != null && data["onosmo_lper"] != undefined && data["onosmo_lper"].length > 0) {
      let user_lp_share = Number(((BigInt(data["onosmo_lper"])*BIGDECIMALS) / BigInt(TVL.osmosis_lp_shares)))/DECIMALS_MULTIPLIER;
      let asset_val = user_lp_share * TVL.osmosis_tokens;
      user_total_tokens += customParseFloat(asset_val);

      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.total_tokens_for_osmo_lpers += customParseFloat(asset_val);
        SUMMARY.onosmo_lper_shares += BigInt(data["onosmo_lper"])
      }
    }

    if (user_total_tokens > 0) {
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        MASTER_DATA[key] = parseFloat(user_total_tokens);
        total_tokens += parseFloat(user_total_tokens);
      }
    }
  });

  console.log(`Total Tokens: ${total_tokens}`);
  console.log("TVL:");
  console.log(TVL);
  console.log("SUMMARY:");
  console.log(SUMMARY);

  fs.writeFile(AIRDROP_FILENAME, JSON.stringify(MASTER_DATA), 'utf8', () => {});
}

function customParseFloat(amt) {
  return parseFloat(Number(amt / DECIMALS).toFixed(6));
}

function openFile(filePath) {
  FILE_JSON = null;

  let fileData = fs.readFileSync(filePath);
  FILE_JSON = Object.assign({}, JSON.parse(fileData));
  fileData = null;
}

main();
