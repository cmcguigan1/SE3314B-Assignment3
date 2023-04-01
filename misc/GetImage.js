let net = require("net");
let fs = require("fs");
let open = require("open");
let ITPpacket = require("./ITPRequest"),
  singleton = require("./Singleton");

// call as GetImage -s <serverIP>:<port> -q <image name> -v <version>

let sFlag = process.argv[2];
let hostserverIPandPort = process.argv[3].split(":");

let qFlag = process.argv[4];

let imageName = process.argv[5];

let vFlag = process.argv[6];
let ITPVersion = process.argv[7];

let PORT = hostserverIPandPort[1];
let HOST = hostserverIPandPort[0];

singleton.init();
ITPpacket.init(ITPVersion, imageName, singleton.getTimestamp());

let client = new net.Socket();
client.connect(PORT, HOST, function () {
  console.log("Connected to ImageDB server on: " + HOST + ":" + PORT);
  client.write(ITPpacket.getBytePacket());
});

// Add a 'data' event handler for the client socket
// data is what the server sent to this socket
let imageExtension = {
  1: "BMP",
  2: "JPEG",
  3: "GIF",
  4: "PNG",
  5: "TIFF",
  15: "RAW",
};
let responseName = {
  0: "Query",
  1: "Found",
  2: "Not found",
  3: "Busy",
};
const chunks = [];
client.on("data", (chunk) => {
  chunks.push(chunk);
});
client.on("pause", () => {
  console.log("pause");
});
client.on("end", () => {
  const responsePacket = Buffer.concat(chunks);
  let header = responsePacket.slice(0, 12);
  let payload = responsePacket.slice(12);

  console.log("\nITP packet header received:");
  printPacketBit(header);

  // save image
  // let imageDataSize = parseBitPacket(payload, 64, 32);
  let imageDataSize = payload.length;


  // let imageDate = payload.slice(byteMarker, imageDataSize + byteMarker);
  fs.writeFileSync(imageName, payload);


  // open image
  (async () => {
    // Opens the image in the default image viewer and waits for the opened app to finish.
     
      await open(imageName, { wait: true });
      process.exit(1);
     
  })( );


  console.log("\nServer sent:");
  console.log("    --ITP version = " + parseBitPacket(header, 0, 4));
  console.log(
    "    --Response Type = " + responseName[parseBitPacket(header, 4, 8)]
  );
  console.log("    --Sequence Number = " + parseBitPacket(header, 12, 16));
  console.log("    --Timestamp = " + parseBitPacket(header, 32, 32));
  console.log();
  ////////////////////////////////////////
  client.end();
  
});

// Add a 'close' event handler for the client socket
client.on("close", function () {
  console.log("Connection closed");
 
});

client.on("end", () => {
  console.log("Disconnected from the server");
  
});

// return integer value of the extracted bits fragment
function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}

// Prints the entire packet in bits format
function printPacketBit(packet) {
  var bitString = "";

  for (var i = 0; i < packet.length; i++) {
    // To add leading zeros
    var b = "00000000" + packet[i].toString(2);
    // To print 4 bytes per line
    if (i > 0 && i % 4 == 0) bitString += "\n";
    bitString += " " + b.substr(b.length - 8);
  }
  console.log(bitString);
}
function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result += String.fromCharCode(array[i]);
  }
  return result;
}

