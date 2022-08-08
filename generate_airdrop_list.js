const fs = require('fs');

// node --max-old-space-size=8192 generate_proof_file.js

let FILE_JSON = {}; // stores JSON from proof.json file
let TVL = {}; // stores data from TVL row
let MASTER_DATA = {}; // creates juno1addr: token list
let DECIMALS = Math.pow(10, 6); // to convert tokens to full neta
let DECIMALS_1T = Math.pow(10, 12); // BIG INT multiplier and divider per...somewhere on stackoverflow
let BIGDECIMALS = 1000000000000n; // see top

let total_tokens = 0; // for logging
let ADDRESSES_TO_EXCLUDE = [
  "juno1e8n6ch7msks487ecznyeagmzd5ml2pq9tgedqt2u63vra0q0r9mqrjy6ys", // JS neta/juno pool
  "juno1v4887y83d6g28puzvt8cl0f3cdhd3y6y9mpysnsp3k8krdm7l6jqgm0rkn", // osmosis bridge
  "juno12sulrvp220gpsp8jsr7dpk9sdydhe8plasltftc6fnxl7yukh24qjvqcu9", // JS bonded LPs
  "juno1njty28rqtpw6n59sjj4esw76enp4mg6gq37gxk", // ???? - osmo1njty28rqtpw6n59sjj4esw76enp4mg6g7cwrhc
  "juno1yn7z42al3mafmztjayjduz42a8at3whyd279fkdsyumzar83x8mq6e3v3y" // osmo1yn7z42al3mafmztjayjduz42a8at3whyd279fkdsyumzar83x8mqvpw83x osmosis LP module
];

let SUMMARY = {
  juno_holders: 0,
  juno_lpers: 0,
  juno_bonded: 0,
  osmo_holders: 0,
  osmo_lpers: 0
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
    let running_tokens = 0;

    // calculate JUNO holder
    if (data["onjuno_holder"] != null && data["onjuno_holder"] > 0) {
      running_tokens += parseFloat(data["onjuno_holder"] / DECIMALS);
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.juno_holders += parseFloat(data["onjuno_holder"] / DECIMALS);
      }
    }

    let junoswap_lp_shares = 0n;

    if (data["onjuno_lper"] != null && data["onjuno_lper"] > 0) {
      junoswap_lp_shares += BigInt(data["onjuno_lper"])
    }

    if (data["onjuno_bonded"] != null && data["onjuno_bonded"] > 0) {
      junoswap_lp_shares += BigInt(data["onjuno_bonded"])
    }

    if (junoswap_lp_shares > 0n) {
      let user_lp_share = Number(((junoswap_lp_shares*BIGDECIMALS) / BigInt(TVL.junoswap_lp_shares)))/DECIMALS_1T;
      let asset_val = user_lp_share * TVL.junoswap_tokens;
      let amt = (asset_val / DECIMALS).toFixed(6);

      running_tokens += parseFloat(amt);
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.juno_lpers += parseFloat(amt);
      }
    }

    // calculate OSMO holder
    if (data["onosmo_holder"] != null && data["onosmo_holder"] > 0) {
      running_tokens += parseFloat(data["onosmo_holder"] / DECIMALS);
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        SUMMARY.osmo_holders += parseFloat(data["onosmo_holder"] / DECIMALS);
      }
    }

    // calculate OSMO LPer
    if (data["onosmo_lper"] != null && data["onosmo_lper"] != undefined && data["onosmo_lper"].length > 0) {
      let user_lp_share = Number(((BigInt(data["onosmo_lper"])*BIGDECIMALS) / BigInt(TVL.osmosis_lp_shares)))/DECIMALS_1T;
      let asset_val = user_lp_share * TVL.osmosis_tokens;
      let amt = (asset_val / DECIMALS).toFixed(6);

      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        running_tokens += parseFloat(amt);
        SUMMARY.osmo_lpers += parseFloat(amt);
      }
    }

    if (running_tokens > 0) {
      if (!ADDRESSES_TO_EXCLUDE.includes(key)) {
        MASTER_DATA[key] = parseFloat(Number(running_tokens).toFixed(6));
        total_tokens += parseFloat(Number(running_tokens).toFixed(6));
      }
    }
  });

  console.log(total_tokens);
  fs.writeFile(AIRDROP_FILENAME, JSON.stringify(MASTER_DATA), 'utf8', () => {});
}

function openFile(filePath) {
  FILE_JSON = null;

  let fileData = fs.readFileSync(filePath);
  FILE_JSON = Object.assign({}, JSON.parse(fileData));
  fileData = null;
}

main();
