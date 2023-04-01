const singleton = require('./Singleton');
let version, msgType, numOfPeers, senderNameLength, senderName;
let headerBuffer, senderNameBuffer, peerInfoBuffer;

module.exports = {
  init: function (ver, messageType) {
    headerBuffer = new Buffer.alloc(4);
    version = ver;
    msgType = messageType;
    numOfPeers = singleton.getSizeOfDHT();
    senderName = stringToBytes(singleton.getSenderName());
    senderNameLength = senderName.length;

    // Populating the fixed length buffer for the header
    storeBitPacket(headerBuffer, Number(version), 0, 4);
    storeBitPacket(headerBuffer, Number(msgType), 4, 8);
    storeBitPacket(headerBuffer, numOfPeers, 12, 8);
    storeBitPacket(headerBuffer, senderNameLength, 20, 12);

    // Creating a buffer the length of the sender name and populating the buffer
    senderNameBuffer = new Buffer.alloc(senderNameLength);
    for (j = 0; j < senderName.length; j++) {
      senderNameBuffer[j] = senderName[j];
    }

    // fill the peerInfoBuffer
    if (numOfPeers > 0) {
      // iarray to hold all peers buffers to concatenate later
      let arrayOfPeerBuffers = [];
      let DHT = singleton.getDHT();
      for (let [k, peer] of DHT) {
        if(!peer){
          continue;
        }
        // create a new buffer of size 6 bytes
        let peerBuffer = new Buffer.alloc(6);
        // storing each number of the ipv4 address in a byte
        let splitIP = peer.peerIP.split(".");
        for(let i=0;i<splitIP.length;i++){
          storeBitPacket(peerBuffer, Number(splitIP[i]), i*8, 8);
        }
        
        // storing the port number
        storeBitPacket(peerBuffer, Number(peer.portNum), 32, 16);

        // add the peer buffer to the list of buffers
        arrayOfPeerBuffers.push(peerBuffer);
      }

      peerInfoBuffer = Buffer.concat(arrayOfPeerBuffers);
    }

    // Workaround for storing the sender peer's info into the receiving peer's tables when Hello packets are sent
    let thisPeer = new Buffer.alloc(6);
    let splitIP = singleton.getIP().split(".");
    for (let i = 0; i < splitIP.length; i++) {
      storeBitPacket(thisPeer, Number(splitIP[i]), i * 8, 8);
    }

    // storing the port number
    storeBitPacket(thisPeer, Number(singleton.getPortNumber()), 32, 16);

    try{
      peerInfoBuffer = Buffer.concat([thisPeer, peerInfoBuffer]);
    }
    catch(err){
      peerInfoBuffer = thisPeer;
    }
  },
  //--------------------------
  //getBytePacket: returns the entire packet in bytes
  //--------------------------
  getBytePacket: function () {
    let combinedBufferArray;
    if (peerInfoBuffer == null) {
      combinedBufferArray = [headerBuffer, senderNameBuffer];
    }
    else {
      combinedBufferArray = [headerBuffer, senderNameBuffer, peerInfoBuffer];
    }
    return Buffer.concat(combinedBufferArray);
  },
}

function stringToBytes(str) {
  var ch,
    st,
    re = [];
  for (var i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i); // get char
    st = []; // set up "stack"
    do {
      st.push(ch & 0xff); // push byte to stack
      ch = ch >> 8; // shift value down by 1 byte
    } while (ch);
    // add stack contents to result
    // done because chars have "wrong" endianness
    re = re.concat(st.reverse());
  }
  // return an array of bytes
  return re;
}

// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
  // let us get the actual byte position of the offset
  let lastBitPosition = offset + length - 1;
  let number = value.toString(2);
  let j = number.length - 1;
  for (var i = 0; i < number.length; i++) {
    let bytePosition = Math.floor(lastBitPosition / 8);
    let bitPosition = 7 - (lastBitPosition % 8);
    if (number.charAt(j--) == "0") {
      packet[bytePosition] &= ~(1 << bitPosition);
    } else {
      packet[bytePosition] |= 1 << bitPosition;
    }
    lastBitPosition--;
  }
}



